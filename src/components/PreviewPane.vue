<script setup lang="ts">
import DOMPurify from 'dompurify';
import renderMathInElement from 'katex/contrib/auto-render';
import { computed, nextTick, ref, watch } from 'vue';
import { api } from '../api';
import { isLocalImageSource } from '../lib/markdown';

const props = defineProps<{
  html: string;
  notePath: string;
  focusLine: number;
  scrollRatio?: number;
}>();

interface SourceAnchor {
  start: number;
  end: number;
  top: number;
  bottom: number;
  height: number;
}

// Notes may contain raw HTML, so all rendered HTML is sanitized before v-html.
const safeHtml = computed(() =>
  DOMPurify.sanitize(props.html, {
    ADD_ATTR: ['data-md-src', 'data-source-line', 'data-source-line-end'],
  }),
);
const bodyRef = ref<HTMLElement | null>(null);
const imageCache = new Map<string, string>();
let anchors: SourceAnchor[] = [];
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
    collectAnchors();
    applyScrollSync();
  }
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

function applyScrollSync(): void {
  const element = bodyRef.value;
  if (!element) return;
  const maximum = element.scrollHeight - element.clientHeight;
  if (maximum <= 0) return;

  let top: number;
  if (anchors.length === 0) {
    top = Math.min(1, Math.max(0, props.scrollRatio ?? 0)) * maximum;
  } else {
    const targetLine = Math.max(1, props.focusLine);
    let containing: SourceAnchor | null = null;
    for (const anchor of anchors) {
      if (targetLine < anchor.start || targetLine > anchor.end) continue;
      if (
        !containing ||
        anchor.end - anchor.start < containing.end - containing.start ||
        (anchor.end - anchor.start === containing.end - containing.start &&
          anchor.height < containing.height)
      ) {
        containing = anchor;
      }
    }

    if (containing) {
      const range = containing.end - containing.start;
      const progress = range > 0
        ? (targetLine - containing.start) / range
        : 0;
      top = containing.top + containing.height * progress;
    } else {
      let previous: SourceAnchor | null = null;
      let next: SourceAnchor | null = null;
      for (const anchor of anchors) {
        if (anchor.start <= targetLine) {
          previous = anchor;
        } else {
          next = anchor;
          break;
        }
      }

      if (!previous) {
        top = 0;
      } else if (!next) {
        top = previous.bottom;
      } else {
        const gapStart = previous.end;
        const gap = Math.max(1, next.start - gapStart);
        const progress = Math.min(
          1,
          Math.max(0, (targetLine - gapStart) / gap),
        );
        top = previous.bottom + (next.top - previous.bottom) * progress;
      }
    }
  }

  element.scrollTop = Math.min(maximum, Math.max(0, top - 1));
}

watch(
  [() => props.html, () => props.notePath],
  async ([html]) => {
    await nextTick();
    if (!html) {
      anchors = [];
      return;
    }
    renderMath();
    await resolveImages();
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
</script>

<template>
  <section class="preview-pane">
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
