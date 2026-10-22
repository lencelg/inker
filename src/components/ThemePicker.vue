<script setup lang="ts">
import { computed } from 'vue';
import { THEMES, type ThemeId } from '../lib/themes';

const props = defineProps<{ theme: ThemeId }>();
const emit = defineEmits<{ change: [theme: ThemeId] }>();

const current = computed(
  () => THEMES.find((theme) => theme.id === props.theme) ?? THEMES[0],
);

function onChange(event: Event): void {
  emit('change', (event.target as HTMLSelectElement).value as ThemeId);
}
</script>

<template>
  <label class="theme-picker" :title="`切换主题（当前：${current.label}）`">
    <svg class="palette" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3a9 9 0 1 0 0 18h1.3a1.6 1.6 0 0 0 0-3.2h-.8a2 2 0 0 1 0-4H16a5 5 0 0 0 5-5c0-3.4-4-5.8-9-5.8Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <circle cx="7.4" cy="10" r="1.15" fill="currentColor" />
      <circle cx="10.4" cy="6.7" r="1.15" fill="currentColor" />
      <circle cx="15" cy="6.4" r="1.15" fill="currentColor" />
      <circle cx="17.8" cy="9.6" r="1.15" fill="currentColor" />
    </svg>
    <span class="theme-name">{{ current.label }}</span>
    <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m8 10 4 4 4-4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <select :value="theme" aria-label="主题" @change="onChange">
      <option v-for="option in THEMES" :key="option.id" :value="option.id">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.theme-picker {
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 6px 4px;
  border-radius: 8px;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
  user-select: none;
}

.theme-picker:hover {
  background: var(--hover);
  color: var(--ink);
}

.theme-picker:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.palette {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
}

.theme-name {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-align: left;
  text-overflow: ellipsis;
}

.chevron {
  flex-shrink: 0;
  width: 13px;
  height: 13px;
  color: var(--faint);
}

select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
</style>
