<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import SettingsContent from './settings/SettingsContent.vue';
import SettingsHeader from './settings/SettingsHeader.vue';
import SettingsSidebar from './settings/SettingsSidebar.vue';
import type { Preferences } from '../lib/preferences';
import { isWorkspaceOverrideKey } from '../lib/workspaceSettings';
import {
  createSettingsSchema,
  isSettingModified,
  matchesSetting,
  settingsCategories,
  type SettingDefinition,
  type SettingsCategoryId,
  type SettingsScope,
  type SettingsSection,
  type SettingsValue,
} from '../lib/settingsSchema';

const props = defineProps<{
  preferences: Preferences;
  workspacePreferences?: Preferences;
  workspaceAvailable?: boolean;
  maximized: boolean;
}>();

const emit = defineEmits<{
  update: [patch: Partial<Preferences>];
  updateWorkspace: [patch: Partial<Preferences>];
  resetWorkspace: [key: keyof Preferences];
  close: [];
  minimize: [];
  maximize: [];
}>();

const scope = ref<SettingsScope>('user');
const query = ref('');
const modifiedOnly = ref(false);
const activeCategory = ref<SettingsCategoryId>('common');
const expandedCategories = ref<SettingsCategoryId[]>(
  settingsCategories().map((category) => category.id),
);
const localValues = ref<Record<string, SettingsValue>>({});
const contentRef = ref<{
  scrollToCategory: (category: SettingsCategoryId) => Promise<void>;
  scrollToSetting: (setting: SettingDefinition) => Promise<void>;
  scrollToTop: () => void;
} | null>(null);

const categories = computed(() => settingsCategories());
const workspaceAvailable = computed(
  () => props.workspaceAvailable === true,
);
const activePreferences = computed(() =>
  scope.value === 'workspace'
    ? props.workspacePreferences ?? props.preferences
    : props.preferences,
);

const settings = computed(() => {
  const schema = createSettingsSchema(
    activePreferences.value,
    localValues.value,
  );
  if (scope.value === 'user') return schema;

  return schema
    .filter(
      (setting) =>
        workspaceAvailable.value &&
        setting.preference !== undefined &&
        isWorkspaceOverrideKey(setting.preference),
    )
    .map((setting) => ({
      ...setting,
      // In workspace scope "modified" means "overrides the user value".
      defaultValue: props.preferences[setting.preference!],
    }));
});
const normalizedQuery = computed(() => query.value.trim());
const searching = computed(() => normalizedQuery.value.length > 0);
const filtering = computed(() => searching.value || modifiedOnly.value);

const filteredSettings = computed(() =>
  settings.value.filter(
    (setting) =>
      (!modifiedOnly.value || isSettingModified(setting)) &&
      matchesSetting(setting, normalizedQuery.value),
  ),
);

const matchedIds = computed(() =>
  filteredSettings.value.map((setting) => setting.id),
);

const matchCounts = computed(
  () =>
    Object.fromEntries(
      categories.value.map((category) => [
        category.id,
        filteredSettings.value.filter(
          (setting) => setting.category === category.id,
        ).length,
      ]),
    ) as Record<SettingsCategoryId, number>,
);

const sections = computed<SettingsSection[]>(() =>
  categories.value.map((category) => ({
    ...category,
    items: filteredSettings.value.filter(
      (setting) => setting.category === category.id,
    ),
  })).filter((section) => section.items.length > 0),
);

const allSections = computed<SettingsSection[]>(() =>
  categories.value.map((category) => ({
    ...category,
    items: settings.value.filter(
      (setting) => setting.category === category.id,
    ),
  })),
);

const modifiedCount = computed(
  () => settings.value.filter(isSettingModified).length,
);
const totalCount = computed(() => settings.value.length);

watch([normalizedQuery, modifiedOnly], async () => {
  if (scope.value === 'workspace' && !workspaceAvailable.value) {
    return;
  }
  await nextTick();
  const first = sections.value[0];
  activeCategory.value = first?.id ?? categories.value[0].id;
  contentRef.value?.scrollToTop();
});

