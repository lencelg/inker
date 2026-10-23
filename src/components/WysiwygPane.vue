<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  rootCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import {
  commonmark,
  codeBlockSchema,
  imageSchema,
} from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { cursor } from '@milkdown/kit/plugin/cursor';
import { history } from '@milkdown/kit/plugin/history';
import { indent } from '@milkdown/kit/plugin/indent';
import { math } from '@milkdown/plugin-math';
import { trailing } from '@milkdown/kit/plugin/trailing';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import {
  Decoration,
  DecorationSet,
  type EditorView,
} from '@milkdown/kit/prose/view';
import { $prose, $view, getMarkdown } from '@milkdown/kit/utils';
import { api } from '../api';
import {
  applyLineEnding,
  normalizeLineEndings,
  usesCrlf,
} from '../lib/lineEndings';
import { isLocalImageSource } from '../lib/markdown';
import { renderMermaid } from '../lib/mermaid';
import { createProseMultiCursorPlugin } from '../lib/proseMultiCursor';

const props = defineProps<{
  initialContent: string;
  notePath: string;
  readOnly: boolean;
  immersive: boolean;
}>();

const emit = defineEmits<{ change: [content: string] }>();

const host = ref<HTMLDivElement | null>(null);
const error = ref('');
const imageCache = new Map<string, string>();
const keepsCrlf = usesCrlf(props.initialContent);
const initialMarkdown = normalizeLineEndings(props.initialContent);
let editor: Editor | null = null;
let disposed = false;
let ready = false;
let lastMarkdown = initialMarkdown;
let errorTimer = 0;

function showError(message: string): void {
  error.value = message;
  if (errorTimer) window.clearTimeout(errorTimer);
  errorTimer = window.setTimeout(() => {
    error.value = '';
    errorTimer = 0;
  }, 5000);
}

const imageView = $view(imageSchema.node, () => (node) => {
  const image = document.createElement('img');
  image.className = 'wysiwyg-image';
  let source = '';
  let attempt = 0;

  const render = (next: typeof node): void => {
    const src = String(next.attrs.src ?? '');
    const alt = String(next.attrs.alt ?? '');
    const title = String(next.attrs.title ?? '');
    image.alt = alt;
    if (title) image.title = title;
    else image.removeAttribute('title');
    if (src === source) return;

    source = src;
    const run = ++attempt;
    image.classList.remove('md-image-missing', 'md-image-loading');

    if (!src) {
      image.removeAttribute('src');
      return;
    }
    if (!isLocalImageSource(src)) {
      image.src = src;
      return;
    }

    const key = `${props.notePath}\u0000${src}`;
    const cached = imageCache.get(key);
    if (cached) {
      image.src = cached;
      return;
    }

    image.classList.add('md-image-loading');
    void api
      .readAsset(props.notePath, src)
      .then((asset) => {
        const dataUrl = `data:${asset.mime};base64,${asset.data}`;
        imageCache.set(key, dataUrl);
        if (run !== attempt) return;
        image.src = dataUrl;
        image.classList.remove('md-image-loading');
      })
      .catch(() => {
        if (run !== attempt) return;
        image.classList.add('md-image-missing');
        image.classList.remove('md-image-loading');
        image.removeAttribute('src');
      });
  };

  render(node);
  return {
    dom: image,
    update: (next) => {
      render(next);
      return true;
    },
  };
});

