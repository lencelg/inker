<script setup lang="ts">
import { t } from '../lib/i18n';

defineProps<{
  activeView: 'explorer' | 'search';
  sidebarVisible: boolean;
}>();

const emit = defineEmits<{
  selectExplorer: [];
  selectSearch: [];
  openSettings: [];
}>();
</script>

<template>
  <nav class="activity-rail" :aria-label="t('nav.main')">
    <button
      class="activity-item"
      :class="{ active: sidebarVisible && activeView === 'explorer' }"
      type="button"
      :title="t('nav.files')"
      :aria-label="t('nav.files')"
      :aria-pressed="sidebarVisible && activeView === 'explorer'"
      @click="emit('selectExplorer')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M8 3.5h6.5L18 7v10.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <path
          d="M14.5 3.5V7H18M6 7.5H4.5a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h9"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <button
      class="activity-item"
      :class="{ active: sidebarVisible && activeView === 'search' }"
      type="button"
      :title="t('nav.search')"
      :aria-label="t('nav.search')"
      :aria-pressed="sidebarVisible && activeView === 'search'"
      @click="emit('selectSearch')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="10.5"
          cy="10.5"
          r="6"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
        />
        <path
          d="m15 15 4.5 4.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <div class="spacer"></div>

    <button
      class="activity-item"
      type="button"
      :title="t('nav.settings')"
      :aria-label="t('nav.settings')"
      @click="emit('openSettings')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.7-1.3-2-3.4-2 .8a7.2 7.2 0 0 0-2.6-1.5L14.2 3h-4.4l-.3 2.1a7.2 7.2 0 0 0-2.6 1.5l-2-.8-2 3.4 1.7 1.3a7.7 7.7 0 0 0 0 3l-1.7 1.3 2 3.4 2-.8a7.2 7.2 0 0 0 2.6 1.5l.3 2.1h4.4l.3-2.1a7.2 7.2 0 0 0 2.6-1.5l2 .8 2-3.4-1.7-1.3Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </nav>
</template>

<style scoped>
.activity-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 48px;
  height: 100%;
  padding: 8px 0;
  overflow: hidden;
  background: var(--activity-bg);
  border-right: 1px solid var(--border);
}

.activity-item {
  position: relative;
  display: grid;
  flex-shrink: 0;
  width: 44px;
  height: 46px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--activity-icon);
  cursor: pointer;
}

.activity-item svg {
  width: 22px;
  height: 22px;
}

.activity-item:hover {
  background: var(--activity-hover);
  color: var(--activity-icon-hover);
}

.activity-item.active {
  background: var(--activity-active-bg);
  color: var(--activity-icon-active);
}

.activity-item.active::before {
  position: absolute;
  top: 7px;
  bottom: 7px;
  left: 0;
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
  content: '';
}

.activity-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.spacer {
  flex: 1;
}

@media (max-width: 1080px) {
  .activity-rail {
    width: 44px;
  }

  .activity-item {
    width: 40px;
  }
}
</style>
