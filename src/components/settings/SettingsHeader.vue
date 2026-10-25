<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import {
  Copy,
  Filter,
  Minus,
  Search,
  Settings,
  Square,
  X,
} from '@lucide/vue';
import { t } from '../../lib/i18n';

const props = defineProps<{
  query: string;
  filterActive: boolean;
  searchDisabled: boolean;
  maximized: boolean;
}>();

const emit = defineEmits<{
  'update:query': [value: string];
  toggleFilter: [];
  clearSearch: [];
  close: [];
  minimize: [];
  maximize: [];
}>();

const searchInput = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  await nextTick();
  if (!props.searchDisabled) searchInput.value?.focus();
});

watch(
  () => props.searchDisabled,
  (disabled) => {
    if (disabled) searchInput.value?.blur();
  },
);

function onSearchInput(event: Event): void {
  emit('update:query', (event.target as HTMLInputElement).value);
}

function clearSearch(): void {
  emit('clearSearch');
  searchInput.value?.focus();
}
</script>

<template>
  <header class="settings-header">
    <div class="settings-heading">
      <Settings :size="18" aria-hidden="true" />
      <span>{{ t('settings.title') }}</span>
    </div>

    <div class="settings-search" :class="{ disabled: searchDisabled }">
      <Search class="search-icon" :size="15" aria-hidden="true" />
      <input
        ref="searchInput"
        type="search"
        class="search-input"
        :value="query"
        :disabled="searchDisabled"
        :placeholder="t('settings.searchPlaceholder')"
        :aria-label="t('settings.search')"
        spellcheck="false"
        @input="onSearchInput"
      />
      <button
        type="button"
        class="search-action"
        :title="t('settings.clearSearch')"
        :aria-label="t('settings.clearSearch')"
        :disabled="!query || searchDisabled"
        @click="clearSearch"
      >
        <X :size="14" aria-hidden="true" />
      </button>
      <span class="search-divider" aria-hidden="true"></span>
      <button
        type="button"
        class="search-action"
        :class="{ active: filterActive }"
        :title="t('settings.filterModified')"
        :aria-label="t('settings.filterModified')"
        :aria-pressed="filterActive"
        :disabled="searchDisabled"
        @click="emit('toggleFilter')"
      >
        <Filter :size="14" aria-hidden="true" />
      </button>
    </div>

    <div class="window-controls">
      <button
        type="button"
        class="window-control"
        :title="t('settings.minimize')"
        :aria-label="t('settings.minimizeWindow')"
        @click="emit('minimize')"
      >
        <Minus :size="15" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="window-control"
        :title="maximized ? t('settings.restore') : t('settings.maximize')"
        :aria-label="
          maximized
            ? t('settings.restoreWindow')
            : t('settings.maximizeWindow')
        "
        @click="emit('maximize')"
      >
        <Copy v-if="maximized" :size="13" aria-hidden="true" />
        <Square v-else :size="13" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="window-control close"
        :title="t('settings.close')"
        :aria-label="t('settings.close')"
        @click="emit('close')"
      >
        <X :size="16" aria-hidden="true" />
      </button>
    </div>

  </header>
</template>

<style scoped>
.settings-header {
  position: relative;
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(260px, 520px) minmax(160px, 1fr);
  height: 44px;
  align-items: center;
  padding-left: 14px;
  background: var(--bg-soft);
  border-bottom: 1px solid var(--border);
  user-select: none;
}

.settings-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: var(--ink);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.settings-heading svg {
  flex-shrink: 0;
  color: var(--muted);
}

.settings-search {
  display: flex;
  height: 28px;
  min-width: 0;
  align-items: center;
  padding: 0 3px 0 8px;
  background: var(--hover-strong);
  border: 1px solid transparent;
  border-radius: 4px;
  transition:
    border-color 0.12s ease,
    background 0.12s ease;
}

.settings-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.settings-search.disabled {
  opacity: 0.55;
}

.search-icon {
  flex-shrink: 0;
  color: var(--muted);
}

.search-input {
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0 6px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font-size: 12.5px;
}

.search-input::placeholder {
  color: var(--faint);
}

.search-input::-webkit-search-cancel-button {
  display: none;
}

.search-action {
  display: grid;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--muted);
}

.search-action:hover:not(:disabled) {
  background: var(--hover-strong);
  color: var(--ink);
}

.search-action.active {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.search-action:disabled {
  opacity: 0.35;
}

.search-divider {
  width: 1px;
  height: 13px;
  margin: 0 2px;
  background: var(--border);
}

.window-controls {
  display: flex;
  justify-self: end;
  height: 100%;
}

.window-control {
  display: grid;
  width: 46px;
  height: 100%;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--muted);
}

.window-control:hover {
  background: var(--hover);
  color: var(--ink);
}

.window-control.close:hover {
  background: var(--danger-bg);
  color: var(--danger-ink);
}

@media (max-width: 760px) {
  .settings-header {
    grid-template-columns: auto minmax(160px, 1fr) auto;
    gap: 8px;
    padding-left: 10px;
  }

  .settings-heading span {
    display: none;
  }

  .window-control {
    width: 36px;
  }
}
</style>
