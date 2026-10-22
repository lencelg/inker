<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { basicSetup } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, placeholder } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { vim } from '@replit/codemirror-vim';

const props = defineProps<{
  initialContent: string;
  vimEnabled: boolean;
  readOnly: boolean;
}>();

const emit = defineEmits<{
  change: [content: string];
  scrollSync: [position: { line: number; ratio: number }];
}>();

const host = ref<HTMLDivElement | null>(null);
const vimCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const vimExtension = vim({ status: true });

let view: EditorView | null = null;
let scrollElement: HTMLElement | null = null;
let scrollFrame = 0;

const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    fontSize: '13.5px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily:
      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    lineHeight: '1.75',
  },
  '.cm-content': {
    padding: '20px 22px',
    caretColor: 'var(--ink)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-soft)',
    border: 'none',
    borderRight: '1px solid var(--border)',
    color: 'var(--faint)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(31, 41, 51, 0.035)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(31, 41, 51, 0.06)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
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
        basicSetup,
        markdown(),
        placeholder('从这里开始写…'),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': 'Markdown 内容' }),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emit('change', update.state.doc.toString());
            scheduleScrollSync();
          }
        }),
      ],
    }),
  });
  scrollElement = view.scrollDOM;
  scrollElement.addEventListener('scroll', handleScroll, { passive: true });
  view.focus();
  scheduleScrollSync();
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
  scrollElement?.removeEventListener('scroll', handleScroll);
  scrollElement = null;
  view?.destroy();
  view = null;
});
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
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
