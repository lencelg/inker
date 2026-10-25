<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { basicSetup } from 'codemirror';
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
  syntaxTree,
} from '@codemirror/language';
import {
  Compartment,
  EditorSelection,
  EditorState,
  Prec,
  type Range,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  keymap,
  placeholder,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { tags } from '@lezer/highlight';
import { Vim, getCM, vim } from '@replit/codemirror-vim';
import Breadcrumbs from './Breadcrumbs.vue';
import {
  activeHeadingTrail,
  collectHeadings,
  type HeadingItem,
} from '../lib/headings';
import { language, t } from '../lib/i18n';
import {
  minimapLineAtRatio,
  minimapViewportMetrics,
} from '../lib/minimap';
import { formatVimMode } from '../lib/vimMode';
import { wheelDeltaPixels } from '../lib/wheelScroll';

const props = defineProps<{
  initialContent: string;
  vimEnabled: boolean;
  readOnly: boolean;
  layoutKey?: string;
  immersive: boolean;
  sourceHighlight: boolean;
}>();

const emit = defineEmits<{
  change: [content: string];
  scrollSync: [position: { line: number; ratio: number }];
  cursor: [position: { line: number; column: number }];
  saveRequest: [];
  vimMode: [mode: string | null];
}>();

const host = ref<HTMLDivElement | null>(null);
const breadcrumbs = ref<HeadingItem[]>([]);
const minimapHost = ref<HTMLDivElement | null>(null);
const minimapCanvas = ref<HTMLCanvasElement | null>(null);
const minimapViewport = ref<HTMLDivElement | null>(null);
const minimapPercent = ref(0);
const vimCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const immersiveCompartment = new Compartment();
const highlightCompartment = new Compartment();
const placeholderCompartment = new Compartment();
const attributesCompartment = new Compartment();
const vimExtension = vim({ status: false });

let view: EditorView | null = null;
let headings: HeadingItem[] = [];
let scrollElement: HTMLElement | null = null;
let scrollFrame = 0;
let resizeFrame = 0;
let centerFrame = 0;
let vimStatusFrame = 0;
let minimapFrame = 0;
let minimapDragging = false;
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;

interface VimModeEvent {
  mode?: string;
  subMode?: string;
}

function scheduleVimStatus(): void {
  if (vimStatusFrame) cancelAnimationFrame(vimStatusFrame);
  vimStatusFrame = requestAnimationFrame(() => {
    vimStatusFrame = 0;
    attachVimStatus();
  });
}

function attachVimStatus(): void {
  if (!view) return;
  if (!props.vimEnabled) {
    emit('vimMode', null);
    return;
  }

  const cm = getCM(view);
  if (!cm) {
    emit('vimMode', 'NORMAL');
    return;
  }

  const commandHost = document.querySelector<HTMLElement>(
    '.status-vim-command',
  );
  if (commandHost) {
    commandHost.replaceChildren();
    cm.state.statusbar = commandHost;
    const plugin = cm.state.vimPlugin as
      | {
          statusButton?: HTMLElement;
          spacer?: HTMLElement;
          dom?: HTMLElement;
          updateStatus?: () => void;
        }
      | undefined;
    if (plugin?.statusButton) plugin.statusButton.hidden = true;
    if (plugin?.spacer) plugin.spacer.style.display = 'none';
    const syncCommandHint = (): void => {
      if (plugin?.dom) {
        plugin.dom.style.display = cm.state.dialog ? 'none' : '';
      }
    };
    cm.on('dialog', syncCommandHint);
    syncCommandHint();
    plugin?.updateStatus?.();
  }

  cm.on('vim-mode-change', (event: VimModeEvent) => {
    emit('vimMode', formatVimMode(event));
  });
  cm.on('vim-command-done', () => {
    emit(
      'vimMode',
      formatVimMode({ mode: cm.state.vim?.mode ?? 'normal' }),
    );
  });
  emit('vimMode', formatVimMode({ mode: cm.state.vim?.mode ?? 'normal' }));
}

const syntaxTheme = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-keyword)' },
  {
    tag: [tags.atom, tags.bool, tags.number, tags.integer, tags.float],
    color: 'var(--syntax-number)',
  },
  { tag: [tags.string, tags.character], color: 'var(--syntax-string)' },
  { tag: [tags.comment, tags.meta], color: 'var(--syntax-comment)' },
  {
    tag: [tags.typeName, tags.className, tags.namespace],
    color: 'var(--syntax-type)',
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--syntax-function)',
  },
  {
    tag: [tags.variableName, tags.propertyName, tags.attributeName],
    color: 'var(--syntax-variable)',
  },
  {
    tag: [
      tags.operator,
      tags.operatorKeyword,
      tags.punctuation,
      tags.separator,
      tags.bracket,
    ],
    color: 'var(--syntax-operator)',
  },
  { tag: [tags.tagName, tags.angleBracket], color: 'var(--syntax-tag)' },
  {
    tag: [
      tags.heading,
      tags.heading1,
      tags.heading2,
      tags.heading3,
      tags.heading4,
      tags.heading5,
      tags.heading6,
    ],
    color: 'var(--syntax-heading)',
    fontWeight: '700',
  },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.link, color: 'var(--syntax-link)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--syntax-link)' },
  { tag: tags.quote, color: 'var(--syntax-quote)' },
  { tag: tags.monospace, color: 'var(--syntax-string)' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.invalid, color: 'var(--syntax-invalid)' },
]);

