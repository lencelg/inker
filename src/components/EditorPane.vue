<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { basicSetup } from 'codemirror';
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, placeholder } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { tags } from '@lezer/highlight';
import { Vim, vim } from '@replit/codemirror-vim';

const props = defineProps<{
  initialContent: string;
  vimEnabled: boolean;
  readOnly: boolean;
}>();

const emit = defineEmits<{
  change: [content: string];
  scrollSync: [position: { line: number; ratio: number }];
  cursor: [position: { line: number; column: number; ratio: number }];
  saveRequest: [];
}>();

const host = ref<HTMLDivElement | null>(null);
const vimCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const vimExtension = vim({ status: true });

let view: EditorView | null = null;
let scrollElement: HTMLElement | null = null;
let scrollFrame = 0;
let cursorFrame = 0;

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
    caretColor: 'var(--ink)',
    color: 'var(--ink)',
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
  const block = view.lineBlockAtHeight(scrollElement.scrollTop + 8);
  const line = view.state.doc.lineAt(block.from).number;
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
  const coordinates = view.coordsAtPos(head);
  let ratio = 0.5;
  if (coordinates) {
    const rect = view.scrollDOM.getBoundingClientRect();
    ratio = Math.min(
      1,
      Math.max(0, (coordinates.top - rect.top) / Math.max(1, rect.height)),
    );
  }
  emit('cursor', {
    line: line.number,
    column: head - line.from + 1,
    ratio,
  });
}

function scheduleCursorSync(): void {
  if (cursorFrame) return;
  cursorFrame = requestAnimationFrame(() => {
    cursorFrame = 0;
    emitCursor();
  });
}

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
        basicSetup,
        markdown({ codeLanguages: languages }),
        syntaxHighlighting(syntaxTheme),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        placeholder('从这里开始写…'),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': 'Markdown 内容' }),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emit('change', update.state.doc.toString());
            scheduleScrollSync();
          }
          if (update.docChanged || update.selectionSet) {
            scheduleCursorSync();
          }
        }),
      ],
    }),
  });
  scrollElement = view.scrollDOM;
  scrollElement.addEventListener('scroll', handleScroll, { passive: true });
  view.focus();
  scheduleScrollSync();
  scheduleCursorSync();
});

watch(
  () => props.vimEnabled,
  (enabled) => {
    view?.dispatch({
      effects: vimCompartment.reconfigure(enabled ? vimExtension : []),
    });
    view?.focus();
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

onBeforeUnmount(() => {
  if (scrollFrame) {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  }
  if (cursorFrame) {
    cancelAnimationFrame(cursorFrame);
    cursorFrame = 0;
  }
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

function refresh(): void {
  if (!view) return;
  view.requestMeasure();
  view.focus();
}

defineExpose({ revealLine, refresh });
</script>

<template>
  <div ref="host" class="editor-host"></div>
</template>

<style scoped>
.editor-host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.editor-host :deep(.cm-editor) {
  height: 100%;
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
