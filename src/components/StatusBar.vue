<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { VIEW_MODES, type ViewMode } from '../lib/viewModes';

const props = defineProps<{
  line: number | null;
  column: number | null;
  mode: ViewMode;
  vimEnabled: boolean;
  vimMode?: string | null;
  lineEnding: string;
  immersive: boolean;
}>();

const emit = defineEmits<{
  modeChange: [mode: ViewMode];
  immersiveToggle: [];
}>();

const modeLabel = computed(
  () => VIEW_MODES.find((item) => item.id === props.mode)?.label ?? '源码模式',
);
const vimModeLabel = computed(() => props.vimMode || 'NORMAL');

const osName = detectOs();

const menuOpen = ref(false);
const menuStyle = ref<Record<string, string>>({});
const triggerElement = ref<HTMLButtonElement | null>(null);
const menuElement = ref<HTMLElement | null>(null);
let detachMenu: (() => void) | null = null;

onBeforeUnmount(() => closeMenu());

function detectOs(): string {
  const userAgent = navigator.userAgent;
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return navigator.platform || 'Unknown';
}

function toggleMenu(): void {
  if (menuOpen.value) {
    closeMenu(true);
  } else {
    void openMenu();
  }
}

async function openMenu(edge: 'current' | 'first' | 'last' = 'current'): Promise<void> {
  if (menuOpen.value) {
    focusMenuItem(edge);
    return;
  }

  const trigger = triggerElement.value;
  if (!trigger) return;

  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  menuStyle.value = {
    left: `${Math.round(rect.left)}px`,
    bottom: '35px',
    visibility: 'hidden',
  };
  menuOpen.value = true;
  await nextTick();

  const width = menuElement.value?.offsetWidth ?? 0;
  const viewportWidth = Math.min(
    window.innerWidth,
    document.documentElement.clientWidth || window.innerWidth,
  );
  const left = Math.min(
    Math.max(margin, rect.left),
    Math.max(margin, viewportWidth - width - margin),
  );
  menuStyle.value = {
    left: `${Math.round(left)}px`,
    bottom: '35px',
    visibility: 'visible',
  };

  attachDismissListeners();
  focusMenuItem(edge);
}

function focusMenuItem(edge: 'current' | 'first' | 'last'): void {
  const items = menuItems();
  if (!items.length) return;

  if (edge === 'first') {
    items[0].focus();
  } else if (edge === 'last') {
    items[items.length - 1].focus();
  } else {
    const active = items.find((item) => item.getAttribute('aria-checked') === 'true');
    (active ?? items[0]).focus();
  }
}

function menuItems(): HTMLButtonElement[] {
  if (!menuElement.value) return [];
  return Array.from(
    menuElement.value.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
  );
}

function attachDismissListeners(): void {
  detachMenu?.();

  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (menuElement.value?.contains(target) || triggerElement.value?.contains(target)) return;
    closeMenu();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeMenu(true);
  };
  const onDismiss = (): void => closeMenu();

  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('scroll', onDismiss, true);
  window.addEventListener('resize', onDismiss);
  window.addEventListener('blur', onDismiss);

  detachMenu = () => {
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onDismiss, true);
    window.removeEventListener('resize', onDismiss);
    window.removeEventListener('blur', onDismiss);
  };
}

function closeMenu(restoreFocus = false): void {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  menuStyle.value = {};
  detachMenu?.();
  detachMenu = null;
  if (restoreFocus) triggerElement.value?.focus({ preventScroll: true });
}

function selectMode(mode: ViewMode): void {
  emit('modeChange', mode);
  closeMenu(true);
}

function onMenuKeyDown(event: KeyboardEvent): void {
  const items = menuItems();
  if (!items.length) return;

  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    items[(index + 1) % items.length]?.focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    items[(index - 1 + items.length) % items.length]?.focus();
  } else if (event.key === 'Home') {
    event.preventDefault();
    items[0].focus();
  } else if (event.key === 'End') {
    event.preventDefault();
    items[items.length - 1].focus();
  } else if (event.key === 'Tab') {
    closeMenu();
  }
}
</script>

