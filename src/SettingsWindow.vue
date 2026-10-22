<script setup lang="ts">
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import LeafIcon from './components/LeafIcon.vue';
import {
  FONTS,
  fontById,
  type FontId,
} from './lib/fonts';
import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  PREFERENCES_EVENT,
  PREFERENCES_REQUEST_EVENT,
  applyPreferences,
  clampFontSize,
  normalizePreferences,
  readPreferences,
  savePreferences,
  type Preferences,
} from './lib/preferences';
import { THEMES, type ThemeId } from './lib/themes';

const preferences = ref<Preferences>(readPreferences());
const currentFont = computed(() => fontById(preferences.value.fontFamily));
let unlisten: UnlistenFn | null = null;

applyPreferences(preferences.value);

onMounted(async () => {
  try {
    unlisten = await listen<Preferences>(PREFERENCES_EVENT, (event) => {
      applyIncoming(normalizePreferences(event.payload));
    });
    await emit(PREFERENCES_REQUEST_EVENT);
  } catch {
    // The window still works with locally stored preferences.
  }
});

onBeforeUnmount(() => {
  unlisten?.();
});

function applyIncoming(next: Preferences): void {
  preferences.value = next;
  savePreferences(next);
  applyPreferences(next);
}

function update(patch: Partial<Preferences>): void {
  const next = normalizePreferences({ ...preferences.value, ...patch });
  applyIncoming(next);
  void emit(PREFERENCES_EVENT, next).catch(() => {
    // Persistence has already happened locally.
  });
}

function onThemeChange(event: Event): void {
  update({ theme: (event.target as HTMLSelectElement).value as ThemeId });
}

function onFontChange(event: Event): void {
  update({ fontFamily: (event.target as HTMLSelectElement).value as FontId });
}

function onFontSizeChange(event: Event): void {
  update({ fontSize: clampFontSize(Number((event.target as HTMLInputElement).value)) });
}

function changeFontSize(delta: number): void {
  update({ fontSize: preferences.value.fontSize + delta });
}

function onVimChange(event: Event): void {
  update({ vimEnabled: (event.target as HTMLInputElement).checked });
}

function closeWindow(): void {
  void getCurrentWindow().close();
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-header">
      <div class="settings-brand">
        <span class="settings-logo"><LeafIcon /></span>
        <div>
          <p>markleaf</p>
          <h1>设置</h1>
        </div>
      </div>
      <button
        class="close-button"
        type="button"
        aria-label="关闭设置"
        title="关闭设置"
        @click="closeWindow"
      >
        ×
      </button>
    </header>

    <main class="settings-content">
      <section class="setting-section">
        <h2>外观</h2>
        <div class="settings-card">
          <label class="setting-row">
            <span>
              <strong>主题</strong>
              <small>界面、编辑器和预览的颜色。</small>
            </span>
            <select class="select" :value="preferences.theme" @change="onThemeChange">
              <option v-for="theme in THEMES" :key="theme.id" :value="theme.id">
                {{ theme.label }}
              </option>
            </select>
          </label>
        </div>
      </section>

      <section class="setting-section">
        <h2>编辑器</h2>
        <div class="settings-card">
          <label class="setting-row">
            <span>
              <strong>字体</strong>
              <small>用于编辑器、标签页和文件树。</small>
            </span>
            <select class="select" :value="preferences.fontFamily" @change="onFontChange">
              <option v-for="font in FONTS" :key="font.id" :value="font.id">
                {{ font.label }}
              </option>
            </select>
          </label>

          <div class="font-preview" :style="{ fontFamily: currentFont.stack }">
            <span>// {{ currentFont.label }}</span>
            <code>const markleaf = 'notes';</code>
          </div>

          <div class="setting-row font-size-row">
            <span>
              <strong>字体大小</strong>
              <small>按住 Ctrl 并滚动鼠标滚轮也可以调整。</small>
            </span>
            <div class="stepper">
              <button
                type="button"
                aria-label="减小字体"
                :disabled="preferences.fontSize <= MIN_FONT_SIZE"
                @click="changeFontSize(-1)"
              >
                −
              </button>
              <span>{{ preferences.fontSize }} px</span>
              <button
                type="button"
                aria-label="增大字体"
                :disabled="preferences.fontSize >= MAX_FONT_SIZE"
                @click="changeFontSize(1)"
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
            :value="preferences.fontSize"
            aria-label="字体大小"
            @input="onFontSizeChange"
          />

          <div class="setting-row vim-row">
            <span>
              <strong>Vim 模式</strong>
              <small>使用 Vim 键位编辑，支持搜索、替换、宏和常用 ex 命令。</small>
            </span>
            <input
              class="switch"
              type="checkbox"
              :checked="preferences.vimEnabled"
              aria-label="Vim 模式"
              @change="onVimChange"
            />
          </div>
        </div>
      </section>

      <p class="settings-footer">更改会立即保存并应用到笔记窗口。</p>
    </main>
  </div>
</template>

<style scoped>
.settings-page {
  height: 100vh;
  overflow: auto;
  padding: 30px 34px 36px;
  background:
    radial-gradient(circle at top left, var(--body-glow), transparent 30rem),
    var(--bg);
  color: var(--ink);
}

.settings-header {
  display: flex;
  max-width: 680px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 auto 24px;
}

.settings-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.close-button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  color: var(--muted);
  font-size: 19px;
  line-height: 1;
}