const mermaidView = $view(codeBlockSchema.node, () => (initialNode) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'code-block-node';
  const toolbar = document.createElement('div');
  toolbar.className = 'mermaid-toolbar';
  const label = document.createElement('span');
  label.className = 'mermaid-label';
  label.textContent = 'Mermaid';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'mermaid-toggle';
  toolbar.append(label, toggle);

  const preview = document.createElement('div');
  preview.className = 'mermaid-preview';
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  pre.appendChild(code);
  wrapper.append(toolbar, preview, pre);

  let source = '';
  let run = 0;
  let showSource = false;

  const applyMode = (): void => {
    wrapper.classList.toggle('show-source', showSource);
    toggle.textContent = showSource ? '图表' : '源码';
  };

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    showSource = !showSource;
    applyMode();
  });

  const render = (node: typeof initialNode): void => {
    const language = String(node.attrs.language ?? '');
    pre.dataset.language = language;
    const isMermaid = language === 'mermaid';
    wrapper.classList.toggle('is-mermaid', isMermaid);

    if (!isMermaid) {
      run += 1;
      source = '';
      preview.replaceChildren();
      return;
    }

    const content = node.textContent;
    if (content === source) return;
    source = content;
    const attempt = ++run;
    preview.classList.remove('mermaid-error');
    preview.textContent = '正在渲染图表…';

    void renderMermaid(content)
      .then((svg) => {
        if (attempt !== run) return;
        preview.innerHTML = svg;
      })
      .catch((error) => {
        if (attempt !== run) return;
        preview.classList.add('mermaid-error');
        preview.textContent = `图表渲染失败：${
          error instanceof Error ? error.message : String(error)
        }`;
      });
  };

  render(initialNode);
  applyMode();

  return {
    dom: wrapper,
    contentDOM: code,
    update: (next) => {
      render(next);
      return true;
    },
    stopEvent: (event) => toolbar.contains(event.target as Node),
    ignoreMutation: (mutation) => !code.contains(mutation.target as Node),
    destroy: () => {
      run += 1;
    },
  };
});

let centerFrame = 0;

function findScrollParent(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}

function scheduleCenter(view: EditorView): void {
  if (!props.immersive || centerFrame) return;
  centerFrame = requestAnimationFrame(() => {
    centerFrame = 0;
    if (!props.immersive) return;
    const head = view.state.selection.head;
    const coords = view.coordsAtPos(head);
    const parent = findScrollParent(view.dom);
    if (!coords || !parent) return;
    const rect = parent.getBoundingClientRect();
    const delta =
      (coords.top + coords.bottom) / 2 - (rect.top + rect.height / 2);
    if (Math.abs(delta) > 2) {
      parent.scrollTop += delta;
    }
  });
}

const immersiveDecorations = $prose(
  () =>
    new Plugin({
      props: {
        decorations(state) {
          if (!props.immersive) return null;
          const current = state.doc.resolve(state.selection.head).index(0);
          const decorations: Decoration[] = [];
          let index = 0;
          state.doc.forEach((node, offset) => {
            if (index !== current) {
              decorations.push(
                Decoration.node(offset, offset + node.nodeSize, {
                  class: 'wysiwyg-dimmed',
                }),
              );
            }
            index += 1;
          });
          return DecorationSet.create(state.doc, decorations);
        },
      },
    }),
);

const immersiveCursor = $prose(
  () =>
    new Plugin({
      view: () => ({
        update: (view, prevState) => {
          if (!props.immersive) return;
          if (
            view.state.doc.eq(prevState.doc) &&
            view.state.selection.eq(prevState.selection)
          ) {
            return;
          }
          scheduleCenter(view);
        },
      }),
    }),
);

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];

  const fromItems = Array.from(data.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  if (fromItems.length > 0) return fromItems;

  return Array.from(data.files).filter((file) =>
    file.type.startsWith('image/'),
  );
}

function imageFileName(file: File): string {
  const name = file.name.trim();
  if (name && /\.[a-z0-9]+$/i.test(name)) return name;
  const extension = MIME_EXTENSIONS[file.type] ?? 'png';
  return `pasted-${Date.now()}.${extension}`;
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + chunkSize),
    );
  }
  return window.btoa(binary);
}