const plainCodeBlockTheme = EditorView.theme({
  '.cm-codeblock-plain span': {
    color: 'inherit !important',
    fontStyle: 'inherit !important',
    fontWeight: 'inherit !important',
    textDecoration: 'none !important',
    backgroundColor: 'transparent !important',
  },
});

function buildPlainCodeBlockDecorations(
  view: EditorView,
): DecorationSet {
  const lines = new Set<number>();
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'FencedCode' && node.name !== 'CodeBlock') {
          return;
        }

        const first = view.state.doc.lineAt(node.from).number;
        const last = view.state.doc.lineAt(
          Math.min(
            view.state.doc.length,
            Math.max(node.from, node.to - 1),
          ),
        ).number;

        for (let number = first; number <= last; number += 1) {
          const line = view.state.doc.line(number);
          if (lines.has(line.from)) continue;
          lines.add(line.from);
          decorations.push(
            Decoration.line({ class: 'cm-codeblock-plain' }).range(
              line.from,
            ),
          );
        }
        return false;
      },
    });
  }

  return Decoration.set(decorations, true);
}

const plainCodeBlocks = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildPlainCodeBlockDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildPlainCodeBlockDecorations(
          update.view,
        );
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

function sourceHighlightExtension(enabled: boolean) {
  return enabled
    ? []
    : [plainCodeBlocks, plainCodeBlockTheme];
}

const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    fontSize: 'var(--content-font-size, 15px)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'var(--mono-font)',
    lineHeight: '1.75',
  },
  '.cm-content': {
    padding: '14px 18px',
    caretColor: 'var(--editor-caret, var(--ink))',
    color: 'var(--ink)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--editor-caret, var(--ink))',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-cursor, &.cm-focused .cm-dropCursor': {
    borderLeftColor: 'var(--editor-caret, var(--ink))',
    borderLeftWidth: '2px',
  },
  '.cm-cursor-primary': {
    borderLeftColor: 'var(--editor-caret, var(--ink))',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-soft)',
    border: 'none',
    borderRight: '1px solid var(--border)',
    color: 'var(--faint)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--editor-active-line)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--editor-active-line-gutter)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--editor-selection)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--bg-soft)',
    color: 'var(--ink)',
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid var(--border)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--hover-strong)',
    outline: '1px solid var(--accent)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'var(--accent-soft)',
  },
  '.cm-textfield, .cm-button': {
    border: '1px solid var(--border)',
    backgroundColor: 'var(--panel)',
    color: 'var(--ink)',
  },
  '.cm-tooltip': {
    border: '1px solid var(--border)',
    backgroundColor: 'var(--panel)',
    color: 'var(--ink)',
  },
});

function readOnlyExtensions(readOnly: boolean) {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];
}

function emitScrollSync(): void {
  if (!view || !scrollElement) return;
  const maximum = scrollElement.scrollHeight - scrollElement.clientHeight;
  const ratio = maximum > 0 ? scrollElement.scrollTop / maximum : 0;
  const rect = scrollElement.getBoundingClientRect();
  const position = view.posAtCoords({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  });
  const line =
    position === null
      ? view.state.doc.lines
      : view.state.doc.lineAt(position).number;
  emit('scrollSync', { line, ratio });
}

function scheduleScrollSync(): void {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    updateMinimapViewport();
    emitScrollSync();
  });
}

