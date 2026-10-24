<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import SettingsPanel from './SettingsPanel.vue';
import type { Preferences } from '../lib/preferences';

defineProps<{
  preferences: Preferences;
}>();

const emit = defineEmits<{
  update: [patch: Partial<Preferences>];
  close: [];
}>();

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
  <div class="settings-overlay" @click.self="emit('close')">
    <section
      class="settings-panel"
      role="dialog"
      aria-modal="true"
      aria-label="设置"
    >
      <SettingsPanel
        :preferences="preferences"
        @update="emit('update', $event)"
        @close="emit('close')"
      />
    </section>
  </div>
</template>

<style scoped>
.settings-overlay {
  display: flex;
  grid-column: 1 / -1;
  grid-row: 2;
  z-index: 60;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  padding: 28px 32px;
  background: var(--overlay);
  backdrop-filter: blur(2px);
}

.settings-panel {
  width: min(900px, 100%);
  height: min(760px, 100%);
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-strong);
}

@media (max-width: 900px) {
  .settings-overlay {
    padding: 16px;
  }
}
</style>
