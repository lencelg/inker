<script setup lang="ts">
import DOMPurify from 'dompurify';
import renderMathInElement from 'katex/contrib/auto-render';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { api } from '../api';
import {
  findAnchorTarget,
  fragmentFromHref,
  scrollToAnchor,
} from '../lib/anchors';
import { isLocalImageSource } from '../lib/markdown';
import { localizeError, t } from '../lib/i18n';
import { renderMermaid } from '../lib/mermaid';
import {
  previewScrollTop,
  sourceLineAtOffset,
  type SourceAnchor,
} from '../lib/previewSync';

const props = defineProps<{
  html: string;
  notePath: string;
  focusLine: number;
  scrollRatio?: number;
  layoutKey?: string;
}>();

const emit = defineEmits<{ syncSource: [line: number] }>();

// Notes may contain raw HTML, so all rendered HTML is sanitized before v-html.
const safeHtml = computed(() =>
  DOMPurify.sanitize(props.html, {
    ADD_ATTR: [
      'data-md-src',
      'data-source-line',
      'data-source-line-end',
    ],
  }),
);
const bodyRef = ref<HTMLElement | null>(null);
const imageCache = new Map<string, string>();
let anchors: SourceAnchor[] = [];
let resolveRun = 0;
let suppressScrollUntil = 0;
let scrollFrame = 0;
let resizeFrame = 0;
let layoutFrame = 0;
let anchorFrame = 0;
let layoutUpdating = false;
let lastUserScrollAt = 0;
let pointerScrolling = false;
let resizeObserver: ResizeObserver | null = null;
let observedWidth = 0;

function markUserScroll(): void {
  lastUserScrollAt = performance.now();
}

function onPointerDown(): void {
  pointerScrolling = true;
  markUserScroll();
}

function onPointerUp(): void {
  pointerScrolling = false;
  markUserScroll();
}

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
  placeholder.textContent = t('preview.imageMissing', {
    alt: image.alt || t('preview.imageFallback'),
  });
  placeholder.title = t('preview.imageLoadFailed', {
    message: localizeError(message),
  });
  image.replaceWith(placeholder);
}

function scheduleAnchorRefresh(): void {
  if (anchorFrame) return;
  anchorFrame = requestAnimationFrame(() => {
    anchorFrame = 0;
    collectAnchors();
    applyScrollSync();
  });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function waitForImages(
  root: HTMLElement,
  run: number,
): Promise<void> {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          let settled = false;
          const done = (): void => {
            if (settled) return;
            settled = true;
            resolve();
          };
          image.addEventListener('load', done, { once: true });
          image.addEventListener('error', done, { once: true });
          window.setTimeout(done, 3000);
        });
      }
      if (run !== resolveRun) return;
      try {
        await image.decode();
      } catch {
        // Broken or unsupported images keep their fallback size.
      }
    }),
  );
}

async function resolveImages(run: number): Promise<void> {
  const root = bodyRef.value;
  if (!root) return;
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  for (const image of images) {
    if (!image.complete) {
      image.addEventListener('load', scheduleAnchorRefresh, { once: true });
      image.addEventListener('error', scheduleAnchorRefresh, { once: true });
    }
  }

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
}

async function renderDiagrams(run: number): Promise<void> {
  const root = bodyRef.value;
  if (!root) return;

  const blocks = Array.from(
    root.querySelectorAll<HTMLElement>('.mermaid-block'),
  );
  await Promise.all(
    blocks.map(async (block) => {
      const source =
        block.querySelector('.mermaid-source')?.textContent ?? '';
      if (!source.trim()) return;
      try {
        const svg = await renderMermaid(source);
        if (run !== resolveRun || !block.isConnected) return;
        block.classList.add('mermaid-rendered');
        block.innerHTML = svg;
      } catch (error) {
        if (run !== resolveRun || !block.isConnected) return;
        block.classList.add('mermaid-error');
        block.title = t('preview.mermaidFailed', {
          message: errorMessage(error),
        });
      }
    }),
  );
}

function collectAnchors(): void {
  const root = bodyRef.value;
  if (!root) {
    anchors = [];
    return;
  }

  const rootRect = root.getBoundingClientRect();
  const byStart = new Map<number, SourceAnchor>();
  const elements = root.querySelectorAll<HTMLElement>('[data-source-line]');
  for (const element of elements) {
    const start = Number(element.dataset.sourceLine);
    const endValue = Number(element.dataset.sourceLineEnd);
    const end = Number.isFinite(endValue)
      ? Math.max(start, endValue)
      : start;
    if (!Number.isFinite(start) || start < 1) continue;

    const rect = element.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0) continue;

    const top = rect.top - rootRect.top + root.scrollTop;
    const anchor: SourceAnchor = {
      start,
      end,
      top,
      bottom: top + rect.height,
      height: rect.height,
    };
    const existing = byStart.get(start);
    if (!existing) {
      byStart.set(start, anchor);
      continue;
    }

    const existingRange = existing.end - existing.start;
    const range = anchor.end - anchor.start;
    if (
      range < existingRange ||
      (range === existingRange && anchor.height < existing.height)
    ) {
      byStart.set(start, anchor);
    }
  }

  anchors = [...byStart.values()].sort((a, b) => a.start - b.start);
}

