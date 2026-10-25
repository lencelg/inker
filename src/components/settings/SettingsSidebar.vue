<script setup lang="ts">
import { computed } from 'vue';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FolderCog,
  Settings2,
} from '@lucide/vue';
import { t } from '../../lib/i18n';
import type {
  SettingDefinition,
  SettingsCategory,
  SettingsCategoryId,
  SettingsScope,
  SettingsSection,
} from '../../lib/settingsSchema';

const props = defineProps<{
  scope: SettingsScope;
  categories: readonly SettingsCategory[];
  sections: SettingsSection[];
  activeCategory: SettingsCategoryId;
  expandedCategories: SettingsCategoryId[];
  matchCounts: Record<SettingsCategoryId, number>;
  matchedIds: string[];
  filtering: boolean;
}>();

const emit = defineEmits<{
  changeScope: [scope: SettingsScope];
  selectCategory: [category: SettingsCategoryId];
  toggleCategory: [category: SettingsCategoryId];
  selectSetting: [setting: SettingDefinition];
}>();

const categoryIcons = {
  settings: Settings2,
  editor: FileText,
  preview: Eye,
  export: Download,
} as const;

const userCategories = computed(() =>
  props.categories.map((category) => ({
    ...category,
    items:
      props.sections.find((section) => section.id === category.id)?.items ?? [],
  })),
);

function categoryIcon(icon: SettingsCategory['icon']) {
  return categoryIcons[icon];
}

function isExpanded(category: SettingsCategoryId): boolean {
  return props.filtering || props.expandedCategories.includes(category);
}

function isVisible(category: SettingsCategoryId): boolean {
  return !props.filtering || props.matchCounts[category] > 0;
}

function isSettingMatch(setting: SettingDefinition): boolean {
  return !props.filtering || props.matchedIds.includes(setting.id);
}
</script>

<template>
  <aside class="settings-sidebar" :aria-label="t('settings.nav')">
    <div class="scope-tabs" role="tablist" :aria-label="t('settings.scope')">
      <button
        type="button"
        class="scope-tab"
        :class="{ active: scope === 'user' }"
        role="tab"
        :aria-selected="scope === 'user'"
        @click="emit('changeScope', 'user')"
      >
        {{ t('settings.user') }}
      </button>
      <button
        type="button"
        class="scope-tab"
        :class="{ active: scope === 'workspace' }"
        role="tab"
        :aria-selected="scope === 'workspace'"
        @click="emit('changeScope', 'workspace')"
      >
        {{ t('settings.workspace') }}
      </button>
    </div>

    <nav v-if="scope === 'user'" class="settings-tree" :aria-label="t('settings.categories')">
      <div
        v-for="category in userCategories"
        :key="category.id"
        class="tree-group"
      >
        <div
          class="tree-category"
          :class="{
            active: activeCategory === category.id,
            matched: filtering && matchCounts[category.id] > 0,
            dimmed: !isVisible(category.id),
          }"
        >
          <button
            type="button"
            class="tree-chevron"
            :aria-label="
              isExpanded(category.id)
                ? t('settings.collapseCategory')
                : t('settings.expandCategory')
            "
            :aria-expanded="isExpanded(category.id)"
            :disabled="filtering"
            @click="emit('toggleCategory', category.id)"
          >
            <ChevronDown v-if="isExpanded(category.id)" :size="13" aria-hidden="true" />
            <ChevronRight v-else :size="13" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="tree-category-label"
            :disabled="!isVisible(category.id)"
            @click="emit('selectCategory', category.id)"
          >
            <component
              :is="categoryIcon(category.icon)"
              :size="15"
              class="category-icon"
              aria-hidden="true"
            />
            <span class="category-label">{{ category.label }}</span>
            <span
              v-if="filtering && matchCounts[category.id] > 0"
              class="match-count"
            >
              {{ matchCounts[category.id] }}
            </span>
          </button>
        </div>

        <div v-if="isExpanded(category.id)" class="tree-children">
          <button
            v-for="item in category.items"
            :key="item.id"
            type="button"
            class="tree-setting"
            :class="{
              matched: isSettingMatch(item),
              dimmed: !isSettingMatch(item),
            }"
            :disabled="!isSettingMatch(item)"
            @click="emit('selectSetting', item)"
          >
            {{ item.title }}
          </button>
        </div>
      </div>
    </nav>

    <div v-else class="scope-empty">
      <span class="scope-empty-icon"><FolderCog :size="24" aria-hidden="true" /></span>
      <strong>{{ t('settings.workspaceTitle') }}</strong>
      <p>{{ t('settings.workspaceEmpty') }}</p>
      <button type="button" @click="emit('changeScope', 'user')">
        {{ t('settings.openUser') }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.settings-sidebar {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-soft);
  border-right: 1px solid var(--border);
}

