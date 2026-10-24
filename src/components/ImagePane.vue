<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '../api';
import { basename } from '../lib/paths';

const props = defineProps<{
  path: string;
}>();

const name = computed(() => basename(props.path));
const source = ref('');
const loading = ref(true);
const error = ref('');
const dimensions = ref<{ width: number; height: number } | null>(null);
let loadRun = 0;

watch(
  () => props.path,
  async (path) => {
    const run = ++loadRun;
    loading.value = true;
    error.value = '';
    source.value = '';
    dimensions.value = null;

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

function onImageLoad(event: Event): void {
  const image = event.target as HTMLImageElement;
  dimensions.value = {
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}
</script>

<template>
  <section class="image-viewer" :aria-label="`图片 ${name}`">
    <div class="image-stage">
      <div v-if="loading" class="image-state">正在加载图片…</div>
      <div v-else-if="error" class="image-state error">
        <strong>无法打开图片</strong>
        <span>{{ error }}</span>
      </div>
      <img
        v-else
        class="image-content"
        :src="source"
        :alt="name"
        :title="path"
        @load="onImageLoad"
      />
    </div>

    <footer class="image-footer">
      <span class="image-name">{{ name }}</span>
      <span v-if="dimensions" class="image-dimensions">
        {{ dimensions.width }} × {{ dimensions.height }}
      </span>
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
  overflow: auto;
  background:
    radial-gradient(circle at 50% 42%, var(--hover-strong), transparent 62%),
    var(--bg-soft);
}

.image-content {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel);
  box-shadow: var(--shadow);
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
  justify-content: space-between;
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

.image-dimensions {
  flex-shrink: 0;
  font-family: var(--mono-font);
}
</style>