function sourceLineAtCenter(): number | null {
  const element = bodyRef.value;
  if (!element || anchors.length === 0) return null;
  return sourceLineAtOffset(
    anchors,
    element.scrollTop + element.clientHeight / 2,
  );
}

function onPreviewScroll(): void {
  if (
    layoutUpdating ||
    performance.now() < suppressScrollUntil ||
    scrollFrame
  ) {
    return;
  }
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    if (layoutUpdating || performance.now() < suppressScrollUntil) return;
    if (
      !pointerScrolling &&
      performance.now() - lastUserScrollAt > 600
    ) {
      return;
    }
    const line = sourceLineAtCenter();
    if (line !== null) emit('syncSource', line);
  });
}

function onPreviewClick(event: MouseEvent): void {
  const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>(
    'a[href]',
  );
  if (!anchor) return;
  const fragment = fragmentFromHref(anchor.getAttribute('href'));
  if (fragment === null) return;

  const root = bodyRef.value;
  if (!root) return;
  event.preventDefault();
  suppressScrollUntil = performance.now() + 650;

  if (!fragment.trim()) {
    if (typeof root.scrollTo === 'function') {
      root.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      root.scrollTop = 0;
    }
    return;
  }

  const target = findAnchorTarget(root, fragment);
  if (!target) return;
  scrollToAnchor(root, target);

  const lineElement =
    target.closest<HTMLElement>('[data-source-line]') ?? target;
  const line = Number(lineElement.dataset.sourceLine);
  if (Number.isFinite(line) && line > 0) {
    emit('syncSource', line);
  }
}

function observeBody(): void {
  if (!bodyRef.value) {
    resizeObserver?.disconnect();
    resizeObserver = null;
    observedWidth = 0;
    return;
  }
  if (resizeObserver) return;

  resizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 0;
    if (Math.abs(width - observedWidth) < 0.5) return;
    observedWidth = width;
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      collectAnchors();
      applyScrollSync();
    });
  });
  resizeObserver.observe(bodyRef.value);
}

onMounted(() => {
  window.addEventListener('pointerup', onPointerUp);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerup', onPointerUp);
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  if (layoutFrame) cancelAnimationFrame(layoutFrame);
  if (anchorFrame) cancelAnimationFrame(anchorFrame);
  resizeObserver?.disconnect();
  resizeObserver = null;
});

function applyScrollSync(): void {
  const element = bodyRef.value;
  if (!element) return;
  const maximum = element.scrollHeight - element.clientHeight;
  if (maximum <= 0) return;

  const nextTop = previewScrollTop(
    anchors,
    props.focusLine,
    props.scrollRatio ?? 0,
    maximum,
    element.clientHeight,
  );
  if (Math.abs(element.scrollTop - nextTop) >= 0.5) {
    suppressScrollUntil = performance.now() + 120;
    element.scrollTop = nextTop;
  }
}

watch(
  [() => props.html, () => props.notePath],
  async ([html]) => {
    const run = ++resolveRun;
    layoutUpdating = true;
    suppressScrollUntil = performance.now() + 250;
    try {
      await nextTick();
      observeBody();
      if (!html) {
        anchors = [];
        return;
      }
      const root = bodyRef.value;
      if (!root) return;
      renderMath();
      await Promise.all([resolveImages(run), renderDiagrams(run)]);
      if (run !== resolveRun) return;
      await waitForImages(root, run);
      if (run !== resolveRun) return;
      await nextFrame();
      if (run !== resolveRun) return;
      collectAnchors();
      applyScrollSync();
    } finally {
      if (run === resolveRun) layoutUpdating = false;
    }
  },
  { immediate: true },
);

watch(
  [() => props.focusLine, () => props.scrollRatio],
  async () => {
    await nextTick();
    applyScrollSync();
  },
);

watch(
  () => props.layoutKey,
  async () => {
    await nextTick();
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      collectAnchors();
      applyScrollSync();
    });
  },
);
</script>

<template>
  <section class="preview-pane">
    <div
      v-if="html"
      ref="bodyRef"
      class="markdown-body"
      v-html="safeHtml"
      @click="onPreviewClick"
      @scroll.passive="onPreviewScroll"
      @wheel.passive="markUserScroll"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
    ></div>
    <div v-else class="preview-empty">
      <span class="preview-icon">&lt;/&gt;</span>
      <p>{{ t('preview.empty') }}</p>
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
  font-family: var(--mono-font);
  font-size: 13px;
  color: var(--faint);
}
</style>