function handleScroll(): void {
  scheduleScrollSync();
}

function emitCursor(): void {
  if (!view) return;
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  emit('cursor', {
    line: line.number,
    column: head - line.from + 1,
  });
}

function refreshHeadingTrail(): void {
  if (!view) return;
  const line = view.state.doc.lineAt(
    view.state.selection.main.head,
  ).number;
  breadcrumbs.value = activeHeadingTrail(headings, line);
}

interface MinimapPalette {
  base: string;
  heading: string;
  code: string;
  link: string;
  quote: string;
  tag: string;
  marker: string;
  strong: string;
  emphasis: string;
  type: string;
}

interface MinimapSegment {
  from: number;
  to: number;
  color: string;
}

const MINIMAP_HEADING = /^(?:ATX|Setext)Heading[1-6]$/;

function minimapColor(
  styles: CSSStyleDeclaration,
  name: string,
  fallback: string,
): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

function readMinimapPalette(): MinimapPalette {
  const styles = getComputedStyle(document.documentElement);
  return {
    base: minimapColor(styles, '--faint', '#9aa3ad'),
    heading: minimapColor(styles, '--syntax-heading', '#1f4e79'),
    code: minimapColor(styles, '--syntax-string', '#a31515'),
    link: minimapColor(styles, '--syntax-link', '#0066cc'),
    quote: minimapColor(styles, '--syntax-quote', '#6b7280'),
    tag: minimapColor(styles, '--syntax-tag', '#800000'),
    marker: minimapColor(styles, '--syntax-operator', '#383a42'),
    strong: minimapColor(styles, '--ink', '#1f2933'),
    emphasis: minimapColor(styles, '--muted', '#6b7280'),
    type: minimapColor(styles, '--syntax-type', '#267f99'),
  };
}

function minimapNodeStyle(
  name: string,
  palette: MinimapPalette,
): string | null {
  if (MINIMAP_HEADING.test(name)) return palette.heading;
  switch (name) {
    case 'InlineCode':
    case 'CodeText':
      return palette.code;
    case 'CodeInfo':
      return palette.type;
    case 'Link':
    case 'Image':
    case 'URL':
      return palette.link;
    case 'StrongEmphasis':
      return palette.strong;
    case 'Emphasis':
      return palette.emphasis;
    case 'HTMLBlock':
    case 'HTMLTag':
      return palette.tag;
    case 'QuoteMark':
      return palette.quote;
    case 'ListMark':
      return palette.marker;
    default:
      return null;
  }
}

function addMinimapSegments(
  state: EditorState,
  segments: Map<number, MinimapSegment[]>,
  from: number,
  to: number,
  color: string,
): void {
  if (to <= from) return;
  let line = state.doc.lineAt(from);
  while (true) {
    const start = Math.max(from, line.from) - line.from;
    const end = Math.min(to, line.to) - line.from;
    if (end > start) {
      const list = segments.get(line.number) ?? [];
      list.push({ from: start, to: end, color });
      segments.set(line.number, list);
    }
    if (line.to >= to || line.number >= state.doc.lines) break;
    line = state.doc.line(line.number + 1);
  }
}

function collectMinimapSegments(
  state: EditorState,
  palette: MinimapPalette,
): Map<number, MinimapSegment[]> {
  const segments = new Map<number, MinimapSegment[]>();
  syntaxTree(state).iterate({
    enter(node) {
      const color = minimapNodeStyle(node.name, palette);
      if (!color) return undefined;
      addMinimapSegments(state, segments, node.from, node.to, color);
      return false;
    },
  });
  return segments;
}

function leadingIndent(text: string): number {
  let indent = 0;
  for (const character of text) {
    if (character === ' ') indent += 1;
    else if (character === '\t') indent += 4;
    else break;
    if (indent >= 80) break;
  }
  return Math.min(indent, 80);
}