<template>
  <footer class="status-bar">
    <div class="status-left">
      <span
        v-if="vimEnabled"
        class="status-vim"
        :aria-label="`Vim 模式：${vimModeLabel}`"
      >
        {{ vimModeLabel }}
      </span>
      <button
        type="button"
        class="status-focus"
        :class="{ active: immersive }"
        :aria-pressed="immersive"
        title="沉浸式写作（Ctrl+Shift+M）"
        @click="emit('immersiveToggle')"
      >
        专注
      </button>
      <div
        v-if="vimEnabled"
        class="status-vim-command"
        aria-label="Vim 命令输入"
      ></div>
    </div>

    <div class="status-right">
      <button
        ref="triggerElement"
        type="button"
        class="status-mode"
        :class="{ open: menuOpen }"
        aria-label="切换编辑模式"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        aria-controls="status-mode-menu"
        @click="toggleMenu"
        @keydown.down.prevent="openMenu('first')"
        @keydown.up.prevent="openMenu('last')"
      >
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
      </button>
      <span class="status-item">
        行 {{ line ?? '-' }}, 列 {{ column ?? '-' }}
      </span>
      <span class="status-item">空格: 4</span>
      <span class="status-item">UTF-8</span>
      <span class="status-item">{{ lineEnding }}</span>
      <span class="status-item">{{ osName }}</span>
    </div>
  </footer>

  <Teleport to="body">
    <Transition name="mode-menu">
      <div
        v-if="menuOpen"
        id="status-mode-menu"
        ref="menuElement"
        class="mode-menu"
        role="menu"
        aria-label="编辑模式"
        :style="menuStyle"
        @keydown="onMenuKeyDown"
      >
        <button
          v-for="item in VIEW_MODES"
          :key="item.id"
          type="button"
          class="mode-menu-item"
          role="menuitemradio"
          :aria-checked="item.id === mode"
          :title="
            item.id === 'wysiwyg'
              ? '编辑时会规范化 Markdown 格式'
              : undefined
          "
          @click="selectMode(item.id)"
        >
          <span class="mode-menu-check" aria-hidden="true">
            <svg v-if="item.id === mode" viewBox="0 0 24 24">
              <path
                d="m5 12.5 4.2 4.2L19 7"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span>{{ item.label }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.status-bar {
  display: flex;
  grid-column: 1 / -1;
  grid-row: 3;
  align-items: center;
  justify-content: space-between;
  height: 31px;
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

.status-left {
  flex: 1;
  overflow: hidden;
}

.status-right {
  flex-shrink: 0;
  gap: 12px;
  padding-right: 4px;
  overflow: hidden;
}

.status-vim-command {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  height: 100%;
  padding-left: 6px;
  overflow: hidden;
}

.status-vim-command :deep(> div) {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.status-vim-command :deep(input) {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--statusbar-ink);
  caret-color: var(--statusbar-ink);
  font-family: var(--mono-font);
  font-size: 11.5px;
}

.status-vim-command :deep(span) {
  flex-shrink: 0;
  color: var(--statusbar-ink);
  font-family: var(--mono-font);
  font-size: 11.5px;
  white-space: nowrap;
}

.status-mode {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--statusbar-ink);
  font: inherit;
  cursor: pointer;
  appearance: none;
}

.status-mode:hover,
.status-mode.open {
  background: var(--statusbar-hover);
}

.status-mode:focus-visible {
  outline: 1px solid var(--statusbar-ink);
  outline-offset: -1px;
}

.status-mode svg {
  width: 12px;
  height: 12px;
  opacity: 0.8;
  transition: transform 120ms ease;
}

.status-mode.open svg {
  transform: rotate(180deg);
}

.mode-menu {
  position: fixed;
  z-index: 150;
  display: flex;
  flex-direction: column;
  min-width: 176px;
  max-height: calc(100vh - 44px);
  padding: 4px;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--menu-shadow);
  color: var(--ink);
  font-size: 12.5px;
  user-select: none;
  scrollbar-width: thin;
}

.mode-menu-item {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 6px 10px 6px 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.mode-menu-item:hover,
.mode-menu-item:focus-visible {
  background: var(--accent-soft);
  outline: none;
}

.mode-menu-check {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--accent);
}

.mode-menu-check svg {
  width: 14px;
  height: 14px;
}

.mode-menu-enter-active,
.mode-menu-leave-active {
  transition:
    opacity 100ms ease,
    transform 100ms ease;
}

.mode-menu-enter-from,
.mode-menu-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .mode-menu-enter-active,
  .mode-menu-leave-active,
  .status-mode svg {
    transition: none;
  }
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

.status-focus {
  height: 22px;
  padding: 0 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--statusbar-muted);
  font: inherit;
  cursor: pointer;
}

.status-focus:hover {
  background: var(--statusbar-hover);
  color: var(--statusbar-ink);
}

.status-focus.active {
  background: var(--statusbar-hover);
  color: var(--statusbar-ink);
  font-weight: 600;
}

.status-focus:focus-visible {
  outline: 1px solid var(--statusbar-ink);
  outline-offset: -1px;
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
