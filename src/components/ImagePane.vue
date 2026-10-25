<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { api } from '../api';
import {
  MAX_IMAGE_ZOOM,
  MIN_IMAGE_ZOOM,
  clampImagePosition,
  clampImageZoom,
  zoomImageAroundPoint,
  type ImageViewState,
} from '../lib/imageView';
import { basename } from '../lib/paths';
import { localizeError, t } from '../lib/i18n';

const props = defineProps<{
  path: string;
}>();

const name = computed(() => basename(props.path));
const source = ref('');
const loading = ref(true);
const error = ref('');
const dimensions = ref<{ width: number; height: number } | null>(null);
const stage = ref<HTMLElement | null>(null);
const image = ref<HTMLImageElement | null>(null);
const view = ref<ImageViewState>({ scale: 1, x: 0, y: 0 });
const dragging = ref(false);
let dragState: {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
} | null = null;
let loadRun = 0;

const zoomPercent = computed(() => Math.round(view.value.scale * 100));
const errorText = computed(() => localizeError(error.value));
const canZoomIn = computed(() => view.value.scale < MAX_IMAGE_ZOOM);
const canZoomOut = computed(() => view.value.scale > MIN_IMAGE_ZOOM);
const imageTransform = computed(
  () =>
    `translate3d(${view.value.x}px, ${view.value.y}px, 0) scale(${view.value.scale})`,
);

watch(
  () => props.path,
  async (path) => {
    const run = ++loadRun;
    loading.value = true;
    error.value = '';
    source.value = '';
    dimensions.value = null;
    resetView();

    try {
      const asset = await api.readImage(path);
      if (run !== loadRun) return;
      source.value = `data:${asset.mime};base64,${asset.data}`;
    } catch (err) {
      if (run !== loadRun) return;
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      if (run === loadRun) loading.value = false;
    }
  },
  { immediate: true },
);

function resetView(): void {
  dragging.value = false;
  dragState = null;
  view.value = { scale: 1, x: 0, y: 0 };
}

function applyView(next: ImageViewState): void {
  const root = stage.value;
  const element = image.value;
  if (!root || !element) {
    view.value = next;
    return;
  }

  view.value = clampImagePosition(
    next,
    { width: element.offsetWidth, height: element.offsetHeight },
    { width: root.clientWidth, height: root.clientHeight },
  );
}

function zoomBy(factor: number): void {
  const root = stage.value;
  if (!root) return;
  const width = root.clientWidth;
  const height = root.clientHeight;
  const next = zoomImageAroundPoint(
    view.value,
    view.value.scale * factor,
    { x: width / 2, y: height / 2 },
    { width, height },
  );
  applyView(next);
}

function onWheel(event: WheelEvent): void {
  const root = stage.value;
  if (!root || !source.value) return;

  const rect = root.getBoundingClientRect();
  const delta =
    event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
  const next = zoomImageAroundPoint(
    view.value,
    clampImageZoom(view.value.scale * Math.exp(-delta * 0.0015)),
    {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    },
    { width: root.clientWidth, height: root.clientHeight },
  );
  applyView(next);
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !source.value) return;
  const root = stage.value;
  if (!root) return;

  event.preventDefault();
  dragging.value = true;
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: view.value.x,
    originY: view.value.y,
  };
  root.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value || !dragState) return;
  if (event.pointerId !== dragState.pointerId) return;
  event.preventDefault();
  applyView({
    scale: view.value.scale,
    x: dragState.originX + event.clientX - dragState.startX,
    y: dragState.originY + event.clientY - dragState.startY,
  });
}

function endDrag(): void {
  if (!dragging.value) return;
  dragging.value = false;
  const state = dragState;
  dragState = null;
  const root = stage.value;
  if (root && state && root.hasPointerCapture(state.pointerId)) {
    root.releasePointerCapture(state.pointerId);
  }
}

function onImageLoad(event: Event): void {
  const element = event.target as HTMLImageElement;
  dimensions.value = {
    width: element.naturalWidth,
    height: element.naturalHeight,
  };
  resetView();
}

function onWindowResize(): void {
  applyView(view.value);
}

onMounted(() => {
  window.addEventListener('resize', onWindowResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
  resetView();
});
</script>

<template>
  <section class="image-viewer" :aria-label="t('image.aria', { name })">
    <div
      ref="stage"
      class="image-stage"
      :class="{ dragging }"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @dblclick="resetView"
    >
      <div v-if="loading" class="image-state">{{ t('image.loading') }}</div>
      <div v-else-if="error" class="image-state error">
        <strong>{{ t('image.errorTitle') }}</strong>
        <span>{{ errorText }}</span>
      </div>
      <img
        v-else
        ref="image"
        class="image-content"
        :src="source"
        :alt="name"
        :title="path"
        :style="{ transform: imageTransform }"
        draggable="false"
        @load="onImageLoad"
        @dragstart.prevent
      />
    </div>

    <footer class="image-footer">
      <span class="image-name">{{ name }}</span>
      <span class="image-hint">{{ t('image.hint') }}</span>
      <div class="image-meta">
        <span v-if="dimensions" class="image-dimensions">
          {{ dimensions.width }} × {{ dimensions.height }}
        </span>
        <template v-if="source">
          <button
            type="button"
            class="image-zoom-button"
            :title="t('image.zoomOut')"
            :aria-label="t('image.zoomOutAria')"
            :disabled="!canZoomOut"
            @click="zoomBy(0.8)"
          >
            −
          </button>
          <span class="image-zoom-value">{{ zoomPercent }}%</span>
          <button
            type="button"
            class="image-zoom-button"
            :title="t('image.zoomIn')"
            :aria-label="t('image.zoomInAria')"
            :disabled="!canZoomIn"
            @click="zoomBy(1.25)"
          >
            +
          </button>
          <button
            type="button"
            class="image-reset"
            :title="t('image.resetTitle')"
            @click="resetView"
          >
            {{ t('image.reset') }}
          </button>
        </template>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.image-viewer {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: var(--panel);
}

.image-stage {
  display: flex;
  min-height: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 42%, var(--hover-strong), transparent 62%),
    var(--bg-soft);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.image-stage.dragging {
  cursor: grabbing;
}

.image-content {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transform-origin: center center;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel);
  box-shadow: var(--shadow);
  pointer-events: none;
  will-change: transform;
}

.image-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
}

.image-state.error strong {
  color: var(--error);
  font-size: 13px;
  font-weight: 600;
}

.image-state.error span {
  color: var(--muted);
}

.image-footer {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 16px;
  padding: 7px 14px;
  border-top: 1px solid var(--border);
  background: var(--bg-soft);
  color: var(--muted);
  font-size: 11px;
}

.image-name {
  min-width: 0;
  overflow: hidden;
  font-family: var(--mono-font);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-hint {
  flex: 1;
  overflow: hidden;
  color: var(--faint);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-meta {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
}

.image-dimensions {
  margin-right: 4px;
  font-family: var(--mono-font);
}

.image-zoom-button,
.image-reset {
  height: 22px;
  padding: 0 7px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel);
  color: var(--muted);
  font-size: 11px;
}

.image-zoom-button {
  display: grid;
  width: 22px;
  padding: 0;
  place-items: center;
  font-size: 14px;
  line-height: 1;
}

.image-zoom-button:hover:not(:disabled),
.image-reset:hover {
  border-color: var(--btn-hover-border);
  background: var(--btn-hover-bg);
  color: var(--ink);
}

.image-zoom-button:disabled {
  opacity: 0.4;
}

.image-zoom-value {
  min-width: 38px;
  font-family: var(--mono-font);
  text-align: center;
}
</style>
