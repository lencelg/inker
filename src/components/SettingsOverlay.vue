<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';
import SettingsPanel from './SettingsPanel.vue';
import { t } from '../lib/i18n';
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
const offset = ref({ x: 0, y: 0 });
const dragging = ref(false);
const previousFocus =
  document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

let dragState: {
  pointerId: number;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} | null = null;

const panelStyle = computed(() =>
  offset.value.x === 0 && offset.value.y === 0
    ? undefined
    : {
        transform: `translate3d(${offset.value.x}px, ${offset.value.y}px, 0)`,
      },
);

function isInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'button, input, select, textarea, a, .settings-search, [data-no-drag]',
    ) !== null
  );
}

function startDrag(event: PointerEvent): void {
  if (event.button !== 0 || dragging.value) return;
  const target = event.target;
  if (
    !(target instanceof Element) ||
    !target.closest('.settings-header') ||
    isInteractive(target)
  ) {
    return;
  }
  const panel = panelRef.value;
  if (!panel) return;

  const rect = panel.getBoundingClientRect();
  const margin = 8;
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startOffsetX: offset.value.x,
    startOffsetY: offset.value.y,
    minX: offset.value.x + (margin - rect.left),
    maxX: offset.value.x + (window.innerWidth - margin - rect.right),
    minY: offset.value.y + (margin - rect.top),
    maxY: offset.value.y + (window.innerHeight - margin - rect.bottom),
  };
  dragging.value = true;
  panel.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onDragMove(event: PointerEvent): void {
  const state = dragState;
  if (!state || event.pointerId !== state.pointerId) return;
  const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), Math.max(min, max));
  offset.value = {
    x: clamp(
      state.startOffsetX + event.clientX - state.startX,
      state.minX,
      state.maxX,
    ),
    y: clamp(
      state.startOffsetY + event.clientY - state.startY,
      state.minY,
      state.maxY,
    ),
  };
}

function endDrag(event?: PointerEvent): void {
  if (!dragging.value) return;
  dragging.value = false;
  const state = dragState;
  dragState = null;
  const panel = panelRef.value;
  if (panel && state && panel.hasPointerCapture(state.pointerId)) {
    panel.releasePointerCapture(state.pointerId);
  }
  if (event) event.preventDefault();
}

function resetPosition(event: MouseEvent): void {
  if (
    !(event.target instanceof Element) ||
    !event.target.closest('.settings-header') ||
    isInteractive(event.target)
  ) {
    return;
  }
  offset.value = { x: 0, y: 0 };
}

function onWindowResize(): void {
  offset.value = { x: 0, y: 0 };
}

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
  window.addEventListener('resize', onWindowResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('resize', onWindowResize);
  previousFocus?.focus();
});
</script>

<template>
  <div class="settings-overlay" @click.self="emit('close')">
    <section
      ref="panelRef"
      class="settings-panel"
      :class="{ dragging }"
      :style="panelStyle"
      role="dialog"
      aria-modal="true"
      :aria-label="t('settings.title')"
      tabindex="-1"
      @pointerdown="startDrag"
      @pointermove="onDragMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @dblclick="resetPosition"
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

.settings-panel.dragging {
  cursor: grabbing;
  user-select: none;
}

.settings-panel.dragging :deep(.settings-header) {
  cursor: grabbing;
}

.settings-panel :deep(.settings-header) {
  cursor: grab;
  touch-action: none;
}

.settings-panel :deep(.settings-header button) {
  cursor: pointer;
}

.settings-panel :deep(.settings-header input) {
  cursor: text;
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
