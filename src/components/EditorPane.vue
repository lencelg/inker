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
  StateEffect,
  type Range,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
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
import { EditorMinimap } from '../lib/editorMinimap';
import {
  MINIMAP_DEFAULT_MAX_COLUMN,
  MINIMAP_DEFAULT_SCALE,
} from '../lib/minimap';
import {
  activeHeadingTrail,
  collectHeadings,
  type HeadingItem,
} from '../lib/headings';
import { language, t } from '../lib/i18n';
import { withBlockSpacing } from '../lib/blockInsertion';
import { readClipboardImageFile } from '../lib/clipboardImage';
import {
  hasClipboardText,
  readClipboardText,
} from '../lib/clipboardText';
import {
  imageFilesFrom,
  type ImageSaveHandler,
} from '../lib/imagePaste';
import { formatVimMode } from '../lib/vimMode';
import {
  completeVimCommandLine,
  resolveVimNotePath,
} from '../lib/vimCommandLineCompletion';
import {
  loadVimCommandHistory,
  recordVimCommand,
} from '../lib/vimCommandHistory';
import {
  closeAllVimFolds,
  closeVimFold,
  openAllVimFolds,
  openVimFold,
  toggleVimFold,
} from '../lib/vimFolding';
import {
  addSurroundChanges,
  deleteSurroundChanges,
  findSurroundPair,
  replaceSurroundChanges,
  surroundPair,
  type SurroundPair,
  type TextRange,
} from '../lib/vimSurround';
import {
  APP_VIM_EX_COMMANDS,
  type VimExContext,
} from '../lib/vimExCommands';
import { vimMacroState, vimViewOf } from '../lib/vimInternals';
import type { FileEntry } from '../types';
import {
  parseVimMappings,
  type VimMapping,
} from '../lib/vimMappings';

const props = withDefaults(
  defineProps<{
    initialContent: string;
    vimEnabled: boolean;
    readOnly: boolean;
    layoutKey?: string;
    immersive: boolean;
    sourceHighlight: boolean;
    requestImageSave: ImageSaveHandler;
    vimMappings: string;
    notePath: string;
    files: FileEntry[];
    minimapEnabled?: boolean;
    minimapScale?: number;
    minimapMaxColumn?: number;
    highlightRevision?: number;
  }>(),
  {
    minimapEnabled: true,
    minimapScale: MINIMAP_DEFAULT_SCALE,
    minimapMaxColumn: MINIMAP_DEFAULT_MAX_COLUMN,
    highlightRevision: 0,
  },
);

const emit = defineEmits<{
  change: [content: string];
  scrollSync: [position: { line: number; ratio: number }];
  cursor: [position: { line: number; column: number }];
  saveRequest: [];
  vimMode: [mode: string | null];
  vimRecording: [register: string | null];
  vimMessage: [message: string | null];
  openNote: [path: string];
  closeTab: [force: boolean];
  saveAndCloseTab: [];
  switchTab: [direction: 1 | -1];
}>();

const host = ref<HTMLDivElement | null>(null);
const breadcrumbs = ref<HeadingItem[]>([]);
const minimapHost = ref<HTMLDivElement | null>(null);
const minimapBaseCanvas = ref<HTMLCanvasElement | null>(null);
const minimapOverlayCanvas = ref<HTMLCanvasElement | null>(null);
const minimapViewport = ref<HTMLDivElement | null>(null);
const minimapScrollbar = ref<HTMLDivElement | null>(null);
const minimapScrollbarThumb = ref<HTMLDivElement | null>(null);
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
let cancelImagePrompt: (() => void) | null = null;
let lastVimRecording: string | null = null;
const notificationWrapped = new WeakSet<object>();
let appliedVimMappings: VimMapping[] = [];
let spaceLeaderActive = false;

type SurroundPending =
  | { kind: 'add'; ranges: TextRange[] }
  | { kind: 'change'; stage: 'old' }
  | { kind: 'change'; stage: 'new'; pair: SurroundPair }
  | { kind: 'delete' };

let surroundPending: SurroundPending | null = null;
let vimSurroundRegistered = false;

function clearVimMappings(): void {
  for (const mapping of appliedVimMappings) {
    Vim.unmap(mapping.keys, mapping.mode);
  }
  appliedVimMappings = [];
  restoreSpaceMapping();
}

function restoreSpaceMapping(): void {
  if (!spaceLeaderActive) return;
  // Restore the exact built-in <Space> mapping (move right), which has no
  // context. It must be removed while a longer <Space> prefix is mapped,
  // otherwise the full match wins and the longer mapping never fires.
  Vim._mapCommand({
    keys: '<Space>',
    type: 'keyToKey',
    toKeys: 'l',
  } as never);
  spaceLeaderActive = false;
}

function overrideSpaceMapping(): void {
  if (spaceLeaderActive) return;
  Vim.unmap('<Space>', undefined as unknown as string);
  spaceLeaderActive = true;
}