function drawMinimap(): void {
  const canvas = minimapCanvas.value;
  const minimap = minimapHost.value;
  if (!canvas || !minimap || !view) return;

  const width = minimap.clientWidth;
  const height = minimap.clientHeight;
  if (width < 2 || height < 2) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const state = view.state;
  const lineCount = state.doc.lines;
  const palette = readMinimapPalette();
  const segments = collectMinimapSegments(state, palette);
  const padding = 6;
  const contentWidth = Math.max(1, width - padding * 2);
  let widthChars = 60;
  for (let number = 1; number <= lineCount; number += 1) {
    const length = state.doc.line(number).text.trimEnd().length;
    if (length > widthChars) widthChars = length;
    if (widthChars >= 180) {
      widthChars = 180;
      break;
    }
  }
  const charWidth = Math.min(1, contentWidth / widthChars);
  const lineStep = Math.min(2.4, height / lineCount);
  const barHeight = Math.max(0.8, Math.min(2.2, lineStep * 0.72));

  for (let number = 1; number <= lineCount; number += 1) {
    const line = state.doc.line(number);
    const text = line.text;
    const end = text.trimEnd().length;
    if (end === 0) continue;

    const indent = leadingIndent(text);
    const y = (number - 1) * lineStep;
    const x = padding + indent * charWidth;
    const baseWidth = Math.min(
      contentWidth - indent * charWidth,
      Math.max(1, (end - indent) * charWidth),
    );
    if (baseWidth <= 0) continue;

    context.globalAlpha = 0.5;
    context.fillStyle = palette.base;
    context.fillRect(x, y, baseWidth, barHeight);

    const lineSegments = segments.get(number);
    if (!lineSegments) continue;
    context.globalAlpha = 0.94;
    for (const segment of lineSegments) {
      const start = Math.max(segment.from, indent);
      const finish = Math.min(segment.to, end);
      if (finish <= start) continue;
      const segmentX = padding + start * charWidth;
      const segmentWidth = Math.max(0.8, (finish - start) * charWidth);
      if (segmentX >= width - padding) continue;
      context.fillStyle = segment.color;
      context.fillRect(
        segmentX,
        y,
        Math.min(segmentWidth, width - padding - segmentX),
        barHeight,
      );
    }
  }
  context.globalAlpha = 1;
}

function updateMinimapViewport(): void {
  const minimap = minimapHost.value;
  const slider = minimapViewport.value;
  if (!minimap || !slider || !scrollElement) return;

  const metrics = minimapViewportMetrics(
    scrollElement.scrollTop,
    scrollElement.clientHeight,
    scrollElement.scrollHeight,
    minimap.clientHeight,
    18,
  );
  slider.style.height = `${metrics.height}px`;
  slider.style.transform = `translateY(${metrics.top}px)`;
  minimapPercent.value = Math.round(metrics.ratio * 100);
}

function scheduleMinimapDraw(): void {
  if (minimapFrame) return;
  minimapFrame = requestAnimationFrame(() => {
    minimapFrame = 0;
    drawMinimap();
    updateMinimapViewport();
  });
}

function minimapLineAtClientY(clientY: number): number {
  const minimap = minimapHost.value;
  if (!minimap || !view) return 1;
  const rect = minimap.getBoundingClientRect();
  const ratio = (clientY - rect.top) / Math.max(1, rect.height);
  return minimapLineAtRatio(ratio, view.state.doc.lines);
}

function scrollFromMinimap(clientY: number): void {
  if (!view) return;
  scrollToLine(minimapLineAtClientY(clientY));
}

function startMinimapDrag(event: PointerEvent): void {
  if (event.button !== 0) return;
  const minimap = minimapHost.value;
  if (!minimap) return;
  event.preventDefault();
  minimapDragging = true;
  minimap.setPointerCapture(event.pointerId);
  scrollFromMinimap(event.clientY);
  view?.focus();
}

function moveMinimapDrag(event: PointerEvent): void {
  if (!minimapDragging) return;
  event.preventDefault();
  scrollFromMinimap(event.clientY);
}

function endMinimapDrag(event: PointerEvent): void {
  if (!minimapDragging) return;
  minimapDragging = false;
  const minimap = minimapHost.value;
  if (minimap?.hasPointerCapture(event.pointerId)) {
    minimap.releasePointerCapture(event.pointerId);
  }
}

function handleMinimapWheel(event: WheelEvent): void {
  if (
    !scrollElement ||
    event.defaultPrevented ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    event.deltaY === 0 ||
    Math.abs(event.deltaX) > Math.abs(event.deltaY)
  ) {
    return;
  }
  const maximum =
    scrollElement.scrollHeight - scrollElement.clientHeight;
  if (maximum <= 0) return;
  event.preventDefault();
  scrollElement.scrollTop = Math.min(
    maximum,
    Math.max(
      0,
      scrollElement.scrollTop +
        wheelDeltaPixels(event, scrollElement.clientHeight),
    ),
  );
}

