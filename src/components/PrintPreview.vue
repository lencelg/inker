<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '../lib/i18n';

const props = defineProps<{
  title: string;
  html: string;
}>();

const emit = defineEmits<{ close: [] }>();

const frame = ref<HTMLIFrameElement | null>(null);
const ready = ref(false);

function printDocument(): void {
  const target = frame.value?.contentWindow;
  if (!target) return;
  target.focus();
  target.print();
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  emit('close');
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown, true);
});
</script>

<template>
  <Teleport to="body">
    <div class="print-overlay" role="dialog" aria-modal="true" :aria-label="t('print.aria', { title })">
      <div class="print-panel">
        <header class="print-toolbar">
          <div class="print-heading">
            <strong>{{ title }}</strong>
            <span>{{ t('print.hint') }}</span>
          </div>
          <div class="print-actions">
            <button
              type="button"
              class="print-button primary"
              :disabled="!ready"
              @click="printDocument"
            >
              {{ t('print.action') }}
            </button>
            <button type="button" class="print-button" @click="emit('close')">
              {{ t('action.close') }}
            </button>
          </div>
        </header>
        <iframe
          ref="frame"
          class="print-frame"
          :title="t('print.iframeTitle', { title })"
          :srcdoc="html"
          @load="ready = true"
        ></iframe>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.print-overlay {
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

.print-panel {
  display: flex;
  flex-direction: column;
  width: min(1100px, 100%);
  height: min(88vh, 100%);
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-strong);
}

.print-toolbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-soft);
}

.print-heading {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.print-heading strong {
  overflow: hidden;
  color: var(--ink);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.print-heading span {
  color: var(--muted);
  font-size: 11px;
}

.print-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.print-button {
  height: 28px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.print-button:hover:not(:disabled) {
  border-color: var(--btn-hover-border);
  background: var(--btn-hover-bg);
}

.print-button.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.print-button.primary:hover:not(:disabled) {
  background: var(--accent-strong);
}

.print-button:disabled {
  cursor: default;
  opacity: 0.55;
}

.print-frame {
  flex: 1;
  width: 100%;
  border: 0;
  background: #fff;
}

@media (max-width: 720px) {
  .print-overlay {
    padding: 8px;
  }

  .print-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
