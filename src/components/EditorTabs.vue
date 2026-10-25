<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { t } from '../lib/i18n';

interface TabItem {
  path: string;
  name: string;
  dirty: boolean;
  kind: 'note' | 'image';
}

const props = defineProps<{
  tabs: TabItem[];
  activePath: string | null;
  previewPath: string | null;
}>();

const emit = defineEmits<{
  select: [path: string];
  close: [path: string];
  pin: [path: string];
}>();

const tabElements = ref(new Map<string, HTMLElement>());

function setTabRef(
  path: string,
  element: Element | ComponentPublicInstance | null,
): void {
  if (element instanceof HTMLElement) {
    tabElements.value.set(path, element);
  } else {
    tabElements.value.delete(path);
  }
}

function closeTab(event: MouseEvent, path: string): void {
  event.stopPropagation();
  emit('close', path);
}

function onAuxClick(event: MouseEvent, path: string): void {
  if (event.button === 1) {
    event.preventDefault();
    emit('close', path);
  }
}

watch(
  () => [props.activePath, props.tabs.length],
  async () => {
    await nextTick();
    if (!props.activePath) return;
    tabElements.value
      .get(props.activePath)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  },
);
</script>

<template>
  <div class="tabline" role="tablist" :aria-label="t('tabs.openFiles')">
    <div
      v-for="tab in tabs"
      :key="tab.path"
      :ref="(element) => setTabRef(tab.path, element)"
      class="tab"
      :class="{
        active: tab.path === activePath,
        dirty: tab.dirty,
        preview: tab.path === previewPath,
      }"
      role="tab"
      :aria-selected="tab.path === activePath"
      :tabindex="tab.path === activePath ? 0 : -1"
      :title="
        tab.path === previewPath
          ? t('tabs.previewTitle', { path: tab.path })
          : tab.path
      "
      @click="emit('select', tab.path)"
      @dblclick="emit('pin', tab.path)"
      @keydown.enter.prevent="emit('select', tab.path)"
      @keydown.space.prevent="emit('select', tab.path)"
      @auxclick="onAuxClick($event, tab.path)"
    >
      <svg
        v-if="tab.kind === 'image'"
        class="tab-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.6" />
        <circle cx="8.5" cy="9.5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.4" />
        <path d="m4.5 17 4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
      </svg>
      <svg v-else class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
        <path
          d="M14 3.5V8h4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
      </svg>
      <span class="tab-name">{{ tab.name }}</span>
      <span class="tab-action">
        <span class="tab-dirty" :aria-label="t('tabs.unsaved')"></span>
        <button
          class="tab-close"
          type="button"
          :aria-label="t('tabs.closeAria', { name: tab.name })"
          :title="t('tabs.close')"
          @click="closeTab($event, tab.path)"
        >
          ×
        </button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.tabline {
  display: flex;
  flex: 1;
  min-width: 0;
  height: 38px;
  align-items: stretch;
  padding: 0 6px;
  overflow-x: auto;
  overflow-y: hidden;
  background: var(--bg-soft);
  border-bottom: 1px solid var(--border);
  scrollbar-width: thin;
}

.tab {
  display: flex;
  flex: 0 1 210px;
  min-width: 120px;
  max-width: 240px;
  height: 100%;
  align-items: center;
  gap: 7px;
  padding: 0 8px 0 12px;
  border-right: 1px solid var(--border);
  border-top: 2px solid transparent;
  color: var(--muted);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}

.tab:hover {
  background: var(--hover);
  color: var(--ink);
}

.tab.active {
  border-top-color: var(--accent);
  background: var(--panel);
  color: var(--ink);
}

.tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.tab-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--faint);
}

.tab.active .tab-icon {
  color: var(--accent);
}

.tab-name {
  flex: 1;
  overflow: hidden;
  font-family: var(--mono-font);
  font-size: 13px;
  text-overflow: ellipsis;
}

.tab.preview .tab-name {
  font-style: italic;
  opacity: 0.88;
}

.tab.active .tab-name {
  font-weight: 600;
}

.tab-action {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 18px;
  height: 18px;
}

.tab-dirty {
  display: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ink);
}

.tab.dirty .tab-dirty {
  display: block;
}

.tab-close {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  opacity: 0;
}

.tab.active .tab-close,
.tab:hover .tab-close,
.tab:focus-within .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: var(--hover-strong);
  color: var(--ink);
}

.tab.dirty .tab-close {
  display: none;
}

.tab.dirty:hover .tab-close,
.tab.dirty:focus-within .tab-close {
  display: grid;
}

.tab.dirty:hover .tab-dirty,
.tab.dirty:focus-within .tab-dirty {
  display: none;
}
</style>
