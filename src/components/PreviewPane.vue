<script setup lang="ts">
import DOMPurify from 'dompurify';
import renderMathInElement from 'katex/contrib/auto-render';
import { computed, nextTick, ref, watch } from 'vue';
import { api } from '../api';
import { isLocalImageSource } from '../lib/markdown';

const props = defineProps<{
  html: string;
  notePath: string;
  scrollRatio?: number;
}>();

// Notes may contain raw HTML, so all rendered HTML is sanitized before v-html.
const safeHtml = computed(() =>
  DOMPurify.sanitize(props.html, { ADD_ATTR: ['data-md-src'] }),
);
const bodyRef = ref<HTMLElement | null>(null);
const imageCache = new Map<string, string>();
let resolveRun = 0;

function renderMath(): void {
  if (!bodyRef.value) return;
  // Math is rendered after HTML exists, so element boundaries (e.g. <span>$</span>)
  // break delimiter pairing instead of being consumed as part of a formula.
  renderMathInElement(bodyRef.value, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
      { left: '$', right: '$', display: false },
    ],
    throwOnError: false,
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function markMissing(image: HTMLImageElement, message: string): void {
  const placeholder = document.createElement('span');
  placeholder.className = 'md-image-missing';
  placeholder.textContent = `${image.alt || '图片'}（无法加载）`;
  placeholder.title = `图片加载失败：${message}`;
  image.replaceWith(placeholder);
}

async function resolveImages(): Promise<void> {
  const root = bodyRef.value;
  if (!root) return;

  const run = ++resolveRun;
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));

  await Promise.all(
    images.map(async (image) => {
      let source = image.dataset.mdSrc ?? '';
      if (!source) {
        const current = image.getAttribute('src')?.trim() ?? '';
        if (!isLocalImageSource(current)) return;
        source = current;
        image.dataset.mdSrc = source;
        image.removeAttribute('src');
      }

      const key = `${props.notePath}\u0000${source}`;
      const cached = imageCache.get(key);
      if (cached) {
        image.src = cached;
        image.classList.remove('md-image-loading', 'md-image-missing');
        image.removeAttribute('title');
        return;
      }

      image.classList.add('md-image-loading');
      try {
        const asset = await api.readAsset(props.notePath, source);
        const dataUrl = `data:${asset.mime};base64,${asset.data}`;
        imageCache.set(key, dataUrl);
        if (run !== resolveRun || !image.isConnected) return;
        image.src = dataUrl;
        image.classList.remove('md-image-loading', 'md-image-missing');
        image.removeAttribute('title');
      } catch (error) {
        if (run !== resolveRun || !image.isConnected) return;
        markMissing(image, errorMessage(error));
      }
    }),
  );

  if (run === resolveRun) {
    applyScrollRatio();
  }
}

function applyScrollRatio(): void {
  const element = bodyRef.value;
  if (!element) return;
  const maximum = element.scrollHeight - element.clientHeight;
  if (maximum <= 0) return;
  const ratio = Math.min(1, Math.max(0, props.scrollRatio ?? 0));
  element.scrollTop = ratio * maximum;
}

watch(
  [() => props.html, () => props.notePath],
  async ([html]) => {
    await nextTick();
    if (!html) return;
    renderMath();
    await resolveImages();
  },
  { immediate: true },
);

watch(
  () => props.scrollRatio,
  async () => {
    await nextTick();
    applyScrollRatio();
  },
);
</script>

<template>
  <section class="preview-pane">
    <header class="pane-header">
      <span class="pane-title">预览</span>
    </header>

    <div v-if="html" ref="bodyRef" class="markdown-body" v-html="safeHtml"></div>
    <div v-else class="preview-empty">
      <span class="preview-icon">&lt;/&gt;</span>
      <p>开始输入 Markdown，预览会实时更新。</p>
    </div>
  </section>
</template>

<style scoped>
.preview-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
}

.preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.preview-empty p {
  max-width: 280px;
  margin: 0;
}

.preview-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-soft);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--faint);
}
</style>