function changeScope(next: SettingsScope): void {
  if (scope.value === next) return;
  scope.value = next;
  query.value = '';
  modifiedOnly.value = false;
  activeCategory.value = categories.value[0].id;
  void nextTick(() => contentRef.value?.scrollToTop());
}

function updateQuery(value: string): void {
  query.value = value;
}

function clearSearch(): void {
  query.value = '';
}

function toggleFilter(): void {
  modifiedOnly.value = !modifiedOnly.value;
}

function clearFilters(): void {
  query.value = '';
  modifiedOnly.value = false;
}

function toggleCategory(category: SettingsCategoryId): void {
  const expanded = expandedCategories.value;
  expandedCategories.value = expanded.includes(category)
    ? expanded.filter((id) => id !== category)
    : [...expanded, category];
}

function selectCategory(category: SettingsCategoryId): void {
  if (scope.value === 'workspace' && !workspaceAvailable.value) return;
  activeCategory.value = category;
  void contentRef.value?.scrollToCategory(category);
}

function selectSetting(setting: SettingDefinition): void {
  activeCategory.value = setting.category;
  void contentRef.value?.scrollToSetting(setting);
}

function updateSetting(
  setting: SettingDefinition,
  value: SettingsValue,
): void {
  if (setting.preference) {
    const patch = {
      [setting.preference]: value,
    } as Partial<Preferences>;
    if (scope.value === 'workspace') {
      emit('updateWorkspace', patch);
    } else {
      emit('update', patch);
    }
    return;
  }
  if (scope.value === 'workspace') return;
  localValues.value = { ...localValues.value, [setting.id]: value };
}

function resetSetting(setting: SettingDefinition): void {
  if (scope.value === 'workspace') {
    if (setting.preference) {
      emit('resetWorkspace', setting.preference);
    }
    return;
  }
  updateSetting(setting, setting.defaultValue);
}

function onActiveChange(category: SettingsCategoryId): void {
  activeCategory.value = category;
}
</script>

<template>
  <div class="settings-workbench">
    <SettingsHeader
      :query="query"
      :filter-active="modifiedOnly"
      :search-disabled="scope === 'workspace' && !workspaceAvailable"
      :maximized="maximized"
      @update:query="updateQuery"
      @clear-search="clearSearch"
      @toggle-filter="toggleFilter"
      @minimize="emit('minimize')"
      @maximize="emit('maximize')"
      @close="emit('close')"
    />

    <div class="settings-body">
      <SettingsSidebar
        :scope="scope"
        :categories="categories"
        :sections="allSections"
        :active-category="activeCategory"
        :expanded-categories="expandedCategories"
        :match-counts="matchCounts"
        :matched-ids="matchedIds"
        :filtering="filtering"
        :workspace-available="workspaceAvailable"
        @change-scope="changeScope"
        @select-category="selectCategory"
        @toggle-category="toggleCategory"
        @select-setting="selectSetting"
      />

      <SettingsContent
        ref="contentRef"
        :scope="scope"
        :active-category="activeCategory"
        :sections="sections"
        :query="query"
        :filtering="filtering"
        :modified-only="modifiedOnly"
        :modified-count="modifiedCount"
        :total-count="totalCount"
        :workspace-available="workspaceAvailable"
        @update-setting="updateSetting"
        @reset-setting="resetSetting"
        @active-change="onActiveChange"
        @open-user="changeScope('user')"
        @clear-filters="clearFilters"
      />
    </div>
  </div>
</template>

<style scoped>
.settings-workbench {
  display: grid;
  grid-template-rows: 44px minmax(0, 1fr);
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--panel);
  color: var(--ink);
  font-family:
    'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui,
    -apple-system, sans-serif;
}

.settings-body {
  display: grid;
  grid-template-columns: 218px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 620px) {
  .settings-body {
    grid-template-columns: 178px minmax(0, 1fr);
  }
}
</style>
