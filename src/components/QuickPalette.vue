<script setup lang="ts">
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Search,
} from '@lucide/vue';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { Component } from 'vue';
import {
  filterPaletteItems,
  type PaletteItem,
  type PaletteItemKind,
} from '../lib/palette';
import { t } from '../lib/i18n';

const props = defineProps<{
  items: readonly PaletteItem[];
  placeholder: string;
  emptyLabel: string;
}>();

const emit = defineEmits<{
  select: [item: PaletteItem];
  close: [];
}>();

const query = ref('');
const active = ref(0);
const input = ref<HTMLInputElement | null>(null);
const list = ref<HTMLElement | null>(null);

const filtered = computed(() =>
  filterPaletteItems(props.items, query.value),
);

function iconFor(kind: PaletteItemKind | undefined): Component | null {
  if (kind === 'note') return FileText;
  if (kind === 'image') return ImageIcon;
  if (kind === 'back') return ArrowLeft;
  return null;
}

function itemClass(item: PaletteItem): string[] {
  return [
    `kind-${item.kind ?? 'command'}`,
    ...(item.disabled ? ['disabled'] : []),
  ];
}

async function scrollActiveIntoView(): Promise<void> {
  await nextTick();
  const element = list.value?.querySelector<HTMLElement>(
    `[data-index="${active.value}"]`,
  );
  element?.scrollIntoView?.({ block: 'nearest' });
}

function jumpTo(index: number): void {
  active.value = Math.max(
    0,
    Math.min(index, filtered.value.length - 1),
  );
  void scrollActiveIntoView();
}

function move(delta: number): void {
  const count = filtered.value.length;
  if (count === 0) return;
  active.value = (active.value + delta + count) % count;
  void scrollActiveIntoView();
}

function choose(item = filtered.value[active.value]): void {
  if (!item || item.disabled) return;
  emit('select', item);
}

watch(query, () => {
  active.value = 0;
  void scrollActiveIntoView();
});

watch(filtered, () => {
  if (active.value >= filtered.value.length) {
    active.value = Math.max(0, filtered.value.length - 1);
  }
});

onMounted(async () => {
  await nextTick();
  input.value?.focus();
});
</script>

<template>
  <div class="palette-overlay" @pointerdown.self="emit('close')">
    <div
      class="quick-palette"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Open"
    >
      <div class="palette-input">
        <Search :size="15" class="search-icon" aria-hidden="true" />
        <input
          ref="input"
          v-model="query"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="quick-palette-list"
          :aria-activedescendant="`quick-palette-item-${active}`"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :placeholder="placeholder"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.page-down.prevent="move(8)"
          @keydown.page-up.prevent="move(-8)"
          @keydown.home.prevent="jumpTo(0)"
          @keydown.end.prevent="jumpTo(filtered.length - 1)"
          @keydown.enter.prevent="choose()"
          @keydown.tab.prevent
          @keydown.esc.stop.prevent="emit('close')"
        />
      </div>

      <div
        v-if="filtered.length"
        id="quick-palette-list"
        ref="list"
        class="palette-list"
        role="listbox"
        :aria-label="placeholder"
      >
        <button
          v-for="(item, index) in filtered"
          :id="`quick-palette-item-${index}`"
          :key="item.id"
          type="button"
          role="option"
          tabindex="-1"
          :aria-selected="index === active"
          :data-index="index"
          :class="['palette-item', ...itemClass(item), { active: index === active }]"
          :disabled="item.disabled"
          @mouseenter="active = index"
          @mousedown.prevent
          @click="choose(item)"
        >
          <span class="item-icon" aria-hidden="true">
            <component
              :is="iconFor(item.kind)"
              v-if="iconFor(item.kind)"
              :size="14"
            />
          </span>
          <span class="item-label">{{ item.label }}</span>
          <span v-if="item.detail" class="item-detail">{{ item.detail }}</span>
        </button>
      </div>
      <div v-else class="palette-empty">{{ emptyLabel }}</div>

      <div class="palette-footer">
        <span class="hint"><kbd>↑</kbd><kbd>↓</kbd>{{ t('palette.navigate') }}</span>
        <span class="hint"><kbd>↵</kbd>{{ t('palette.select') }}</span>
        <span class="hint"><kbd>esc</kbd>{{ t('palette.close') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.palette-overlay {
  position: fixed;
  inset: 0;
  z-index: 240;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 10vh 16px 16px;
  background: var(--overlay);
}

.quick-palette {
  width: min(620px, 100%);
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-strong);
  color: var(--ink);
}

.palette-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
}

.search-icon {
  flex: none;
  color: var(--muted);
}

.palette-input input {
  flex: 1;
  min-width: 0;
  padding: 10px 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  font-size: 13px;
}

.palette-input input::placeholder {
  color: var(--faint);
}

.palette-list {
  max-height: min(50vh, 420px);
  overflow-y: auto;
  padding: 4px 0;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 12px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}

.palette-item.active {
  background: var(--accent-soft);
}

.palette-item.disabled {
  opacity: 0.45;
  cursor: default;
}

.item-icon {
  display: inline-flex;
  flex: none;
  justify-content: center;
  width: 14px;
  color: var(--muted);
}

.palette-item.active .item-icon {
  color: var(--accent);
}

.item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-detail {
  flex: none;
  max-width: 50%;
  overflow: hidden;
  color: var(--faint);
  font-family: var(--mono-font);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette-item.active .item-detail {
  color: var(--muted);
}

.kind-back .item-icon {
  color: var(--accent);
}

.palette-empty {
  padding: 18px 14px;
  color: var(--muted);
  font-size: 12px;
}

.palette-footer {
  display: flex;
  gap: 14px;
  padding: 6px 12px;
  border-top: 1px solid var(--border);
  color: var(--faint);
  font-size: 10.5px;
}

.hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

kbd {
  padding: 0 4px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-soft);
  color: var(--muted);
  font-family: var(--mono-font);
  font-size: 9.5px;
  line-height: 15px;
}
</style>