.scope-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 39px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.scope-tab {
  position: relative;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
}

.scope-tab:hover {
  color: var(--ink);
}

.scope-tab.active {
  color: var(--ink);
}

.scope-tab.active::after {
  position: absolute;
  right: 22%;
  bottom: -1px;
  left: 22%;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--accent);
  content: '';
}

.settings-tree {
  min-height: 0;
  flex: 1;
  padding: 8px 0 18px;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.settings-tree::-webkit-scrollbar,
.scope-empty::-webkit-scrollbar {
  width: 8px;
}

.settings-tree::-webkit-scrollbar-track,
.scope-empty::-webkit-scrollbar-track {
  background: transparent;
}

.settings-tree::-webkit-scrollbar-thumb,
.scope-empty::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 6px;
}

.settings-tree::-webkit-scrollbar-thumb:hover,
.scope-empty::-webkit-scrollbar-thumb:hover {
  background: var(--faint);
}

.tree-group + .tree-group {
  margin-top: 2px;
}

.tree-category {
  display: flex;
  min-width: 0;
  align-items: center;
  height: 32px;
  padding: 0 8px 0 4px;
  color: var(--muted);
}

.tree-category:hover {
  background: var(--hover);
}

.tree-category.active {
  background: var(--hover-strong);
  color: var(--ink);
}

.tree-category.matched {
  color: var(--accent-strong);
}

.tree-category.dimmed {
  color: var(--faint);
}

.tree-chevron {
  display: grid;
  width: 20px;
  height: 26px;
  flex-shrink: 0;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--muted);
}

.tree-chevron:disabled {
  opacity: 0.45;
}

.tree-chevron:hover:not(:disabled) {
  color: var(--ink);
}

.tree-category-label {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 7px;
  height: 100%;
  padding: 0 4px 0 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.tree-category-label:disabled {
  cursor: default;
}

.category-icon {
  flex-shrink: 0;
  opacity: 0.9;
}

.category-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-count {
  display: grid;
  min-width: 17px;
  height: 17px;
  flex-shrink: 0;
  place-items: center;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 10px;
}

.tree-children {
  padding: 1px 8px 4px 40px;
}

.tree-setting {
  display: block;
  width: 100%;
  padding: 4px 7px;
  overflow: hidden;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--muted);
  font-family: var(--mono-font);
  font-size: 10.5px;
  line-height: 1.5;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-setting:hover:not(:disabled) {
  background: var(--hover);
  color: var(--ink);
}

.tree-setting.matched {
  color: var(--accent);
}

.tree-setting.dimmed {
  color: var(--faint);
}

.scope-empty {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
  overflow: auto;
  color: var(--muted);
  text-align: center;
}

.scope-empty-icon {
  display: grid;
  width: 44px;
  height: 44px;
  margin-bottom: 12px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
  color: var(--accent);
}

.scope-empty strong {
  color: var(--ink);
  font-size: 12.5px;
  font-weight: 500;
}

.scope-empty p {
  margin: 7px 0 14px;
  font-size: 11px;
  line-height: 1.6;
}

.scope-empty button {
  padding: 5px 10px;
  border: 1px solid var(--primary-bg);
  border-radius: 3px;
  background: var(--primary-bg);
  color: var(--primary-ink);
  font-size: 11.5px;
}

.scope-empty button:hover {
  background: var(--primary-bg-hover);
  border-color: var(--primary-bg-hover);
}
</style>
