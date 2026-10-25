<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { t } from '../lib/i18n';
import {
  VIEW_MODES,
  viewModeLabel,
  type ViewMode,
} from '../lib/viewModes';

type ExportFormat = 'pdf' | 'html' | 'docx';

const props = defineProps<{
  viewMode: ViewMode;
  vimEnabled: boolean;
  exporting: boolean;
}>();

const emit = defineEmits<{
  modeChange: [mode: ViewMode];
  export: [format: ExportFormat];
  toggleVim: [];
  openSettings: [];
}>();

const EXPORTS: { id: ExportFormat }[] = [
  { id: 'pdf' },
  { id: 'html' },
  { id: 'docx' },
];

function exportLabel(format: ExportFormat): string {
  if (format === 'pdf') return t('export.pdf');
  if (format === 'html') return t('export.html');
  return t('export.docx');
}

const menuOpen = ref(false);
const menuStyle = ref<Record<string, string>>({});
const triggerElement = ref<HTMLButtonElement | null>(null);
const menuElement = ref<HTMLElement | null>(null);
let detachMenu: (() => void) | null = null;

onBeforeUnmount(() => closeMenu());

function toggleMenu(): void {
  if (menuOpen.value) closeMenu(true);
  else void openMenu();
}

async function openMenu(): Promise<void> {
  const trigger = triggerElement.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  menuStyle.value = {
    right: `${Math.round(window.innerWidth - rect.right)}px`,
    top: `${Math.round(rect.bottom + 4)}px`,
    visibility: 'hidden',
  };
  menuOpen.value = true;
  await nextTick();
  menuStyle.value = {
    right: `${Math.round(window.innerWidth - rect.right)}px`,
    top: `${Math.round(rect.bottom + 4)}px`,
    visibility: 'visible',
  };
  attachDismissListeners();
  menuItems()[0]?.focus();
}

function menuItems(): HTMLButtonElement[] {
  if (!menuElement.value) return [];
  return Array.from(
    menuElement.value.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"], [role="menuitemradio"]',
    ),
  );
}

function attachDismissListeners(): void {
  detachMenu?.();
  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (
      menuElement.value?.contains(target) ||
      triggerElement.value?.contains(target)
    ) {
      return;
    }
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

function chooseMode(mode: ViewMode): void {
  closeMenu(true);
  emit('modeChange', mode);
}

function chooseExport(format: ExportFormat): void {
  if (props.exporting) return;
  closeMenu(true);
  emit('export', format);
}

function toggleVim(): void {
  closeMenu(true);
  emit('toggleVim');
}

function openSettings(): void {
  closeMenu(true);
  emit('openSettings');
}

function onMenuKeyDown(event: KeyboardEvent): void {
  const items = menuItems();
  if (items.length === 0) return;
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
  <button
    ref="triggerElement"
    type="button"
    class="app-menu-trigger"
    :class="{ open: menuOpen }"
    aria-haspopup="menu"
    :aria-expanded="menuOpen"
    aria-controls="app-menu"
    :title="t('menu.more')"
    @click="toggleMenu"
    @keydown.down.prevent="openMenu"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m7 9.5 5 5 5-5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>

  <Teleport to="body">
    <div
      v-if="menuOpen"
      id="app-menu"
      ref="menuElement"
      class="app-menu"
      role="menu"
      :aria-label="t('menu.application')"
      :style="menuStyle"
      @keydown="onMenuKeyDown"
    >
      <p class="app-menu-label">{{ t('menu.viewMode') }}</p>
      <button
        v-for="mode in VIEW_MODES"
        :key="mode.id"
        type="button"
        class="app-menu-item"
        role="menuitemradio"
        :aria-checked="mode.id === viewMode"
        @click="chooseMode(mode.id)"
      >
        <span class="app-menu-check" aria-hidden="true">
          <svg v-if="mode.id === viewMode" viewBox="0 0 24 24">
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
        <span>{{ viewModeLabel(mode.id) }}</span>
      </button>

      <div class="app-menu-separator"></div>
      <p class="app-menu-label">{{ t('menu.export') }}</p>
      <button
        v-for="format in EXPORTS"
        :key="format.id"
        type="button"
        class="app-menu-item"
        role="menuitem"
        :disabled="exporting"
        @click="chooseExport(format.id)"
      >
        <span class="app-menu-check" aria-hidden="true"></span>
        <span>{{ exportLabel(format.id) }}</span>
      </button>

      <div class="app-menu-separator"></div>
      <button
        type="button"
        class="app-menu-item"
        role="menuitemcheckbox"
        :aria-checked="vimEnabled"
        @click="toggleVim"
      >
        <span class="app-menu-check" aria-hidden="true">
          <svg v-if="vimEnabled" viewBox="0 0 24 24">
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
        <span>{{ t('menu.vim') }}</span>
      </button>
      <button
        type="button"
        class="app-menu-item"
        role="menuitem"
        @click="openSettings"
      >
        <span class="app-menu-check" aria-hidden="true"></span>
        <span>{{ t('menu.settings') }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.app-menu-trigger {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 38px;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.app-menu-trigger:hover,
.app-menu-trigger.open {
  background: var(--hover);
  color: var(--ink);
}

.app-menu-trigger svg {
  width: 14px;
  height: 14px;
  transition: transform 120ms ease;
}

.app-menu-trigger.open svg {
  transform: rotate(180deg);
}

.app-menu {
  position: fixed;
  z-index: 120;
  width: 224px;
  max-height: calc(100vh - 60px);
  padding: 5px;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--menu-shadow);
  color: var(--ink);
}

.app-menu-label {
  margin: 4px 8px 5px;
  color: var(--muted);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.app-menu-item {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding: 6px 8px 6px 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}

.app-menu-item:hover:not(:disabled),
.app-menu-item:focus-visible {
  background: var(--accent-soft);
  outline: none;
}

.app-menu-item:disabled {
  opacity: 0.5;
  cursor: default;
}

.app-menu-check {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--accent);
}

.app-menu-check svg {
  width: 14px;
  height: 14px;
}

.app-menu-separator {
  height: 1px;
  margin: 5px 4px;
  background: var(--border);
}
</style>
