<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '../lib/i18n';

const props = defineProps<{
  title: string;
  embeddedHtml: string;
  initialEmbedded: boolean;
  embeddedBytes: number;
  linkedBytes: number;
  warnings: string[];
  busy: boolean;
}>();

const emit = defineEmits<{
  save: [embedded: boolean];
  close: [];
}>();

type ImageMode = 'embedded' | 'linked';

const mode = ref<ImageMode>(
  props.initialEmbedded ? 'embedded' : 'linked',
);
const closeButton = ref<HTMLButtonElement | null>(null);

const embedded = computed(() => mode.value === 'embedded');
const sizeLabel = computed(() =>
  t('export.html.size', {
    size: formatBytes(
      embedded.value ? props.embeddedBytes : props.linkedBytes,
    ),
  }),
);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  window.removeEventListener('keydown', onKeyDown, true);
});
</script>

<template>
  <Teleport to="body">
    <div class="html-export-overlay" @click.self="!busy && emit('close')">
      <section
        class="html-export-panel"
        role="dialog"
        aria-modal="true"
        :aria-label="t('export.html.title')"
      >
        <header class="html-export-header">
          <div class="html-export-heading">
            <strong>{{ t('export.html.title') }}</strong>
            <span>{{ title }}</span>
          </div>

          <div class="html-export-modes" role="tablist">
            <button
              type="button"
              role="tab"
              :class="{ active: embedded }"
              :aria-selected="embedded"
              @click="mode = 'embedded'"
            >
              {{ t('export.html.embedded') }}
            </button>
            <button
              type="button"
              role="tab"
              :class="{ active: !embedded }"
              :aria-selected="!embedded"
              @click="mode = 'linked'"
            >
              {{ t('export.html.linked') }}
            </button>
            <span class="html-export-size">{{ sizeLabel }}</span>
          </div>

          <div class="html-export-actions">
            <button
              type="button"
              class="export-button primary"
              :disabled="busy"
              @click="emit('save', embedded)"
            >
              {{ t('export.html.save') }}
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

        <div class="html-export-info">
          <p>
            {{
              embedded
                ? t('export.html.embeddedHint')
                : t('export.html.linkedHint')
            }}
          </p>
        </div>

        <ul v-if="warnings.length" class="html-export-warnings">
          <li v-for="warning in warnings" :key="warning">
            {{ warning }}
          </li>
        </ul>

        <iframe
          class="html-export-preview"
          sandbox=""
          :title="t('export.html.preview')"
          :srcdoc="embeddedHtml"
        ></iframe>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.html-export-overlay {
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

.html-export-panel {
  display: flex;
  flex-direction: column;
  width: min(1120px, 100%);
  height: min(88vh, 100%);
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-strong);
}

.html-export-header {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto minmax(160px, 1fr);
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-soft);
}

.html-export-heading {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.html-export-heading strong {
  color: var(--ink);
  font-size: 13px;
}

.html-export-heading span {
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.html-export-modes {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--panel);
}

.html-export-modes button {
  height: 26px;
  padding: 0 12px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
}

.html-export-modes button.active {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.html-export-size {
  padding: 0 7px;
  color: var(--faint);
  font-size: 10.5px;
  white-space: nowrap;
}

.html-export-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.export-button {
  height: 30px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  color: var(--ink);
  font-size: 12px;
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
  opacity: 0.55;
}

.html-export-info {
  display: flex;
  flex-shrink: 0;
  align-items: baseline;
  gap: 16px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  font-size: 11.5px;
}

.html-export-info p {
  margin: 0;
}

.html-export-warnings {
  max-height: 92px;
  margin: 0;
  padding: 8px 16px 8px 32px;
  overflow: auto;
  border-bottom: 1px solid var(--border);
  background: var(--warning-soft);
  color: var(--warning);
  font-size: 11.5px;
  line-height: 1.6;
}

.html-export-preview {
  width: 100%;
  min-height: 0;
  flex: 1;
  border: 0;
  background: #fff;
}

@media (max-width: 760px) {
  .html-export-header {
    grid-template-columns: 1fr;
  }

  .html-export-actions {
    justify-content: flex-start;
  }

  .html-export-info {
    flex-direction: column;
    gap: 2px;
  }
}
</style>
