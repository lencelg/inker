<script setup lang="ts">
import { t } from '../lib/i18n';
import type { BreadcrumbItem } from '../lib/headings';

defineProps<{ items: BreadcrumbItem[] }>();
</script>

<template>
  <nav
    v-if="items.length"
    class="breadcrumbs"
    :aria-label="t('editor.breadcrumbs')"
  >
    <ol class="breadcrumb-list">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="breadcrumb"
      >
        <span
          v-if="index > 0"
          class="breadcrumb-separator"
          aria-hidden="true"
          >›</span
        >
        <span
          class="breadcrumb-label"
          :title="item.text"
          :aria-current="
            index === items.length - 1 ? 'location' : undefined
          "
          >{{ item.text }}</span
        >
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.breadcrumbs {
  display: flex;
  flex: none;
  align-items: center;
  height: 30px;
  padding: 0 16px;
  overflow: hidden;
  background: var(--bg-soft);
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  line-height: 1;
  user-select: none;
}

.breadcrumb-list {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 1px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
}

.breadcrumb {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 1px;
}

.breadcrumb-label {
  min-width: 0;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb:last-child {
  flex: none;
}

.breadcrumb:last-child .breadcrumb-label {
  color: var(--ink);
  font-weight: 600;
}

.breadcrumb-separator {
  flex: none;
  padding: 0 4px;
  color: var(--faint);
  font-size: 15px;
}
</style>
