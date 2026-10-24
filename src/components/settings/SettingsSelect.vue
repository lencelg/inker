<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
} from 'vue';
import { Check, ChevronDown } from '@lucide/vue';
import type { SettingsOption } from '../../lib/settingsSchema';

const props = defineProps<{
  modelValue: string;
  options: SettingsOption[];
  labelledby: string;
}>();

const emit = defineEmits<{
  update: [value: string];
}>();

const menuId = `settings-select-${useId()}`;
const triggerElement = ref<HTMLButtonElement | null>(null);
const menuElement = ref<HTMLElement | null>(null);
const menuOpen = ref(false);
const menuStyle = ref<Record<string, string>>({});
let detachMenu: (() => void) | null = null;

const selectedIndex = computed(() =>
  Math.max(
    0,
    props.options.findIndex((option) => option.value === props.modelValue),
  ),
);
const selectedLabel = computed(
  () =>
    props.options.find((option) => option.value === props.modelValue)?.label ??
    '',
);

onBeforeUnmount(() => closeMenu());

async function toggleMenu(): Promise<void> {
  if (menuOpen.value) closeMenu(true);
  else await openMenu('selected');
}

async function openMenu(
  edge: 'first' | 'last' | 'selected' = 'selected',
): Promise<void> {
  if (menuOpen.value) {
    focusOption(edge);
    return;
  }

  const trigger = triggerElement.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  menuStyle.value = {
    left: `${Math.round(rect.left)}px`,
    top: `${Math.round(rect.bottom + 4)}px`,
    width: `${Math.round(rect.width)}px`,
    visibility: 'hidden',
  };
  menuOpen.value = true;
  await nextTick();

  const menu = menuElement.value;
  if (!menu) return;
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;
  const left = Math.min(
    Math.max(margin, rect.left),
    Math.max(margin, window.innerWidth - menuWidth - margin),
  );
  let top = rect.bottom + 4;
  if (top + menuHeight > window.innerHeight - margin) {
    const above = rect.top - menuHeight - 4;
    top =
      above >= margin
        ? above
        : Math.max(margin, window.innerHeight - menuHeight - margin);
  }

  menuStyle.value = {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    width: `${Math.round(rect.width)}px`,
    visibility: 'visible',
  };

  attachDismissListeners();
  focusOption(edge);
}

function focusOption(edge: 'first' | 'last' | 'selected'): void {
  const options = menuOptions();
  if (!options.length) return;
  if (edge === 'first') options[0].focus();
  else if (edge === 'last') options[options.length - 1].focus();
  else options[Math.min(selectedIndex.value, options.length - 1)]?.focus();
}

function menuOptions(): HTMLButtonElement[] {
  if (!menuElement.value) return [];
  return Array.from(
    menuElement.value.querySelectorAll<HTMLButtonElement>('[role="option"]'),
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
  const onScroll = (event: Event): void => {
    const target = event.target;
    if (target instanceof Node && menuElement.value?.contains(target)) return;
    closeMenu();
  };
  const onDismiss = (): void => closeMenu();

  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onDismiss);
  window.addEventListener('blur', onDismiss);

  detachMenu = () => {
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onScroll, true);
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
  if (restoreFocus) {
    triggerElement.value?.focus({ preventScroll: true });
  }
}

function chooseOption(value: string): void {
  closeMenu(true);
  if (value !== props.modelValue) emit('update', value);
}

function onMenuKeyDown(event: KeyboardEvent): void {
  const options = menuOptions();
  if (!options.length) return;
  const index = options.indexOf(document.activeElement as HTMLButtonElement);

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    options[(index + 1) % options.length]?.focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    options[(index - 1 + options.length) % options.length]?.focus();
  } else if (event.key === 'Home') {
    event.preventDefault();
    options[0].focus();
  } else if (event.key === 'End') {
    event.preventDefault();
    options[options.length - 1].focus();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    (document.activeElement as HTMLButtonElement | null)?.click();
  } else if (event.key === 'Tab') {
    event.preventDefault();
    closeMenu(true);
  }
}

function onTriggerKeyDown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    void openMenu('selected');
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    void openMenu(event.key === 'Home' ? 'first' : 'last');
  }
}
</script>

<template>
  <div class="settings-select">
    <button
      ref="triggerElement"
      type="button"
      class="settings-select-trigger"
      :class="{ open: menuOpen }"
      aria-haspopup="listbox"
      :aria-expanded="menuOpen"
      :aria-controls="menuId"
      :aria-labelledby="labelledby"
      @click="toggleMenu"
      @keydown="onTriggerKeyDown"
    >
      <span class="settings-select-value">{{ selectedLabel }}</span>
      <ChevronDown
        :size="14"
        class="settings-select-chevron"
        aria-hidden="true"
      />
    </button>

    <Teleport to="body">
      <div
        v-if="menuOpen"
        :id="menuId"
        ref="menuElement"
        class="settings-select-menu"
        role="listbox"
        :aria-labelledby="labelledby"
        :style="menuStyle"
        @keydown="onMenuKeyDown"
      >
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          class="settings-select-option"
          :class="{ selected: option.value === modelValue }"
          role="option"
          :aria-selected="option.value === modelValue"
          @click="chooseOption(option.value)"
        >
          <span class="settings-select-check" aria-hidden="true">
            <Check
              v-if="option.value === modelValue"
              :size="12"
              :stroke-width="3"
            />
          </span>
          <span class="settings-select-option-label">{{ option.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.settings-select {
  position: relative;
  width: min(280px, 100%);
}

.settings-select-trigger {
  display: flex;
  width: 100%;
  height: 28px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 3px;
  outline: 0;
  background: var(--bg-soft);
  color: var(--ink);
  font-size: 11.5px;
  text-align: left;
}

.settings-select-trigger:hover {
  border-color: var(--faint);
}

.settings-select-trigger:focus-visible,
.settings-select-trigger.open {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.settings-select-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-select-chevron {
  flex-shrink: 0;
  color: var(--muted);
  transition: transform 0.12s ease;
}

.settings-select-trigger.open .settings-select-chevron {
  transform: rotate(180deg);
}

.settings-select-menu {
  position: fixed;
  z-index: 260;
  max-height: 240px;
  padding: 3px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel);
  color: var(--ink);
  box-shadow: var(--menu-shadow);
  scrollbar-width: thin;
  scrollbar-color: var(--border) var(--panel);
  animation: settings-select-enter 0.1s ease-out;
}

.settings-select-menu::-webkit-scrollbar {
  width: 9px;
}

.settings-select-menu::-webkit-scrollbar-track {
  background: var(--panel);
}

.settings-select-menu::-webkit-scrollbar-thumb {
  border: 2px solid var(--panel);
  border-radius: 7px;
  background: var(--border);
}

.settings-select-menu::-webkit-scrollbar-thumb:hover {
  background: var(--faint);
}

.settings-select-option {
  display: flex;
  width: 100%;
  min-height: 27px;
  align-items: center;
  gap: 5px;
  padding: 4px 7px 4px 5px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--ink);
  font-size: 11.5px;
  text-align: left;
}

.settings-select-option:hover,
.settings-select-option:focus {
  outline: 0;
  background: var(--hover-strong);
}

.settings-select-option.selected {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.settings-select-check {
  display: grid;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  place-items: center;
  color: var(--accent);
}

.settings-select-option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes settings-select-enter {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
