<script setup lang="ts">
import DOMPurify from 'dompurify';
import renderMathInElement from 'katex/contrib/auto-render';
import { computed, nextTick, ref, watch } from 'vue';

const props = defineProps<{
  html: string;
}>();

// Notes may contain raw HTML, so all rendered HTML is sanitized before v-html.
const safeHtml = computed(() => DOMPurify.sanitize(props.html));
const bodyRef = ref<HTMLElement | null>(null);

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

watch(
  () => props.html,
  async (html, previousHtml) => {
    await nextTick();
    if (!html) return;
    renderMath();
    if (!previousHtml && bodyRef.value) {
      bodyRef.value.scrollTop = 0;
    }
  },
  { immediate: true },
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
