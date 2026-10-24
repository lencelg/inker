<script setup lang="ts">
import {
  computed,
  nextTick,
  ref,
  type ComponentPublicInstance,
} from 'vue';
import { FolderCog, SearchX, SlidersHorizontal } from '@lucide/vue';
import SettingItem from './SettingItem.vue';
import type {
  SettingDefinition,
  SettingsCategoryId,
  SettingsScope,
  SettingsSection,
  SettingsValue,
} from '../../lib/settingsSchema';

const props = defineProps<{
  scope: SettingsScope;
  activeCategory: SettingsCategoryId;
  sections: SettingsSection[];
  query: string;
  filtering: boolean;
  modifiedOnly: boolean;
  modifiedCount: number;
  totalCount: number;
}>();

const emit = defineEmits<{
  updateSetting: [setting: SettingDefinition, value: SettingsValue];
  resetSetting: [setting: SettingDefinition];
  activeChange: [category: SettingsCategoryId];
  openUser: [];
  clearFilters: [];
}>();

const scrollElement = ref<HTMLDivElement | null>(null);
const sectionElements = new Map<SettingsCategoryId, HTMLElement>();

const activeSection = computed(() => {
  return (
    props.sections.find((section) => section.id === props.activeCategory) ??
    props.sections[0] ??
    null
  );
});

const headingLabel = computed(() => {
  if (props.scope === 'workspace') return '工作区设置';
  return activeSection.value?.label ?? '常用设置';
});

const scopeLabel = computed(() =>
  props.scope === 'workspace' ? '工作区范围' : '用户设置',
);

const visibleItemCount = computed(() =>
  props.sections.reduce((total, section) => total + section.items.length, 0),
);

const emptyTitle = computed(() =>
  props.query.trim() ? '没有找到匹配的设置' : '没有已修改的设置',
);

function setSectionElement(
  id: SettingsCategoryId,
  element: Element | ComponentPublicInstance | null,
): void {
  if (element instanceof HTMLElement) sectionElements.set(id, element);
  else sectionElements.delete(id);
}

function onScroll(): void {
  const scroll = scrollElement.value;
  if (!scroll || props.scope !== 'user') return;

  const marker = scroll.scrollTop + 26;
  let current: SettingsCategoryId | null = null;
  for (const section of props.sections) {
    const element = sectionElements.get(section.id);
    if (element && element.offsetTop <= marker) {
      current = section.id;
    }
  }

  current ??= props.sections[0]?.id ?? null;
  if (current && current !== props.activeCategory) {
    emit('activeChange', current);
  }
}

function scrollToPosition(
  element: HTMLElement,
  top: number,
  behavior: ScrollBehavior,
): void {
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top, behavior });
  } else {
    element.scrollTop = top;
  }
}

async function scrollToCategory(
  category: SettingsCategoryId,
  behavior: ScrollBehavior = 'smooth',
): Promise<void> {
  await nextTick();
  const scroll = scrollElement.value;
  const element = sectionElements.get(category);
  if (!scroll || !element) return;
  scrollToPosition(scroll, Math.max(0, element.offsetTop - 12), behavior);
}

async function scrollToSetting(setting: SettingDefinition): Promise<void> {
  await nextTick();
  const scroll = scrollElement.value;
  if (!scroll) return;
  const element = scroll.querySelector<HTMLElement>(
    `[data-setting-id="${setting.id}"]`,
  );
  if (!element) return;
  scrollToPosition(
    scroll,
    Math.max(0, element.offsetTop - 62),
    'smooth',
  );
}

function scrollToTop(): void {
  const scroll = scrollElement.value;
  if (!scroll) return;
  scrollToPosition(scroll, 0, 'auto');
}

defineExpose({
  scrollToCategory,
  scrollToSetting,
  scrollToTop,
});
</script>