function handleMinimapKeydown(event: KeyboardEvent): void {
  if (!scrollElement) return;
  const maximum =
    scrollElement.scrollHeight - scrollElement.clientHeight;
  if (maximum <= 0) return;

  let delta: number | null = null;
  switch (event.key) {
    case 'ArrowUp':
      delta = -48;
      break;
    case 'ArrowDown':
      delta = 48;
      break;
    case 'PageUp':
      delta = -scrollElement.clientHeight * 0.85;
      break;
    case 'PageDown':
      delta = scrollElement.clientHeight * 0.85;
      break;
    case 'Home':
      delta = -scrollElement.scrollTop;
      break;
    case 'End':
      delta = maximum - scrollElement.scrollTop;
      break;
    default:
      return;
  }
  event.preventDefault();
  scrollElement.scrollTop = Math.min(
    maximum,
    Math.max(0, scrollElement.scrollTop + delta),
  );
}

function activeBlock(
  source: EditorView,
): { start: number; end: number } {
  const doc = source.state.doc;
  const cursorLine = doc.lineAt(source.state.selection.main.head).number;
  let start = cursorLine;
  let end = cursorLine;

  while (start > 1 && doc.line(start - 1).text.trim() !== '') {
    start -= 1;
  }
  while (end < doc.lines && doc.line(end + 1).text.trim() !== '') {
    end += 1;
  }
  return { start, end };
}

function buildImmersiveDecorations(source: EditorView): DecorationSet {
  const { start, end } = activeBlock(source);
  const decorations: Range<Decoration>[] = [];
  const doc = source.state.doc;
  const lineDecoration = Decoration.line({ class: 'cm-immersive-dim' });

  for (const range of source.visibleRanges) {
    let line = doc.lineAt(range.from);
    while (true) {
      if (line.number < start || line.number > end) {
        decorations.push(lineDecoration.range(line.from));
      }
      if (line.to >= range.to || line.number >= doc.lines) break;
      line = doc.line(line.number + 1);
    }
  }

  return Decoration.set(decorations);
}

const immersiveDimPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(source: EditorView) {
      this.decorations = buildImmersiveDecorations(source);
    }

    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged
      ) {
        this.decorations = buildImmersiveDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

function centerSelection(): void {
  if (!props.immersive || !view || centerFrame) return;
  centerFrame = requestAnimationFrame(() => {
    centerFrame = 0;
    if (!view || !props.immersive) return;
    const head = view.state.selection.main.head;
    view.dispatch({
      effects: EditorView.scrollIntoView(head, { y: 'center' }),
    });
  });
}

function selectNextOccurrence(source: EditorView): boolean {
  const state = source.state;
  const ranges = state.selection.ranges;
  const primary = ranges[ranges.length - 1];

  if (primary.empty) {
    const word = state.wordAt(primary.head);
    if (!word) return false;
    source.dispatch({
      selection: EditorSelection.create([
        EditorSelection.range(word.from, word.to),
      ]),
    });
    return true;
  }

  const text = state.sliceDoc(primary.from, primary.to);
  if (!text) return false;
  const doc = state.doc.toString();

  let index = doc.indexOf(text, primary.to);
  while (
    index >= 0 &&
    ranges.some(
      (range) => range.from === index && range.to === index + text.length,
    )
  ) {
    index = doc.indexOf(text, index + text.length);
  }
  if (index < 0) {
    index = doc.indexOf(text, 0);
    while (
      index >= 0 &&
      ranges.some(
        (range) => range.from === index && range.to === index + text.length,
      )
    ) {
      index = doc.indexOf(text, index + text.length);
    }
  }
  if (index < 0) return false;

  const next = ranges.concat(
    EditorSelection.range(index, index + text.length),
  );
  source.dispatch({
    selection: EditorSelection.create(next, next.length - 1),
    scrollIntoView: true,
  });
  return true;
}

function collapseSelections(source: EditorView): boolean {
  if (source.state.selection.ranges.length <= 1) return false;
  source.dispatch({
    selection: EditorSelection.cursor(source.state.selection.main.head),
  });
  return true;
}

const multiCursorKeymap = Prec.high(
  keymap.of([
    { key: 'Mod-d', run: selectNextOccurrence, preventDefault: true },
    { key: 'Escape', run: collapseSelections, preventDefault: true },
  ]),
);

const multiCursorMouse = EditorView.domEventHandlers({
  mousedown(event, source) {
    if (!event.altKey) return false;
    const position = source.posAtCoords({
      x: event.clientX,
      y: event.clientY,
    });
    if (position === null) return false;
    const selection = source.state.selection;
    const next = selection.addRange(
      EditorSelection.cursor(position),
      true,
    );
    source.dispatch({ selection: next });
    source.focus();
    event.preventDefault();
    return true;
  },
});

onMounted(() => {
  if (!host.value) {
    return;
  }
  Vim.defineEx('write', 'w', () => {
    emit('saveRequest');
  });
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.initialContent,
      extensions: [
        vimCompartment.of(props.vimEnabled ? vimExtension : []),
        readOnlyCompartment.of(readOnlyExtensions(props.readOnly)),
        immersiveCompartment.of(
          props.immersive ? immersiveDimPlugin : [],
        ),
        highlightCompartment.of(
          sourceHighlightExtension(props.sourceHighlight),
        ),
        EditorState.allowMultipleSelections.of(true),
        multiCursorKeymap,
        multiCursorMouse,
        basicSetup,
        markdown({ codeLanguages: languages }),
        syntaxHighlighting(syntaxTheme),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        placeholderCompartment.of(placeholder(t('editor.placeholder'))),
        EditorView.lineWrapping,
        attributesCompartment.of(
          EditorView.contentAttributes.of({
            'aria-label': t('editor.markdownContent'),
          }),
        ),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emit('change', update.state.doc.toString());
            headings = collectHeadings(update.state);
            scheduleMinimapDraw();
            scheduleScrollSync();
          }
          if (update.docChanged || update.selectionSet) {
            emitCursor();
            refreshHeadingTrail();
            centerSelection();
          }
        }),
      ],
    }),
  });
  scrollElement = view.scrollDOM;
  scrollElement.addEventListener('scroll', handleScroll, { passive: true });
  resizeObserver = new ResizeObserver(() => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      drawMinimap();
      updateMinimapViewport();
      emitScrollSync();
    });
  });
  resizeObserver.observe(scrollElement);
  themeObserver = new MutationObserver(() => scheduleMinimapDraw());
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [
      'data-theme',
      'data-custom-theme',
      'data-font',
      'style',
    ],
  });
  view.focus();
  scheduleScrollSync();
  emitCursor();
  headings = collectHeadings(view.state);
  refreshHeadingTrail();
  scheduleMinimapDraw();
  scheduleVimStatus();
});

watch(
  () => props.vimEnabled,
  (enabled) => {
    view?.dispatch({
      effects: vimCompartment.reconfigure(enabled ? vimExtension : []),
    });
    scheduleVimStatus();
    view?.focus();
  },
);

watch(
  () => props.sourceHighlight,
  (enabled) => {
    view?.dispatch({
      effects: highlightCompartment.reconfigure(
        sourceHighlightExtension(enabled),
      ),
    });
  },
);

watch(
  () => props.readOnly,
  (readOnly) => {
    view?.dispatch({
      effects: readOnlyCompartment.reconfigure(readOnlyExtensions(readOnly)),
    });
  },
);

watch(
  () => props.layoutKey,
  () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      view?.requestMeasure();
      drawMinimap();
      updateMinimapViewport();
      emitScrollSync();
    });
  },
);

watch(
  () => props.immersive,
  (enabled) => {
    view?.dispatch({
      effects: immersiveCompartment.reconfigure(
        enabled ? immersiveDimPlugin : [],
      ),
    });
    if (enabled) centerSelection();
  },
);

watch(language, () => {
  view?.dispatch({
    effects: [
      placeholderCompartment.reconfigure(
        placeholder(t('editor.placeholder')),
      ),
      attributesCompartment.reconfigure(
        EditorView.contentAttributes.of({
          'aria-label': t('editor.markdownContent'),
        }),
      ),
    ],
  });
});

onBeforeUnmount(() => {
  if (scrollFrame) {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  }
  if (resizeFrame) {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = 0;
  }
  if (centerFrame) {
    cancelAnimationFrame(centerFrame);
    centerFrame = 0;
  }
  if (vimStatusFrame) {
    cancelAnimationFrame(vimStatusFrame);
    vimStatusFrame = 0;
  }
  if (minimapFrame) {
    cancelAnimationFrame(minimapFrame);
    minimapFrame = 0;
  }
  minimapDragging = false;
  themeObserver?.disconnect();
  themeObserver = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  scrollElement?.removeEventListener('scroll', handleScroll);
  scrollElement = null;
  view?.destroy();
  view = null;
});

