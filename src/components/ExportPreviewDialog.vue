<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { localizeError, t } from '../lib/i18n';
import {
  paginatePreview,
  waitForPreviewAssets,
  type PreviewFormat,
} from '../lib/pagination';

const props = defineProps<{
  format: PreviewFormat;
  title: string;
  html: string;
  warnings: string[];
  busy: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [];
}>();

const frame = ref<HTMLIFrameElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const ready = ref(false);
const error = ref('');
const pageCount = ref(0);
const overflow = ref(false);
const zoom = ref(1);
const progress = ref({ done: 0, total: 0 });
let controller: AbortController | null = null;
const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`);
const formatLabel = computed(() =>
  props.format === 'pdf' ? t('export.pdf') : t('export.docx'),
);
const actionLabel = computed(() =>
  props.busy && props.format === 'docx'
    ? t('export.preview.buildingDocx')
    : props.format === 'pdf'
      ? t('print.action')
      : t('export.docx.save'),
);
const loadingLabel = computed(() =>
  progress.value.total > 0
    ? t('export.preview.progress', {
        done: progress.value.done,
        total: progress.value.total,
      })
    : t('export.preview.paginating'),
);

function setZoom(value: number): void {
  zoom.value = Math.min(1.5, Math.max(0.5, Math.round(value * 10) / 10));
  const document = frame.value?.contentDocument;
  if (document) {
    document.body.style.zoom = String(zoom.value);
  }
}

async function preparePreview(): Promise<void> {
  const document = frame.value?.contentDocument;
  if (!document) return;
  controller?.abort();
  const currentController = new AbortController();
  controller = currentController;
  ready.value = false;
  error.value = '';
  progress.value = { done: 0, total: 0 };
  try {
    await waitForPreviewAssets(document);
    if (currentController.signal.aborted) return;
    const result = await paginatePreview(document, props.format, {
      signal: currentController.signal,
      onProgress: (done, total) => {
        progress.value = { done, total };
      },
    });
    if (currentController.signal.aborted) return;
    pageCount.value = result.pageCount;
    overflow.value = result.overflow;
    setZoom(zoom.value);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    frame.value?.contentWindow?.scrollTo(0, 0);
    ready.value = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const current = frame.value?.contentDocument;
        if (!current) return;
        current.documentElement.scrollTop = 0;
        current.body.scrollTop = 0;
        frame.value?.contentWindow?.scrollTo(0, 0);
      });
    });
  } catch (err) {
    if (
      currentController.signal.aborted ||
      (err instanceof DOMException && err.name === 'AbortError')
    ) {
      return;
    }
    error.value = t('export.preview.failed', {
      message: localizeError(
        err instanceof Error ? err.message : String(err),
      ),
    });
  }
}

function printDocument(): void {
  const target = frame.value?.contentWindow;
  if (!target || !ready.value) return;
  target.focus();
  target.print();
}

function performAction(): void {
  if (!ready.value || props.busy) return;
  if (props.format === 'pdf') {
    printDocument();
  } else {
    emit('save');
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || props.busy) return;
  event.preventDefault();
  emit('close');
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown, true);
  closeButton.value?.focus({ preventScroll: true });
});

onBeforeUnmount(() => {
  controller?.abort();
  controller = null;
  window.removeEventListener('keydown', onKeyDown, true);
});
</script>

<template>
  <Teleport to="body">
    <div
      class="export-preview-overlay"
      @click.self="!busy && emit('close')"
    >
      <section
        class="export-preview-panel"
        role="dialog"
        aria-modal="true"
        :aria-label="t('export.preview.title')"
      >
        <header class="export-preview-toolbar">
          <div class="export-preview-heading">
            <strong>{{ t('export.preview.title') }}</strong>
            <span class="export-preview-format">{{ formatLabel }}</span>
            <span class="export-preview-title">{{ title }}</span>
            <span v-if="ready" class="export-preview-pages">
              {{ t('export.preview.pages', { count: pageCount }) }}
            </span>
          </div>

          <div class="export-preview-actions">
            <div class="export-preview-zoom" role="group">
              <button
                type="button"
                :aria-label="t('export.preview.zoomOut')"
                :disabled="!ready || zoom <= 0.5"
                @click="setZoom(zoom - 0.1)"
              >
                −
              </button>
              <span>{{ zoomPercent }}</span>
              <button
                type="button"
                :aria-label="t('export.preview.zoomIn')"
                :disabled="!ready || zoom >= 1.5"
                @click="setZoom(zoom + 0.1)"
              >
                +
              </button>
            </div>
            <button
              type="button"
              class="export-button primary"
              :disabled="!ready || busy"
              @click="performAction"
            >
              {{ actionLabel }}
            </button>
            <button
              ref="closeButton"
              type="button"
              class="export-button"
              :disabled="busy"
              @click="emit('close')"
            >
              {{ t('action.cancel') }}
            </button>
          </div>
        </header>

        <div class="export-preview-meta">
          <span v-if="format === 'pdf'">{{ t('print.hint') }}</span>
          <span v-else>{{ t('export.preview.docxHint') }}</span>
        </div>

        <ul
          v-if="warnings.length || overflow"
          class="export-preview-warnings"
        >
          <li v-if="overflow">{{ t('export.preview.overflow') }}</li>
          <li v-for="warning in warnings" :key="warning">
            {{ warning }}
          </li>
        </ul>

        <div class="export-preview-stage" :class="{ ready }">
          <iframe
            ref="frame"
            class="export-preview-frame"
            :title="t('export.preview.title')"
            :srcdoc="html"
            @load="preparePreview"
          ></iframe>
          <div v-if="!ready && !error" class="export-preview-loading">
            <span class="export-preview-spinner" aria-hidden="true"></span>
            <span>{{ loadingLabel }}</span>
          </div>
          <div v-if="error" class="export-preview-error" role="alert">
            {{ error }}
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.export-preview-overlay {
  position: fixed;
  z-index: 300;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--overlay);
  backdrop-filter: blur(2px);
}

.export-preview-panel {
  display: flex;
  flex-direction: column;
  width: min(1180px, 100%);
  height: min(90vh, 100%);
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-strong);
}

.export-preview-toolbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-soft);
}

.export-preview-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.export-preview-heading strong {
  color: var(--ink);
  font-size: 13px;
  white-space: nowrap;
}

.export-preview-format {
  flex: none;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.export-preview-title {
  min-width: 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.export-preview-pages {
  flex: none;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.export-preview-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.export-preview-zoom {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 30px;
  padding: 0 3px;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted);
  font-size: 11px;
}

.export-preview-zoom button {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 15px;
  line-height: 1;
}

.export-preview-zoom button:hover:not(:disabled) {
  background: var(--hover);
  color: var(--ink);
}

.export-preview-zoom button:disabled {
  opacity: 0.4;
}

.export-preview-zoom span {
  min-width: 38px;
  text-align: center;
}

.export-button {
  height: 30px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.export-button:hover:not(:disabled) {
  background: var(--hover);
}

.export-button.primary {
  border-color: var(--primary-bg);
  background: var(--primary-bg);
  color: var(--primary-ink);
}

.export-button.primary:hover:not(:disabled) {
  background: var(--primary-bg-hover);
}

.export-button:disabled {
  cursor: default;
  opacity: 0.55;
}

.export-preview-meta {
  flex-shrink: 0;
  padding: 7px 16px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  font-size: 11.5px;
}

.export-preview-warnings {
  max-height: 88px;
  margin: 0;
  padding: 8px 16px 8px 32px;
  overflow: auto;
  border-bottom: 1px solid var(--border);
  background: var(--warning-soft);
  color: var(--warning);
  font-size: 11.5px;
  line-height: 1.6;
}

.export-preview-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #e8edf3;
}

.export-preview-frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: #e8edf3;
  opacity: 0;
  transition: opacity 120ms ease;
}

.export-preview-stage.ready .export-preview-frame {
  opacity: 1;
}

.export-preview-loading,
.export-preview-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  background: var(--panel);
  color: var(--muted);
  font-size: 12.5px;
}

.export-preview-error {
  color: var(--error);
  text-align: center;
}

.export-preview-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: export-preview-spin 0.7s linear infinite;
}

@keyframes export-preview-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 820px) {
  .export-preview-overlay {
    padding: 8px;
  }

  .export-preview-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
