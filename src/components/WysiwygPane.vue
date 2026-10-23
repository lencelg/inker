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
import { commonmark, imageSchema } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { cursor } from '@milkdown/kit/plugin/cursor';
import { history } from '@milkdown/kit/plugin/history';
import { indent } from '@milkdown/kit/plugin/indent';
import { trailing } from '@milkdown/kit/plugin/trailing';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose, $view, getMarkdown } from '@milkdown/kit/utils';
import { api } from '../api';
import { isLocalImageSource } from '../lib/markdown';

const props = defineProps<{
  initialContent: string;
  notePath: string;
  readOnly: boolean;
}>();

const emit = defineEmits<{ change: [content: string] }>();

const host = ref<HTMLDivElement | null>(null);
const error = ref('');
const imageCache = new Map<string, string>();
let editor: Editor | null = null;
let disposed = false;
let ready = false;
let lastMarkdown = props.initialContent;

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

const syncPlugin = $prose((ctx) => {
  return new Plugin({
    view: () => ({
      update: (view, prevState) => {
        if (!ready || view.state.doc.eq(prevState.doc)) return;
        const markdown = ctx.get(serializerCtx)(view.state.doc);
        if (markdown === lastMarkdown) return;
        lastMarkdown = markdown;
        emit('change', markdown);
      },
    }),
  });
});

async function createEditor(): Promise<void> {
  const target = host.value;
  if (!target) return;

  editor = Editor.make().config((ctx) => {
    ctx.set(rootCtx, target);
    ctx.set(defaultValueCtx, props.initialContent);
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
    .use(history)
    .use(clipboard)
    .use(cursor)
    .use(indent)
    .use(trailing)
    .use(imageView)
    .use(syncPlugin);

  try {
    await editor.create();
    if (disposed) {
      await editor.destroy();
      editor = null;
      return;
    }
    lastMarkdown = editor.action((ctx) => getMarkdown()(ctx));
    ready = true;
    editor.action((ctx) => ctx.get(editorViewCtx).focus());
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}

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
