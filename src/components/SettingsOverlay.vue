<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import SettingsPanel from './SettingsPanel.vue';
import type { Preferences } from '../lib/preferences';
defineProps<{
  preferences: Preferences;
  maximized: boolean;
}>();

const emit = defineEmits<{
  update: [patch: Partial<Preferences>];
  close: [];
  minimize: [];
  maximize: [];
}>();

const panelRef = ref<HTMLElement | null>(null);
const previousFocus =
  document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

function focusableElements(): HTMLElement[] {
  const panel = panelRef.value;
  if (!panel) return [];
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (element) =>
      element.offsetParent !== null || element === document.activeElement,
  );
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
    return;
  }

  if (event.key !== 'Tab') return;
  const elements = focusableElements();
  if (elements.length === 0) {
    event.preventDefault();
    panelRef.value?.focus();
    return;
  }

  const first = elements[0];
  const last = elements[elements.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown, true);
  previousFocus?.focus();
});
</script>

<template>
  <div class="settings-overlay" @click.self="emit('close')">
    <section
      ref="panelRef"
      class="settings-panel"
      role="dialog"
      aria-modal="true"
      aria-label="设置"
      tabindex="-1"
    >
      <SettingsPanel
        :preferences="preferences"
        :maximized="maximized"
        @update="emit('update', $event)"
        @close="emit('close')"
        @minimize="emit('minimize')"
        @maximize="emit('maximize')"
      />
    </section>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay);
  backdrop-filter: blur(3px);
}

.settings-panel {
  display: flex;
  width: 80vw;
  height: 80vh;
  min-width: 680px;
  min-height: 460px;
  max-width: 1440px;
  max-height: 920px;
  overflow: hidden;
  outline: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
  color: var(--ink);
  box-shadow: var(--shadow-strong);
  animation: settings-enter 0.16s ease-out;
}

@keyframes settings-enter {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.994);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 900px) {
  .settings-panel {
    width: calc(100vw - 28px);
    height: calc(100vh - 28px);
    min-width: 0;
    min-height: 0;
  }
}
</style>