function insertImage(
  view: EditorView,
  source: string,
  alt: string,
  position?: number,
): void {
  const imageType = view.state.schema.nodes.image;
  if (!imageType) return;

  const documentSize = view.state.doc.content.size;
  const target = Math.min(
    Math.max(0, position ?? view.state.selection.from),
    documentSize,
  );
  const selection = TextSelection.near(view.state.doc.resolve(target));
  const $from = selection.$from;
  if (
    !$from.parent.canReplaceWith(
      $from.index(),
      $from.indexAfter(),
      imageType,
    )
  ) {
    showError('当前位置无法插入图片');
    return;
  }
  const node = imageType.create({
    src: source,
    alt,
    title: '',
  });
  view.dispatch(
    view.state.tr
      .setSelection(selection)
      .replaceSelectionWith(node, false),
  );
  view.focus();
}

async function uploadImages(
  view: EditorView,
  files: File[],
  position?: number,
): Promise<void> {
  let first = true;
  for (const file of files) {
    try {
      const data = await fileToBase64(file);
      const source = await api.saveImage(
        props.notePath,
        imageFileName(file),
        data,
      );
      if (!view.dom.isConnected) return;
      insertImage(
        view,
        source,
        file.name || '图片',
        first ? position : undefined,
      );
      first = false;
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  }
}

const uploadPlugin = $prose(
  () =>
    new Plugin({
      props: {
        handlePaste: (view, event) => {
          if (props.readOnly) return false;
          const files = imageFilesFrom(event.clipboardData);
          if (files.length === 0) return false;
          event.preventDefault();
          void uploadImages(view, files, view.state.selection.from);
          return true;
        },
        handleDrop: (view, event, _slice, moved) => {
          if (props.readOnly || moved) return false;
          const files = imageFilesFrom(event.dataTransfer);
          if (files.length === 0) return false;
          event.preventDefault();
          const position = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })?.pos;
          void uploadImages(view, files, position);
          return true;
        },
      },
    }),
);

const multiCursorPlugin = $prose(() =>
  createProseMultiCursorPlugin(),
);

const syncPlugin = $prose((ctx) => {
  return new Plugin({
    view: () => ({
      update: (view, prevState) => {
        if (!ready || view.state.doc.eq(prevState.doc)) return;
        const markdown = ctx.get(serializerCtx)(view.state.doc);
        if (markdown === lastMarkdown) return;
        lastMarkdown = markdown;
        emit('change', applyLineEnding(markdown, keepsCrlf));
      },
    }),
  });
});

async function createEditor(): Promise<void> {
  const target = host.value;
  if (!target) return;

  editor = Editor.make().config((ctx) => {
    ctx.set(rootCtx, target);
    ctx.set(defaultValueCtx, initialMarkdown);
    ctx.set(editorViewOptionsCtx, {
      attributes: {
        class: 'wysiwyg-content',
        'aria-label': 'Markdown 内容',
      },
      editable: () => !props.readOnly,
    });
  });

  editor
    .use(commonmark)
    .use(gfm)
    .use(math)
    .use(history)
    .use(clipboard)
    .use(cursor)
    .use(indent)
    .use(trailing)
    .use(imageView)
    .use(mermaidView)
    .use(syncPlugin)
    .use(immersiveDecorations)
    .use(immersiveCursor)
    .use(uploadPlugin)
    .use(multiCursorPlugin);

  try {
    await editor.create();
    if (disposed) {
      await editor.destroy();
      editor = null;
      return;
    }
    lastMarkdown = editor.action((ctx) => getMarkdown()(ctx));
    ready = true;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.focus();
      scheduleCenter(view);
    });
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  }
}

watch(
  () => props.immersive,
  (enabled) => {
    editor?.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.setMeta('immersive', enabled));
      if (enabled) scheduleCenter(view);
    });
  },
);

watch(
  () => props.readOnly,
  (readOnly) => {
    editor?.action((ctx) => {
      ctx.get(editorViewCtx).setProps({ editable: () => !readOnly });
    });
  },
);

onMounted(() => {
  void createEditor();
});

onBeforeUnmount(() => {
  disposed = true;
  if (centerFrame) cancelAnimationFrame(centerFrame);
  centerFrame = 0;
  if (errorTimer) window.clearTimeout(errorTimer);
  errorTimer = 0;
  const current = editor;
  editor = null;
  void current?.destroy();
});
</script>