.close-button:hover {
  background: var(--btn-hover-bg);
  border-color: var(--btn-hover-border);
  color: var(--ink);
}

.settings-logo {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  background: linear-gradient(135deg, var(--leaf), var(--leaf-strong));
  color: #fff;
}

.settings-logo svg {
  width: 25px;
  height: 25px;
}

.settings-header p {
  margin: 0 0 2px;
  color: var(--muted);
  font-family: var(--mono-font);
  font-size: 11px;
}

.settings-header h1 {
  margin: 0;
  font-size: 22px;
  letter-spacing: -0.02em;
}

.settings-content {
  max-width: 680px;
  margin: 0 auto;
}

.setting-section + .setting-section {
  margin-top: 22px;
}

.setting-section h2 {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.settings-card {
  padding: 4px 18px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}

.settings-card > :last-child {
  border-bottom: 0;
}

.setting-row > span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.setting-row strong {
  font-size: 13px;
  font-weight: 600;
}

.setting-row small {
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.55;
}

.select {
  min-width: 170px;
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg-soft);
  color: var(--ink);
  font-size: 12.5px;
}

.select:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.font-preview {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 12px 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--bg-soft);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.font-preview code {
  color: var(--ink);
  font: inherit;
  font-size: 13px;
}

.font-size-row {
  border-bottom: 0;
  padding-bottom: 4px;
}

.stepper {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

.stepper button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-soft);
  color: var(--ink);
  font-size: 14px;
  line-height: 1;
}

.stepper button:hover:not(:disabled) {
  background: var(--btn-hover-bg);
  border-color: var(--btn-hover-border);
}

.stepper span {
  min-width: 54px;
  font-family: var(--mono-font);
  font-size: 12px;
  text-align: center;
}

.font-slider {
  width: 100%;
  margin: 0 0 14px;
  accent-color: var(--accent);
}

.vim-row {
  border-top: 1px solid var(--border);
}

.switch {
  position: relative;
  flex-shrink: 0;
  width: 38px;
  height: 21px;
  margin: 0;
  border-radius: 999px;
  background: var(--border);
  appearance: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.switch::before {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: var(--panel);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  content: '';
  transition: transform 0.15s ease;
}

.switch:checked {
  background: var(--accent);
}

.switch:checked::before {
  transform: translateX(17px);
}

.switch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.settings-footer {
  margin: 20px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  text-align: center;
}
</style>