<template>
  <section class="settings-content" aria-label="设置内容">
    <header class="content-header">
      <div class="content-heading">
        <span class="content-eyebrow">{{ scopeLabel }}</span>
        <h2>{{ headingLabel }}</h2>
      </div>
      <div class="content-meta">
        <span v-if="filtering" class="meta-pill">
          {{ visibleItemCount }} 项匹配
        </span>
        <span v-else class="meta-count">{{ totalCount }} 项设置</span>
        <span v-if="modifiedCount" class="meta-pill modified">
          <SlidersHorizontal :size="11" aria-hidden="true" />
          已修改 {{ modifiedCount }}
        </span>
      </div>
    </header>

    <div
      ref="scrollElement"
      class="settings-scroll"
      tabindex="-1"
      @scroll.passive="onScroll"
    >
      <div v-if="scope === 'workspace'" class="content-empty workspace">
        <span class="empty-icon"><FolderCog :size="25" aria-hidden="true" /></span>
        <h3>当前工作区没有设置覆盖</h3>
        <p>
          工作区设置目前为空，所有选项都会继续使用用户设置。后续可以在这里为
          单个笔记文件夹保存独立配置。
        </p>
        <button type="button" class="empty-action" @click="emit('openUser')">
          返回用户设置
        </button>
      </div>

      <div v-else-if="!sections.length" class="content-empty">
        <span class="empty-icon"><SearchX :size="25" aria-hidden="true" /></span>
        <h3>{{ emptyTitle }}</h3>
        <p v-if="query.trim()">
          没有与“{{ query.trim() }}”匹配的设置，请尝试其他关键词。
        </p>
        <p v-else>调整任意设置后，它会显示在这里。</p>
        <button type="button" class="empty-action" @click="emit('clearFilters')">
          清除筛选
        </button>
      </div>

      <div v-else class="settings-sections">
        <section
          v-for="section in sections"
          :key="section.id"
          :ref="(element) => setSectionElement(section.id, element)"
          class="settings-section"
          :data-category="section.id"
          :aria-labelledby="`settings-section-${section.id}`"
        >
          <header class="section-heading">
            <div class="section-title-row">
              <h2 :id="`settings-section-${section.id}`">
                {{ section.label }}
              </h2>
              <span>{{ section.items.length }}</span>
            </div>
            <p>{{ section.description }}</p>
          </header>

          <div class="setting-list">
            <SettingItem
              v-for="setting in section.items"
              :key="setting.id"
              :setting="setting"
              @update="emit('updateSetting', setting, $event)"
              @reset="emit('resetSetting', setting)"
            />
          </div>
        </section>

        <p class="settings-footnote">
          主题、字体和编辑偏好会立即保存，并应用到当前窗口。
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-content {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  background: var(--panel);
}

.content-header {
  display: flex;
  min-height: 58px;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 9px 25px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}

.content-heading {
  min-width: 0;
}

.content-eyebrow {
  color: var(--faint);
  font-size: 9.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.content-heading h2 {
  margin: 1px 0 0;
  color: var(--ink);
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.content-meta {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 10.5px;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--bg-soft);
}

.meta-pill.modified {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.settings-scroll {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) var(--panel);
  scroll-behavior: smooth;
}

.settings-scroll::-webkit-scrollbar {
  width: 11px;
  height: 11px;
}

.settings-scroll::-webkit-scrollbar-track {
  background: var(--panel);
}

.settings-scroll::-webkit-scrollbar-thumb {
  border: 3px solid var(--panel);
  border-radius: 8px;
  background: var(--border);
}

.settings-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--faint);
}

.settings-sections {
  padding: 4px 0 36px;
}

.settings-section {
  padding-top: 2px;
}

.settings-section + .settings-section {
  margin-top: 10px;
  border-top: 1px solid var(--border);
}

.section-heading {
  padding: 19px 25px 10px;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title-row h2 {
  margin: 0;
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
}

.section-title-row span {
  min-width: 18px;
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-soft);
  color: var(--muted);
  font-size: 9.5px;
  text-align: center;
}

.section-heading p {
  max-width: 720px;
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.55;
}

.setting-list {
  border-top: 1px solid var(--border);
}

.settings-footnote {
  margin: 22px 25px 0;
  color: var(--faint);
  font-size: 10px;
  text-align: center;
}

.content-empty {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--muted);
  text-align: center;
}

.empty-icon {
  display: grid;
  width: 52px;
  height: 52px;
  margin-bottom: 14px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-soft);
  color: var(--accent);
}

.content-empty h3 {
  margin: 0;
  color: var(--ink);
  font-size: 14px;
  font-weight: 500;
}

.content-empty p {
  max-width: 380px;
  margin: 8px 0 17px;
  font-size: 11.5px;
  line-height: 1.7;
}

.empty-action {
  padding: 5px 11px;
  border: 1px solid var(--primary-bg);
  border-radius: 3px;
  background: var(--primary-bg);
  color: var(--primary-ink);
  font-size: 11.5px;
}

.empty-action:hover {
  background: var(--primary-bg-hover);
  border-color: var(--primary-bg-hover);
}
</style>