<template>
  <section class="wysiwyg-pane">
    <div ref="host" class="wysiwyg-host"></div>
    <div v-if="error" class="wysiwyg-error" role="alert">{{ error }}</div>
  </section>
</template>

<style scoped>
.wysiwyg-pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--panel);
}

.wysiwyg-host {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.wysiwyg-host :deep(.wysiwyg-content) {
  min-height: 100%;
  padding: 32px max(40px, calc((100% - 760px) / 2)) 25vh;
  outline: none;
  color: var(--ink);
  font-size: calc(var(--content-font-size) + 1px);
  line-height: 1.75;
  overflow-wrap: break-word;
}

.wysiwyg-host :deep(.wysiwyg-content > :first-child) {
  margin-top: 0;
}

.wysiwyg-host :deep(.wysiwyg-content h1),
.wysiwyg-host :deep(.wysiwyg-content h2),
.wysiwyg-host :deep(.wysiwyg-content h3),
.wysiwyg-host :deep(.wysiwyg-content h4),
.wysiwyg-host :deep(.wysiwyg-content h5),
.wysiwyg-host :deep(.wysiwyg-content h6) {
  margin: 1.4em 0 0.6em;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.wysiwyg-host :deep(.wysiwyg-content h1) {
  font-size: 1.75em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border);
}

.wysiwyg-host :deep(.wysiwyg-content h2) {
  font-size: 1.35em;
  padding-bottom: 0.2em;
  border-bottom: 1px solid var(--border);
}

.wysiwyg-host :deep(.wysiwyg-content p) {
  margin: 0.7em 0;
}

.wysiwyg-host :deep(.wysiwyg-content a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.wysiwyg-host :deep(.wysiwyg-content code) {
  padding: 0.15em 0.35em;
  border-radius: 4px;
  background: var(--code-inline-bg);
  font-family: var(--mono-font);
  font-size: 0.9em;
}

.wysiwyg-host :deep(.wysiwyg-content pre) {
  margin: 1em 0;
  padding: 14px 16px;
  overflow-x: auto;
  border-radius: 8px;
  background: #0f141a;
  color: #e7edf4;
  font-family: var(--mono-font);
  font-size: 0.86em;
  line-height: 1.6;
}

.wysiwyg-host :deep(.wysiwyg-content pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
}

.wysiwyg-host :deep(.wysiwyg-content blockquote) {
  margin: 1em 0;
  padding: 0.2em 0 0.2em 1em;
  border-left: 3px solid var(--blockquote-border);
  color: var(--muted);
}

.wysiwyg-host :deep(.wysiwyg-content ul),
.wysiwyg-host :deep(.wysiwyg-content ol) {
  margin: 0.6em 0;
  padding-left: 1.6em;
}

.wysiwyg-host :deep(.wysiwyg-content li) {
  margin: 0.25em 0;
}

.wysiwyg-host :deep(.wysiwyg-content li[data-item-type='task']) {
  position: relative;
  padding-left: 1.5em;
  list-style: none;
}

.wysiwyg-host :deep(.wysiwyg-content li[data-item-type='task']::before) {
  position: absolute;
  top: 0.42em;
  left: 0;
  width: 13px;
  height: 13px;
  border: 1.5px solid var(--muted);
  border-radius: 3px;
  content: '';
}

.wysiwyg-host :deep(.wysiwyg-content li[data-checked='true']::before) {
  border-color: var(--accent);
  background: var(--accent);
}

.wysiwyg-host :deep(.wysiwyg-content li[data-checked='true']::after) {
  position: absolute;
  top: 0.62em;
  left: 4px;
  width: 5px;
  height: 8px;
  border-right: 2px solid #fff;
  border-bottom: 2px solid #fff;
  content: '';
  transform: rotate(45deg);
}

.wysiwyg-host :deep([data-type='math_inline']) {
  padding: 0 2px;
}

.wysiwyg-host :deep([data-type='math_block']) {
  margin: 1em 0;
  overflow-x: auto;
  text-align: center;
}

.wysiwyg-host :deep(.code-block-node) {
  margin: 1em 0;
}

.wysiwyg-host :deep(.code-block-node pre) {
  margin: 0;
}

.wysiwyg-host :deep(.mermaid-toolbar) {
  display: none;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 11px;
}

.wysiwyg-host :deep(.code-block-node.is-mermaid .mermaid-toolbar) {
  display: flex;
}

.wysiwyg-host :deep(.mermaid-label) {
  font-family: var(--mono-font);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.wysiwyg-host :deep(.mermaid-toggle) {
  padding: 2px 7px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel);
  color: var(--muted);
  font: inherit;
  cursor: pointer;
}

.wysiwyg-host :deep(.mermaid-toggle:hover) {
  background: var(--hover);
  color: var(--ink);
}

.wysiwyg-host :deep(.mermaid-preview) {
  display: none;
  padding: 14px;
  overflow-x: auto;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  text-align: center;
}

.wysiwyg-host :deep(.code-block-node.is-mermaid .mermaid-preview) {
  display: block;
}

.wysiwyg-host :deep(.code-block-node.is-mermaid.show-source .mermaid-preview) {
  display: none;
}

.wysiwyg-host :deep(.code-block-node.is-mermaid:not(.show-source) pre) {
  display: none;
}

.wysiwyg-host :deep(.mermaid-preview svg) {
  max-width: 100%;
  height: auto;
}

.wysiwyg-host :deep(.mermaid-preview.mermaid-error) {
  background: var(--error-soft);
  border-color: var(--error-border);
  color: var(--error);
  font-size: 12px;
  text-align: left;
}

.wysiwyg-host :deep(.wysiwyg-content hr) {
  margin: 1.6em 0;
  border: 0;
  border-top: 1px solid var(--border);
}

.wysiwyg-host :deep(.wysiwyg-content table) {
  width: 100%;
  margin: 1em 0;
  border-collapse: collapse;
  font-size: 0.95em;
}

.wysiwyg-host :deep(.wysiwyg-content th),
.wysiwyg-host :deep(.wysiwyg-content td) {
  padding: 7px 10px;
  border: 1px solid var(--border);
  text-align: left;
}

.wysiwyg-host :deep(.wysiwyg-content th) {
  background: var(--bg-soft);
}

.wysiwyg-host :deep(.wysiwyg-content img) {
  max-width: 100%;
  border-radius: 6px;
  vertical-align: middle;
}

.wysiwyg-host :deep(.wysiwyg-image) {
  display: inline-block;
}

.wysiwyg-host :deep(.wysiwyg-image.md-image-loading) {
  min-width: 80px;
  min-height: 34px;
  background: var(--hover);
  border-radius: 6px;
}

.wysiwyg-host :deep(.wysiwyg-image.md-image-missing) {
  min-width: 140px;
  min-height: 34px;
  background: var(--error-soft);
  border: 1px dashed var(--error-border);
}

.wysiwyg-host :deep(.ProseMirror-selectednode) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.wysiwyg-host :deep(.wysiwyg-dimmed) {
  opacity: 0.26;
  transition: opacity 120ms ease;
}

.wysiwyg-host :deep(.pm-multi-caret) {
  display: inline-block;
  width: 2px;
  height: 1.2em;
  margin-left: -1px;
  background: var(--accent);
  vertical-align: text-bottom;
}

.wysiwyg-host :deep(.pm-multi-selection) {
  background: var(--editor-selection);
}

.wysiwyg-host :deep(.ProseMirror-gapcursor::after) {
  border-top-color: var(--ink);
}

.wysiwyg-error {
  margin: 16px;
  padding: 10px 14px;
  border: 1px solid var(--error-border);
  border-radius: 8px;
  background: var(--error-soft);
  color: var(--error);
  font-size: 12.5px;
}
</style>
