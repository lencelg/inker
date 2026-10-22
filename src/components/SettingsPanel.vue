<script setup lang="ts">
import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  clampFontSize,
} from '../lib/preferences';
import type { ThemeId } from '../lib/themes';
import ThemePicker from './ThemePicker.vue';

const props = defineProps<{
  theme: ThemeId;
  fontSize: number;
}>();

const emit = defineEmits<{
  themeChange: [theme: ThemeId];
  fontSizeChange: [size: number];
}>();

function changeFontSize(value: number): void {
  emit('fontSizeChange', clampFontSize(value));
}

function onSlider(event: Event): void {
  changeFontSize(Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <aside class="settings-panel">
    <header class="panel-heading">
      <h2>设置</h2>
    </header>

    <div class="settings-scroll">
      <section class="setting-section">
        <h3>外观</h3>
        <div class="setting-field">
          <span class="setting-label">主题</span>
          <ThemePicker
            :theme="theme"
            @change="emit('themeChange', $event)"
          />
        </div>
      </section>

      <section class="setting-section">
        <h3>编辑器</h3>
        <div class="setting-field">
          <div class="setting-row">
            <span class="setting-label">字体大小</span>
            <div class="font-stepper">
              <button
                type="button"
                aria-label="减小字体"
                :disabled="fontSize <= MIN_FONT_SIZE"
                @click="changeFontSize(fontSize - 1)"
              >
                −
              </button>
              <span class="font-value">{{ fontSize }} px</span>
              <button
                type="button"
                aria-label="增大字体"
                :disabled="fontSize >= MAX_FONT_SIZE"
                @click="changeFontSize(fontSize + 1)"
              >
                +
              </button>
            </div>
          </div>
          <input
            class="font-slider"
            type="range"
            :min="MIN_FONT_SIZE"
            :max="MAX_FONT_SIZE"
            step="1"
            :value="props.fontSize"
            aria-label="字体大小"
            @input="onSlider"
          />
          <p class="hint">按住 Ctrl 并滚动鼠标滚轮也可以调整字体大小。</p>
        </div>

        <div class="setting-field inline">
          <span class="setting-label">字体</span>
          <span class="setting-value">JetBrains Mono</span>
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  padding: 16px 12px 12px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.panel-heading {
  min-height: 28px;
  padding: 0 4px;
}

.panel-heading h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.settings-scroll {
  flex: 1;
  min-height: 0;
  margin-top: 10px;
  overflow: auto;
}

.setting-section {
  padding: 12px 4px 16px;
  border-bottom: 1px solid var(--border);
}

.setting-section:first-child {
  padding-top: 4px;
}

.setting-section:last-child {
  border-bottom: 0;
}

.setting-section h3 {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.setting-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-field.inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.setting-field + .setting-field {
  margin-top: 14px;
}

.setting-label {
  color: var(--ink);
  font-size: 12.5px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.setting-value {
  color: var(--muted);
  font-family: var(--mono-font);
  font-size: 11.5px;
}

.font-stepper {
  display: flex;
  align-items: center;
  gap: 2px;
}

.font-stepper button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--panel);
  color: var(--ink);
  font-size: 14px;
  line-height: 1;
}

.font-stepper button:hover:not(:disabled) {
  background: var(--btn-hover-bg);
  border-color: var(--btn-hover-border);
}

.font-value {
  min-width: 52px;
  color: var(--ink);
  font-family: var(--mono-font);
  font-size: 11.5px;
  text-align: center;
}

.font-slider {
  width: 100%;
  margin: 2px 0 0;
  accent-color: var(--accent);
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.65;
}
</style>