function applyVimMappings(): void {
  clearVimMappings();
  if (!props.vimEnabled) return;

  const mappings = parseVimMappings(props.vimMappings);
  if (
    mappings.some(
      (mapping) =>
        mapping.keys.startsWith('<Space>') && mapping.keys !== '<Space>',
    )
  ) {
    overrideSpaceMapping();
  }

  for (const mapping of mappings) {
    if (mapping.command.startsWith('=')) {
      Vim.map(
        mapping.keys,
        mapping.command.slice(1),
        mapping.mode,
      );
    } else if (mapping.command === 'pasteimage') {
      Vim.mapCommand(
        mapping.keys,
        'action',
        'inkerPasteImage',
        {},
        { context: mapping.mode },
      );
    } else if (mapping.command === 'save') {
      Vim.mapCommand(
        mapping.keys,
        'action',
        'inkerSave',
        {},
        { context: mapping.mode },
      );
    }
    appliedVimMappings.push(mapping);
  }
}
let scrollFrame = 0;
let resizeFrame = 0;
let centerFrame = 0;
let vimStatusFrame = 0;
let minimap: EditorMinimap | null = null;
let resizeObserver: ResizeObserver | null = null;

interface VimModeEvent {
  mode?: string;
  subMode?: string;
}

function emitVimRecording(): void {
  if (!props.vimEnabled) {
    if (lastVimRecording !== null) {
      lastVimRecording = null;
      emit('vimRecording', null);
    }
    return;
  }

  const macro = vimMacroState();
  const next =
    macro?.isRecording && macro.latestRegister
      ? macro.latestRegister
      : null;
  if (next === lastVimRecording) return;
  lastVimRecording = next;
  emit('vimRecording', next);
}

interface VimNotificationAdapter {
  openNotification: (
    template: HTMLElement,
    options?: { duration?: number },
  ) => () => void;
}

function wrapVimNotifications(cm: object): void {
  if (notificationWrapped.has(cm)) return;
  notificationWrapped.add(cm);

  const adapter = cm as VimNotificationAdapter;
  const original = adapter.openNotification.bind(adapter);
  adapter.openNotification = (template, options) => {
    const text = template.textContent?.trim() ?? '';
    if (!text) return original(template, options);

    emit('vimMessage', text);
    if (options?.duration === 0) {
      return original(template, options);
    }
    return () => undefined;
  };
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
    lastVimRecording = null;
    emit('vimMode', null);
    emit('vimRecording', null);
    return;
  }

  const cm = getCM(view);
  if (!cm) {
    emit('vimMode', 'NORMAL');
    emit('vimRecording', null);
    return;
  }

  wrapVimNotifications(cm);

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
    emitVimRecording();
  });
  cm.on('vim-command-done', () => {
    emit(
      'vimMode',
      formatVimMode({ mode: cm.state.vim?.mode ?? 'normal' }),
    );
    emitVimRecording();
  });
  emit('vimMode', formatVimMode({ mode: cm.state.vim?.mode ?? 'normal' }));
  emitVimRecording();
}

const SOURCE_FALLBACK: Record<string, string> = {
  constant: 'number',
  parameter: 'variable',
  property: 'variable',
  attribute: 'variable',
  punctuation: 'operator',
};

function codeSyntaxColor(name: string): string {
  return `var(--code-syntax-${name}, var(--syntax-${SOURCE_FALLBACK[name] ?? name}))`;
}

const syntaxTheme = HighlightStyle.define([
  { tag: tags.keyword, color: codeSyntaxColor('keyword') },
  {
    tag: [tags.atom, tags.bool, tags.number, tags.integer, tags.float],
    color: codeSyntaxColor('number'),
  },
  {
    tag: [tags.string, tags.character],
    color: codeSyntaxColor('string'),
  },
  {
    tag: [tags.comment, tags.meta],
    color: codeSyntaxColor('comment'),
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace],
    color: codeSyntaxColor('type'),
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: codeSyntaxColor('function'),
  },
  {
    tag: [tags.variableName, tags.propertyName, tags.attributeName],
    color: codeSyntaxColor('variable'),
  },
  {
    tag: [
      tags.constant(tags.variableName),
      tags.standard(tags.variableName),
      tags.self,
    ],
    color: codeSyntaxColor('constant'),
  },
  {
    tag: tags.propertyName,
    color: codeSyntaxColor('property'),
  },
  {
    tag: tags.attributeName,
    color: codeSyntaxColor('attribute'),
  },
  {
    tag: [tags.operator, tags.operatorKeyword],
    color: codeSyntaxColor('operator'),
  },
  {
    tag: [tags.punctuation, tags.separator, tags.bracket],
    class: 'cm-code-punctuation',
  },
  {
    tag: [tags.tagName, tags.angleBracket],
    color: codeSyntaxColor('tag'),
  },
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

function buildCodeBlockDecorations(
  view: EditorView,
  className: string,
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
            Decoration.line({ class: className }).range(line.from),
          );
        }
        return false;
      },
    });
  }

  return Decoration.set(decorations, true);
}