function revealLine(lineNumber: number, column = 1): void {
  if (!view) return;
  const safeLine = Math.min(
    Math.max(1, lineNumber),
    view.state.doc.lines,
  );
  const target = view.state.doc.line(safeLine);
  const prefix = Array.from(target.text)
    .slice(0, Math.max(0, column - 1))
    .join('');
  const anchor = Math.min(target.to, target.from + prefix.length);
  view.dispatch({
    selection: { anchor },
    effects: EditorView.scrollIntoView(anchor, { y: 'center' }),
  });
  view.focus();
}

function scrollToLine(lineNumber: number): void {
  if (!view) return;
  const safeLine = Math.min(
    Math.max(1, Math.round(lineNumber)),
    view.state.doc.lines,
  );
  const target = view.state.doc.line(safeLine);
  view.dispatch({
    effects: EditorView.scrollIntoView(target.from, { y: 'center' }),
  });
}

interface EditorViewState {
  line: number;
  column: number;
  scrollTop: number;
}

function captureState(): EditorViewState | null {
  if (!view || !scrollElement) return null;
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  return {
    line: line.number,
    column: head - line.from + 1,
    scrollTop: scrollElement.scrollTop,
  };
}

function restoreState(state: EditorViewState): void {
  if (!view || !scrollElement) return;
  const lineNumber = Math.min(
    Math.max(1, Math.round(state.line)),
    view.state.doc.lines,
  );
  const line = view.state.doc.line(lineNumber);
  const column = Math.min(
    Math.max(1, Math.round(state.column)),
    line.length + 1,
  );
  view.dispatch({
    selection: { anchor: line.from + column - 1 },
  });
  view.requestMeasure();

  const top = Math.max(0, state.scrollTop);
  requestAnimationFrame(() => {
    if (!view || !scrollElement) return;
    scrollElement.scrollTop = top;
    view.focus();
  });
}

function refresh(): void {
  if (!view) return;
  view.requestMeasure();
  view.focus();
}

defineExpose({ revealLine, refresh, scrollToLine, captureState, restoreState });
</script>

<template>
  <div class="editor-shell">
    <Breadcrumbs :items="breadcrumbs" />
    <div class="editor-body">
      <div ref="host" class="editor-host"></div>
      <div
        ref="minimapHost"
        class="minimap"
        role="scrollbar"
        :aria-label="t('editor.minimap')"
        aria-orientation="vertical"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="minimapPercent"
        tabindex="0"
        @pointerdown="startMinimapDrag"
        @pointermove="moveMinimapDrag"
        @pointerup="endMinimapDrag"
        @pointercancel="endMinimapDrag"
        @keydown="handleMinimapKeydown"
        @wheel="handleMinimapWheel"
      >
        <canvas
          ref="minimapCanvas"
          class="minimap-canvas"
          aria-hidden="true"
        ></canvas>
        <div
          ref="minimapViewport"
          class="minimap-viewport"
          aria-hidden="true"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.editor-body {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.editor-host {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.minimap {
  position: relative;
  flex: none;
  width: 78px;
  overflow: hidden;
  outline: none;
  background: var(--bg-soft);
  border-left: 1px solid var(--border);
  cursor: pointer;
  touch-action: none;
}

.minimap:focus-visible {
  box-shadow: inset 0 0 0 1px var(--accent);
}

.minimap-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.minimap-viewport {
  position: absolute;
  top: 0;
  right: 2px;
  left: 2px;
  box-sizing: border-box;
  background: var(--editor-selection);
  border: 1px solid var(--accent);
  border-radius: 2px;
  opacity: 0.9;
  pointer-events: none;
}

.editor-host :deep(.cm-editor) {
  height: 100%;
}

.editor-host :deep(.cm-immersive-dim) {
  opacity: 0.26;
  transition: opacity 120ms ease;
}

.editor-host :deep(.cm-vim-panel) {
  padding: 4px 12px;
  border-top: 1px solid var(--border);
  background: var(--bg-soft);
  color: var(--muted);
  font-family: var(--mono-font);
  font-size: 12px;
}

.editor-host :deep(.cm-vim-panel input) {
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  font-size: inherit;
}
</style>
