<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';

type ExportFormat = 'pdf' | 'html' | 'docx';

const props = defineProps<{
  disabled?: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{ export: [format: ExportFormat] }>();

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: 'pdf', label: 'PDF', hint: '打开打印视图，可另存为 PDF' },
  { id: 'html', label: 'HTML', hint: '自包含的网页文件' },
  { id: 'docx', label: 'Word', hint: 'Microsoft Word 文档' },
];

const menuOpen = ref(false);
const menuStyle = ref<Record<string, string>>({});
const triggerElement = ref<HTMLButtonElement | null>(null);
const menuElement = ref<HTMLElement | null>(null);
let detachMenu: (() => void) | null = null;

onBeforeUnmount(() => closeMenu());

function toggleMenu(): void {
  if (props.disabled) return;
  if (menuOpen.value) closeMenu(true);
  else void openMenu();
}

async function openMenu(): Promise<void> {
  const trigger = triggerElement.value;
  if (!trigger) return;

  const rect = trigger.getBoundingClientRect();
  menuStyle.value = {
    left: `${Math.round(
      Math.max(8, Math.min(rect.right - 200, window.innerWidth - 208)),
    )}px`,
    top: `${Math.round(rect.bottom + 4)}px`,
    visibility: 'hidden',
  };
  menuOpen.value = true;
  await nextTick();

  const width = menuElement.value?.offsetWidth ?? 200;
  const left = Math.min(
    Math.max(8, rect.right - width),
    Math.max(8, window.innerWidth - width - 8),
  );
  menuStyle.value = {
    left: `${Math.round(left)}px`,
    top: `${Math.round(rect.bottom + 4)}px`,
    visibility: 'visible',
  };

  attachDismissListeners();
  menuItems()[0]?.focus();
}

function menuItems(): HTMLButtonElement[] {
  if (!menuElement.value) return [];
  return Array.from(
    menuElement.value.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
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

function choose(format: ExportFormat): void {
  closeMenu(true);
  emit('export', format);
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
    class="export-trigger"
    :disabled="disabled"
    :class="{ open: menuOpen }"
    aria-haspopup="menu"
    :aria-expanded="menuOpen"
    aria-controls="export-menu"
    title="导出当前笔记"
    @click="toggleMenu"
    @keydown.down.prevent="openMenu"
  >
    <span>{{ busy ? '导出中…' : '导出' }}</span>
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

  <Teleport to="body">
    <div
      v-if="menuOpen"
      id="export-menu"
      ref="menuElement"
      class="export-menu"
      role="menu"
      aria-label="导出格式"
      :style="menuStyle"
      @keydown="onMenuKeyDown"
    >
      <p class="export-menu-label">导出当前笔记</p>
      <button
        v-for="format in FORMATS"
        :key="format.id"
        type="button"
        class="export-item"
        role="menuitem"
        :disabled="busy"
        @click="choose(format.id)"
      >
        <span class="export-item-main">{{ format.label }}</span>
        <span class="export-item-hint">{{ format.hint }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.export-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  color: var(--muted);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.export-trigger:hover:not(:disabled),
.export-trigger.open {
  border-color: var(--btn-hover-border);
  background: var(--btn-hover-bg);
  color: var(--ink);
}

.export-trigger:disabled {
  cursor: default;
  opacity: 0.6;
}

.export-trigger:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}

.export-trigger svg {
  width: 12px;
  height: 12px;
  transition: transform 120ms ease;
}

.export-trigger.open svg {
  transform: rotate(180deg);
}

.export-menu {
  position: fixed;
  z-index: 120;
  width: 220px;
  padding: 5px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--menu-shadow);
  color: var(--ink);
}

.export-menu-label {
  margin: 3px 7px 5px;
  color: var(--muted);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.export-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.export-item:hover:not(:disabled),
.export-item:focus-visible {
  background: var(--accent-soft);
  outline: none;
}

.export-item:disabled {
  opacity: 0.5;
  cursor: default;
}

.export-item-main {
  font-size: 12.5px;
}

.export-item-hint {
  color: var(--muted);
  font-size: 10.5px;
}
</style>