const refreshCodeHighlight = StateEffect.define<null>();
const CODE_HIGHLIGHT_REFRESH_DELAY = 80;
let codeHighlightTimer = 0;

function scheduleCodeHighlightRefresh(view: EditorView): void {
  if (codeHighlightTimer) window.clearTimeout(codeHighlightTimer);
  codeHighlightTimer = window.setTimeout(() => {
    codeHighlightTimer = 0;
    if (!view.dom.isConnected) return;
    view.dispatch({ effects: refreshCodeHighlight.of(null) });
  }, CODE_HIGHLIGHT_REFRESH_DELAY);
}

function codeBlockLinePlugin(className: string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildCodeBlockDecorations(view, className);
      }

      update(update: ViewUpdate): void {
        const refresh = update.transactions.some((transaction) =>
          transaction.effects.some((effect) =>
            effect.is(refreshCodeHighlight),
          ),
        );
        if (refresh || update.viewportChanged) {
          this.decorations = buildCodeBlockDecorations(
            update.view,
            className,
          );
        } else if (update.docChanged) {
          scheduleCodeHighlightRefresh(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}

const plainCodeBlocks = codeBlockLinePlugin('cm-codeblock-plain');
const themedCodeBlocks = codeBlockLinePlugin('cm-codeblock-themed');

function sourceHighlightExtension(enabled: boolean) {
  return enabled
    ? [themedCodeBlocks]
    : [plainCodeBlocks, plainCodeBlockTheme];
}

interface VimLinewiseState {
  visualMode?: boolean;
  visualLine?: boolean;
}

function vimLinewiseActive(view: EditorView): boolean {
  const cm = (
    view as unknown as {
      cm?: { state?: { vim?: VimLinewiseState } };
    }
  ).cm;
  const vim = cm?.state?.vim;
  return Boolean(vim?.visualMode && vim?.visualLine);
}

class VimLinewiseEmptyWidget extends WidgetType {
  eq(other: WidgetType): boolean {
    return other instanceof VimLinewiseEmptyWidget;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-vim-linewise-selection';
    // Two non-breaking spaces render a visible, text-height highlight on
    // empty lines, matching how VS Code still paints a small selection there.
    span.textContent = '\u00a0\u00a0';
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function buildVimLinewiseDecorations(
  view: EditorView,
): DecorationSet {
  if (!vimLinewiseActive(view)) return Decoration.none;
  const decorations: Range<Decoration>[] = [];
  for (const range of view.state.selection.ranges) {
    if (range.empty) continue;
    const first = view.state.doc.lineAt(range.from).number;
    const last = view.state.doc.lineAt(range.to).number;
    for (let number = first; number <= last; number += 1) {
      const line = view.state.doc.line(number);
      if (line.to <= line.from) {
        decorations.push(
          Decoration.widget({
            widget: new VimLinewiseEmptyWidget(),
            side: 0,
          }).range(line.from),
        );
      } else {
        decorations.push(
          Decoration.mark({
            class: 'cm-vim-linewise-selection',
          }).range(line.from, line.to),
        );
      }
    }
  }
  decorations.sort((left, right) => left.from - right.from);
  return Decoration.set(decorations, true);
}

const vimLinewiseSelection = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private view: EditorView;

    constructor(view: EditorView) {
      this.view = view;
      this.decorations = buildVimLinewiseDecorations(view);
      view.dom.classList.toggle(
        'cm-vim-linewise',
        vimLinewiseActive(view),
      );
    }

    update(update: ViewUpdate): void {
      if (
        !update.docChanged &&
        !update.selectionSet &&
        !update.viewportChanged
      ) {
        return;
      }
      this.decorations = buildVimLinewiseDecorations(update.view);
      update.view.dom.classList.toggle(
        'cm-vim-linewise',
        vimLinewiseActive(update.view),
      );
    }

    destroy(): void {
      this.view.dom.classList.remove('cm-vim-linewise');
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    fontSize: 'calc(var(--content-font-size, 15px) * 1.25)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'var(--mono-font)',
    lineHeight: 'calc(var(--content-font-size, 15px) * 1.75)',
  },
  '.cm-content': {
    padding: '14px 18px',
    caretColor: 'var(--editor-caret, var(--ink))',
    color: 'var(--ink)',
  },
  '.cm-codeblock-themed': {
    backgroundColor: 'transparent',
    color: 'var(--ink)',
  },
  '.cm-code-punctuation': {
    color: 'var(--syntax-operator)',
  },
  '.cm-codeblock-themed .cm-code-punctuation': {
    color: 'var(--code-syntax-punctuation, var(--ink))',
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
  '.cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'var(--editor-selection)',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'var(--editor-selection)',
  },
  '.cm-vimMode .cm-line::selection, .cm-vimMode .cm-line ::selection': {
    backgroundColor: 'transparent',
  },
  '.cm-fat-cursor': {
    height:
      'calc(var(--content-font-size, 15px) * 1.75) !important',
    lineHeight:
      'calc(var(--content-font-size, 15px) * 1.75) !important',
    fontSize:
      'calc(var(--content-font-size, 15px) * 1.25) !important',
    marginTop:
      'calc(var(--content-font-size, 15px) * -0.125)',
    backgroundColor: '#f5f0e6 !important',
    color: '#1f2933 !important',
    borderRadius: '0',
    boxShadow: '0 0 0 1px rgba(31, 41, 51, 0.22)',
  },
  '&:not(.cm-focused) .cm-fat-cursor': {
    outline: '1px solid #f5f0e6',
    backgroundColor: 'transparent !important',
  },
  '&.cm-vim-linewise .cm-selectionBackground': {
    backgroundColor: 'transparent !important',
  },
  '&.cm-vim-linewise > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'transparent !important',
  },
  '.cm-vim-linewise-selection': {
    backgroundColor: 'var(--editor-selection)',
    borderRadius: '2px',
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

const HEADING_REFRESH_DELAY = 120;
let headingRefreshTimer = 0;

function scheduleHeadingCollection(): void {
  if (headingRefreshTimer) window.clearTimeout(headingRefreshTimer);
  headingRefreshTimer = window.setTimeout(() => {
    headingRefreshTimer = 0;
    if (!view) return;
    headings = collectHeadings(view.state);
    refreshHeadingTrail();
  }, HEADING_REFRESH_DELAY);
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

let vimFoldCommandsRegistered = false;

function vimTarget(cm: unknown): EditorView | null {
  return vimViewOf(cm) ?? view;
}

function setupVimFoldCommands(): void {
  if (vimFoldCommandsRegistered) return;

  Vim.defineAction('inkerFoldToggle', (cm) => {
    const target = vimTarget(cm);
    if (target) toggleVimFold(target);
  });
  Vim.defineAction('inkerFoldClose', (cm) => {
    const target = vimTarget(cm);
    if (target) closeVimFold(target);
  });
  Vim.defineAction('inkerFoldOpen', (cm) => {
    const target = vimTarget(cm);
    if (target) openVimFold(target);
  });
  Vim.defineAction('inkerFoldCloseAll', (cm) => {
    const target = vimTarget(cm);
    if (target) closeAllVimFolds(target);
  });
  Vim.defineAction('inkerFoldOpenAll', (cm) => {
    const target = vimTarget(cm);
    if (target) openAllVimFolds(target);
  });

  const mappings: ReadonlyArray<[string, string]> = [
    ['za', 'inkerFoldToggle'],
    ['zc', 'inkerFoldClose'],
    ['zo', 'inkerFoldOpen'],
    ['zC', 'inkerFoldClose'],
    ['zO', 'inkerFoldOpen'],
    ['zM', 'inkerFoldCloseAll'],
    ['zR', 'inkerFoldOpenAll'],
  ];
  for (const [keys, action] of mappings) {
    Vim.mapCommand(keys, 'action', action, {}, { context: 'normal' });
  }

  vimFoldCommandsRegistered = true;
}

function setupVimSurroundCommands(): void {
  if (vimSurroundRegistered) return;

  const offsetFor = (target: EditorView, pos: { line: number; ch: number }) =>
    target.state.doc.line(pos.line + 1).from + pos.ch;

  Vim.defineOperator('inkerSurroundAdd', (cm, _args, ranges, _oldAnchor, newHead) => {
    const target = vimTarget(cm);
    if (!target) return;
    surroundPending = {
      kind: 'add',
      ranges: ranges.map((range) => ({
        from: offsetFor(target, range.anchor),
        to: offsetFor(target, range.head),
      })),
    };
    const end = ranges[ranges.length - 1];
    const cursor =
      (end ? offsetFor(target, newHead ?? end.head) : 0) || 0;
    target.dispatch({ selection: { anchor: cursor } });
    target.focus();
  });

  Vim.defineAction('inkerSurroundLine', (cm) => {
    const target = vimTarget(cm);
    if (!target) return;
    const line = target.state.doc.lineAt(
      target.state.selection.main.head,
    );
    surroundPending = {
      kind: 'add',
      ranges: [{ from: line.from, to: line.to }],
    };
    target.focus();
  });

  Vim.defineAction('inkerSurroundChange', (cm) => {
    const target = vimTarget(cm);
    if (!target) return;
    surroundPending = { kind: 'change', stage: 'old' };
    target.focus();
  });

  Vim.defineAction('inkerSurroundDelete', (cm) => {
    const target = vimTarget(cm);
    if (!target) return;
    surroundPending = { kind: 'delete' };
    target.focus();
  });

  Vim.defineAction('inkerSurroundVisual', (cm) => {
    const target = vimTarget(cm);
    if (!target) return;
    const ranges = target.state.selection.ranges
      .filter((range) => !range.empty)
      .map((range) => ({ from: range.from, to: range.to }));
    if (ranges.length === 0) return;
    surroundPending = { kind: 'add', ranges };
    Vim.exitVisualMode(cm);
    target.focus();
  });

  Vim.mapCommand('ys', 'operator', 'inkerSurroundAdd', {}, {
    context: 'normal',
  });
  Vim.mapCommand('yss', 'action', 'inkerSurroundLine', {}, {
    context: 'normal',
  });
  Vim.mapCommand('cs', 'action', 'inkerSurroundChange', {}, {
    context: 'normal',
  });
  Vim.mapCommand('ds', 'action', 'inkerSurroundDelete', {}, {
    context: 'normal',
  });
  Vim.mapCommand('gs', 'operator', 'inkerSurroundAdd', {}, {
    context: 'normal',
  });
  Vim.mapCommand('S', 'action', 'inkerSurroundVisual', {}, {
    context: 'visual',
  });

  vimSurroundRegistered = true;
}

function setupVimCommands(): void {
  const context: VimExContext = {
    save: () => emit('saveRequest'),
    pasteImage: () => void pasteImageFromClipboard(),
    openNote: (path) => {
      if (path) emit('openNote', path);
    },
    closeTab: (force) => emit('closeTab', force),
    saveAndCloseTab: () => emit('saveAndCloseTab'),
    switchTab: (direction) => emit('switchTab', direction),
    resolveNotePath: (input) =>
      resolveVimNotePath(input, props.notePath),
  };

  for (const command of APP_VIM_EX_COMMANDS) {
    Vim.defineEx(command.name, command.prefix ?? command.name, (_cm, params) =>
      command.run(context, params),
    );
  }

  Vim.defineAction('inkerPasteImage', () => {
    void pasteImageFromClipboard();
  });
  Vim.defineAction('inkerSave', () => {
    emit('saveRequest');
  });
  setupVimFoldCommands();
  setupVimSurroundCommands();
  applyVimMappings();
}

onMounted(() => {
  if (!host.value) {
    return;
  }
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
        vimLinewiseSelection,
        EditorView.domEventHandlers({
          paste: (event, editorView) => {
            if (props.readOnly) return false;
            const position = editorView.state.selection.main.from;
            const files = imageFilesFrom(event.clipboardData);
            if (files.length > 0) {
              event.preventDefault();
              void uploadImages(editorView, files, position);
              return true;
            }
            if (hasClipboardText(event.clipboardData)) return false;
            event.preventDefault();
            void pasteClipboardFallback(editorView, position);
            return true;
          },
          drop: (event, editorView) => {
            if (props.readOnly) return false;
            const files = imageFilesFrom(event.dataTransfer);
            if (files.length === 0) return false;
            event.preventDefault();
            const position =
              editorView.posAtCoords({
                x: event.clientX,
                y: event.clientY,
              }) ?? editorView.state.selection.main.from;
            void uploadImages(editorView, files, position);
            return true;
          },
        }),
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
            scheduleHeadingCollection();
            scheduleScrollSync();
          }
          if (update.docChanged || update.selectionSet) {
            emitCursor();
            refreshHeadingTrail();
            centerSelection();
            minimap?.handleUpdate(update);
          }
        }),
      ],
    }),
  });
  scrollElement = view.scrollDOM;
  scrollElement.addEventListener('scroll', handleScroll, { passive: true });
  if (
    minimapHost.value &&
    minimapBaseCanvas.value &&
    minimapOverlayCanvas.value &&
    minimapViewport.value &&
    minimapScrollbar.value &&
    minimapScrollbarThumb.value
  ) {
    minimap = new EditorMinimap({
      view,
      host: minimapHost.value,
      baseCanvas: minimapBaseCanvas.value,
      overlayCanvas: minimapOverlayCanvas.value,
      slider: minimapViewport.value,
      scrollbar: minimapScrollbar.value,
      scrollbarThumb: minimapScrollbarThumb.value,
      enabled: props.minimapEnabled,
      scale: props.minimapScale,
      maxColumn: props.minimapMaxColumn,
    });
  }
  resizeObserver = new ResizeObserver(() => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      emitScrollSync();
    });
  });
  resizeObserver.observe(scrollElement);
  view.dom.addEventListener('focusin', syncVimClipboardRegister);
  window.addEventListener('focus', syncVimClipboardRegister);
  document.addEventListener('keydown', handleVimPromptKeyDown, true);
  document.addEventListener('keydown', handleVimSurroundKey, true);
  syncVimClipboardRegister();
  view.focus();
  scheduleScrollSync();
  emitCursor();
  headings = collectHeadings(view.state);
  refreshHeadingTrail();
  scheduleVimStatus();
  try {
    setupVimCommands();
  } catch (error) {
    console.error('Failed to set up Vim commands', error);
  }
});

