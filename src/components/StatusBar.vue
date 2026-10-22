<script setup lang="ts">
import { computed } from 'vue';
import { VIEW_MODES, type ViewMode } from '../lib/viewModes';

const props = defineProps<{
  line: number | null;
  column: number | null;
  mode: ViewMode;
  vimEnabled: boolean;
  lineEnding: string;
}>();

const emit = defineEmits<{ modeChange: [mode: ViewMode] }>();

const modeLabel = computed(
  () => VIEW_MODES.find((item) => item.id === props.mode)?.label ?? '源码模式',
);

const osName = detectOs();

function detectOs(): string {
  const userAgent = navigator.userAgent;
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return navigator.platform || 'Unknown';
}

function onModeChange(event: Event): void {
  emit('modeChange', (event.target as HTMLSelectElement).value as ViewMode);
}
</script>

<template>
  <footer class="status-bar">
    <div class="status-left">
      <label class="status-mode" title="切换编辑模式">
        <span>{{ modeLabel }}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="m8 10 4 4 4-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <select :value="mode" aria-label="编辑模式" @change="onModeChange">
          <option v-for="item in VIEW_MODES" :key="item.id" :value="item.id">
            {{ item.label }}
          </option>
        </select>
      </label>

      <span v-if="vimEnabled" class="status-vim">Vim</span>
    </div>

    <div class="status-right">
      <span class="status-item">
        行 {{ line ?? '-' }}, 列 {{ column ?? '-' }}
      </span>
      <span class="status-item">空格: 4</span>
      <span class="status-item">UTF-8</span>
      <span class="status-item">{{ lineEnding }}</span>
      <span class="status-item">{{ osName }}</span>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  justify-content: space-between;
  height: 26px;
  padding: 0 8px 0 6px;
  overflow: hidden;
  background: var(--statusbar-bg);
  border-top: 1px solid var(--statusbar-border);
  color: var(--statusbar-ink);
  font-size: 11.5px;
  white-space: nowrap;
  user-select: none;
}

.status-left,
.status-right {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 2px;
}

.status-right {
  gap: 12px;
  padding-right: 4px;
  overflow: hidden;
}

.status-mode {
  position: relative;
  display: flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 7px;
  border-radius: 4px;
  color: var(--statusbar-ink);
  cursor: pointer;
}

.status-mode:hover {
  background: var(--statusbar-hover);
}

.status-mode:focus-within {
  outline: 1px solid var(--statusbar-ink);
  outline-offset: -1px;
}

.status-mode svg {
  width: 12px;
  height: 12px;
  opacity: 0.8;
}

.status-mode select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.status-vim {
  padding: 1px 7px;
  border: 1px solid var(--statusbar-border-soft, transparent);
  border-radius: 4px;
  background: var(--statusbar-hover);
  color: var(--statusbar-ink);
  font-family: var(--mono-font);
  font-size: 10.5px;
  letter-spacing: 0.03em;
}

.status-item {
  color: var(--statusbar-muted);
  font-family: var(--mono-font);
  font-size: 11px;
}

@media (max-width: 900px) {
  .status-right {
    gap: 8px;
  }
}
</style>