watch(
  () => props.vimEnabled,
  (enabled) => {
    if (!enabled) {
      cancelImagePrompt?.();
      surroundPending = null;
    }
    view?.dispatch({
      effects: vimCompartment.reconfigure(enabled ? vimExtension : []),
    });
    scheduleVimStatus();
    applyVimMappings();
    if (enabled) syncVimClipboardRegister();
    view?.focus();
  },
);

watch(
  () => props.vimMappings,
  () => applyVimMappings(),
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
  () => props.highlightRevision,
  () => {
    view?.dispatch({ effects: refreshCodeHighlight.of(null) });
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
  () => [
    props.minimapEnabled,
    props.minimapScale,
    props.minimapMaxColumn,
  ],
  () => {
    minimap?.setOptions({
      enabled: props.minimapEnabled,
      scale: props.minimapScale,
      maxColumn: props.minimapMaxColumn,
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
      minimap?.refresh();
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
  if (headingRefreshTimer) {
    window.clearTimeout(headingRefreshTimer);
    headingRefreshTimer = 0;
  }
  if (codeHighlightTimer) {
    window.clearTimeout(codeHighlightTimer);
    codeHighlightTimer = 0;
  }
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
  minimap?.destroy();
  minimap = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  scrollElement?.removeEventListener('scroll', handleScroll);
  scrollElement = null;
  cancelImagePrompt?.();
  cancelImagePrompt = null;
  view?.dom.removeEventListener('focusin', syncVimClipboardRegister);
  window.removeEventListener('focus', syncVimClipboardRegister);
  document.removeEventListener('keydown', handleVimPromptKeyDown, true);
  document.removeEventListener('keydown', handleVimSurroundKey, true);
  surroundPending = null;
  clearVimMappings();
  cancelPendingRestoreScroll();
  view?.destroy();
  view = null;
});

let pendingRestoreFrame = 0;

function cancelPendingRestoreScroll(): void {
  if (!pendingRestoreFrame) return;
  cancelAnimationFrame(pendingRestoreFrame);
  pendingRestoreFrame = 0;
}

function revealLine(lineNumber: number, column = 1): void {
  if (!view) return;
  cancelPendingRestoreScroll();
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
  cancelPendingRestoreScroll();
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

  cancelPendingRestoreScroll();
  const top = Math.max(0, state.scrollTop);
  pendingRestoreFrame = requestAnimationFrame(() => {
    pendingRestoreFrame = 0;
    if (!view || !scrollElement) return;
    scrollElement.scrollTop = top;
    view.focus();
  });
}

/**
 * Mirrors the system clipboard into Vim's unnamed register so normal-mode
 * p / P can paste text copied outside the editor. Internal yank/delete
 * registers remain in effect until the next focus sync.
 */
const vimHistoryState = new WeakMap<
  HTMLInputElement,
  { index: number; draft: string }
>();

function navigateVimHistory(
  input: HTMLInputElement,
  direction: -1 | 1,
): void {
  const history = loadVimCommandHistory();
  if (history.length === 0) return;

  let state = vimHistoryState.get(input);
  if (!state) {
    state = { index: history.length, draft: input.value };
    vimHistoryState.set(input, state);
  }

  if (direction < 0) {
    if (state.index <= 0) return;
    state.index -= 1;
  } else {
    if (state.index >= history.length) return;
    state.index += 1;
  }

  const value =
    state.index >= history.length ? state.draft : history[state.index];
  input.value = value;
  input.setSelectionRange(value.length, value.length);
}

function deleteWordBeforeCursor(input: HTMLInputElement): void {
  const value = input.value;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? start;

  if (start !== end) {
    input.value = value.slice(0, start) + value.slice(end);
    input.setSelectionRange(start, start);
    return;
  }

  const before = value.slice(0, start);
  const cut = before.replace(/\s+$/, '').replace(/\S+$/, '').length;
  input.value = value.slice(0, cut) + value.slice(start);
  input.setSelectionRange(cut, cut);
}

function applySurroundChar(
  target: EditorView,
  character: string,
): void {
  const pending = surroundPending;
  surroundPending = null;
  if (!pending) return;

  if (pending.kind === 'add') {
    const spec = surroundPair(character);
    if (spec) {
      const first = pending.ranges[0];
      const anchor =
        Math.min(first.from, first.to) + spec.open.length;
      target.dispatch({
        changes: addSurroundChanges(pending.ranges, spec),
        selection: { anchor },
      });
      target.focus();
    }
    return;
  }

  if (pending.kind === 'delete') {
    const pair = findSurroundPair(
      target.state.doc.toString(),
      target.state.selection.main.head,
      character,
    );
    if (pair) {
      target.dispatch({ changes: deleteSurroundChanges(pair) });
      target.focus();
    }
    return;
  }

  if (pending.kind === 'change' && pending.stage === 'old') {
    const pair = findSurroundPair(
      target.state.doc.toString(),
      target.state.selection.main.head,
      character,
    );
    if (pair) {
      surroundPending = { kind: 'change', stage: 'new', pair };
      target.focus();
    }
    return;
  }

  if (pending.kind === 'change' && pending.stage === 'new') {
    const spec = surroundPair(character);
    if (spec) {
      target.dispatch({
        changes: replaceSurroundChanges(pending.pair, spec),
      });
      target.focus();
    }
  }
}

function handleVimSurroundKey(event: KeyboardEvent): void {
  if (!surroundPending || !view || !props.vimEnabled) return;
  if (!view.dom.contains(document.activeElement)) {
    surroundPending = null;
    return;
  }

  if (event.key === 'Escape') {
    surroundPending = null;
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    surroundPending = null;
    return;
  }

  const character = event.key;
  if (character.length !== 1) {
    event.preventDefault();
    event.stopPropagation();
    surroundPending = null;
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  applySurroundChar(view, character);
}

function handleVimPromptKeyDown(event: KeyboardEvent): void {
  if (!props.vimEnabled) return;
  const cm = view ? getCM(view) : null;
  const dialog = (
    cm?.state as { dialog?: HTMLElement | null } | undefined
  )?.dialog;
  if (!dialog) return;

  const input = dialog.querySelector('input');
  if (!(input instanceof HTMLInputElement)) return;
  if (document.activeElement !== input) return;

  const prefix = dialog.querySelector('span')?.textContent?.trim();
  if (prefix !== ':' && prefix !== '/' && prefix !== '?') return;

  if (
    prefix !== ':' &&
    event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    event.key.toLowerCase() === 'w'
  ) {
    event.preventDefault();
    event.stopPropagation();
    deleteWordBeforeCursor(input);
    return;
  }

  if (prefix !== ':') return;

  if (event.key === 'Tab') {
    event.preventDefault();
    event.stopPropagation();
    vimHistoryState.delete(input);
    completeVimCommandLine(
      input,
      { notePath: props.notePath, files: props.files },
      !event.shiftKey,
    );
    return;
  }

  if (event.key === 'Enter') {
    recordVimCommand(input.value);
    vimHistoryState.delete(input);
    return;
  }

  if (event.key === 'Escape' || event.key === 'Esc') {
    vimHistoryState.delete(input);
    return;
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    event.stopPropagation();
    navigateVimHistory(input, event.key === 'ArrowUp' ? -1 : 1);
    return;
  }

  if (
    event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    event.key.toLowerCase() === 'w'
  ) {
    event.preventDefault();
    event.stopPropagation();
    vimHistoryState.delete(input);
    deleteWordBeforeCursor(input);
    return;
  }

  vimHistoryState.delete(input);
}

function syncVimClipboardRegister(): void {
  if (!view || !props.vimEnabled) return;
  const target = view;
  void readClipboardText().then((text) => {
    if (!text || !target.dom.isConnected) return;
    const cm = getCM(target);
    const vim = cm?.state.vim as
      | {
          registers?: {
            unnamedRegister?: {
              setText?: (
                value?: string,
                linewise?: boolean,
                blockwise?: boolean,
              ) => void;
            };
          };
        }
      | undefined;
    vim?.registers?.unnamedRegister?.setText?.(text, false);
  });
}

function notifyVim(message: string): void {
  if (!view) return;
  const cm = getCM(view);
  if (!cm) return;
  const span = document.createElement('span');
  span.className = 'cm-vim-message';
  span.textContent = message;
  cm.openNotification(span, { bottom: true, duration: 4000 });
}

async function pasteImageFromClipboard(): Promise<void> {
  if (!view || props.readOnly) return;

  try {
    const file = await readClipboardImageFile();
    if (!file) {
      notifyVim(t('imagePaste.clipboardEmpty'));
      return;
    }
    const result = await props.requestImageSave(file);
    if (!result || !view?.dom.isConnected) return;
    insertMarkdownImage(
      view,
      result.source,
      result.alt,
      view.state.selection.main.from,
    );
  } catch {
    notifyVim(t('imagePaste.clipboardUnavailable'));
  }
}

function insertMarkdownImage(
  editorView: EditorView,
  source: string,
  alt: string,
  position: number,
): void {
  const markdown = `![${alt}](${source})`;
  const from = Math.min(
    Math.max(0, position),
    editorView.state.doc.length,
  );
  editorView.dispatch({
    changes: { from, insert: markdown },
    selection: { anchor: from + markdown.length },
    scrollIntoView: true,
  });
  editorView.focus();
}

async function pasteClipboardFallback(
  editorView: EditorView,
  position: number,
): Promise<void> {
  const text = await readClipboardText();
  if (text !== null) {
    if (!editorView.dom.isConnected) return;
    const { from, to } = editorView.state.selection.main;
    editorView.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
      scrollIntoView: true,
    });
    editorView.focus();
    return;
  }
  await uploadClipboardImage(editorView, position);
}

async function uploadClipboardImage(
  editorView: EditorView,
  position: number,
): Promise<void> {
  try {
    const file = await readClipboardImageFile();
    if (!file) return;
    const result = await props.requestImageSave(file);
    if (!result || !editorView.dom.isConnected) return;
    insertMarkdownImage(editorView, result.source, result.alt, position);
  } catch {
    // The clipboard has no readable image.
  }
}

async function uploadImages(
  editorView: EditorView,
  files: File[],
  position: number,
): Promise<void> {
  let next = position;
  for (const file of files) {
    const result = await props.requestImageSave(file);
    if (!result || !editorView.dom.isConnected) return;
    insertMarkdownImage(editorView, result.source, result.alt, next);
    next = editorView.state.selection.main.from;
  }
}

function promptImageName(
  defaultName: string,
  extension?: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const cm = view ? getCM(view) : null;
    if (!cm) {
      resolve(null);
      return;
    }
    cancelImagePrompt?.();

    let settled = false;
    const settle = (value: string | null): void => {
      if (settled) return;
      settled = true;
      cancelImagePrompt = null;
      resolve(value);
    };

    const template = document.createElement('span');
    template.className = 'vim-image-prompt';
    const label = document.createElement('span');
    label.className = 'vim-image-prompt-label';
    label.textContent = extension
      ? `${t('imagePaste.vimPrompt')} (.${extension})`
      : t('imagePaste.vimPrompt');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'vim-image-prompt-input';
    input.value = defaultName;
    template.append(label, input);

    const close = cm.openDialog(
      template,
      (value: string) => {
        const trimmed = String(value ?? '').trim();
        settle(trimmed === '' ? defaultName : trimmed);
      },
      {
        value: defaultName,
        selectValueOnOpen: true,
        onClose: () => settle(null),
      },
    );
    cancelImagePrompt = () => {
      close();
      settle(null);
    };
  });
}

function insertBlock(text: string): boolean {
  if (!view || props.readOnly) return false;
  const { from, to } = view.state.selection.main;
  const insertion = withBlockSpacing(
    view.state.doc.toString(),
    from,
    to,
    text,
  );
  view.dispatch({
    changes: { from, to, insert: insertion.text },
    selection: { anchor: insertion.cursor },
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

function refresh(): void {
  if (!view) return;
  view.requestMeasure();
  view.focus();
}

defineExpose({
  revealLine,
  refresh,
  scrollToLine,
  captureState,
  restoreState,
  promptImageName,
  insertBlock,
});
</script>

<template>
  <div class="editor-shell">
    <Breadcrumbs :items="breadcrumbs" />
    <div class="editor-body">
      <div ref="host" class="editor-host"></div>
      <div
        ref="minimapHost"
        class="minimap"
        aria-hidden="true"
      >
        <canvas
          ref="minimapBaseCanvas"
          class="minimap-canvas minimap-base"
        ></canvas>
        <canvas
          ref="minimapOverlayCanvas"
          class="minimap-canvas minimap-overlay"
        ></canvas>
        <div
          ref="minimapViewport"
          class="minimap-viewport"
        ></div>
      </div>
      <div
        ref="minimapScrollbar"
        class="editor-scrollbar"
        role="scrollbar"
        :aria-label="t('editor.scrollbar')"
        aria-orientation="vertical"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="0"
        tabindex="0"
      >
        <div
          ref="minimapScrollbarThumb"
          class="editor-scrollbar-thumb"
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
  overflow: hidden;
  background: var(--panel);
  cursor: pointer;
  touch-action: none;
}

.minimap-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.minimap-base {
  z-index: 0;
}

.minimap-overlay {
  z-index: 1;
}

.minimap-viewport {
  position: absolute;
  z-index: 2;
  top: 0;
  right: 2px;
  left: 2px;
  box-sizing: border-box;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  opacity: 0.92;
  pointer-events: none;
  transition:
    background 80ms ease,
    border-color 80ms ease,
    box-shadow 80ms ease;
}

.minimap:hover .minimap-viewport,
.minimap.is-focused .minimap-viewport,
.minimap.is-dragging .minimap-viewport {
  background: var(
    --minimap-slider-hover-bg,
    rgba(255, 255, 255, 0.16)
  );
  border-color: var(
    --minimap-slider-hover-border,
    rgba(255, 255, 255, 0.55)
  );
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06);
}

.editor-scrollbar {
  position: relative;
  flex: none;
  width: 12px;
  outline: none;
  background: transparent;
  cursor: pointer;
  touch-action: none;
}

.editor-scrollbar:hover {
  background: var(--hover);
}

.editor-scrollbar:focus-visible {
  box-shadow: inset 0 0 0 1px var(--accent);
}

.editor-scrollbar-thumb {
  position: absolute;
  top: 0;
  left: 3px;
  width: 6px;
  border-radius: 3px;
  background: var(--faint);
  opacity: 0.55;
  transition:
    background 80ms ease,
    opacity 80ms ease;
}

.editor-scrollbar:hover .editor-scrollbar-thumb,
.editor-scrollbar:focus-visible .editor-scrollbar-thumb,
.editor-scrollbar.is-dragging .editor-scrollbar-thumb {
  background: var(--muted);
  opacity: 1;
}

.editor-host :deep(.cm-editor) {
  height: 100%;
}

.editor-host :deep(.cm-scroller) {
  scrollbar-width: none;
}

.editor-host :deep(.cm-scroller::-webkit-scrollbar) {
  width: 0;
  height: 0;
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
