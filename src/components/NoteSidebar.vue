<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { dirname } from '../lib/paths';
import type { FileEntry } from '../types';

const props = defineProps<{
  entries: FileEntry[];
  selectedPath: string | null;
  notesDir: string | null;
  expandedPaths: string[];
  busy: boolean;
}>();

const emit = defineEmits<{
  select: [path: string];
  toggleFolder: [path: string];
  chooseFolder: [];
  createFile: [parent: string];
  createFolder: [parent: string];
  rename: [entry: FileEntry];
  remove: [entry: FileEntry];
}>();

interface TreeNode {
  path: string;
  name: string;
  isDir: boolean;
  children: TreeNode[];
}

interface TreeRow {
  node: TreeNode;
  depth: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  target: FileEntry | null;
}

const folderName = computed(() => {
  if (!props.notesDir) return '';
  const parts = props.notesDir.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? props.notesDir;
});

const expanded = computed(() => new Set(props.expandedPaths));
const tree = computed<TreeNode[]>(() => {
  const nodes = new Map<string, TreeNode>();
  for (const entry of props.entries) {
    nodes.set(entry.path, {
      path: entry.path,
      name: entry.name,
      isDir: entry.isDir,
      children: [],
    });
  }

  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(dirname(node.path));
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  sortNodes(roots);
  return roots;
});

const rows = computed<TreeRow[]>(() => {
  const result: TreeRow[] = [];
  const walk = (nodes: TreeNode[], depth: number): void => {
    for (const node of nodes) {
      result.push({ node, depth });
      if (node.isDir && expanded.value.has(node.path)) {
        walk(node.children, depth + 1);
      }
    }
  };
  walk(tree.value, 0);
  return result;
});

const menu = ref<ContextMenuState | null>(null);
const menuElement = ref<HTMLElement | null>(null);
let detachMenu: (() => void) | null = null;

watch(
  () => props.busy,
  (busy) => {
    if (busy) closeMenu();
  },
);

onBeforeUnmount(closeMenu);

function sortNodes(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-CN', {
      sensitivity: 'base',
      numeric: true,
    });
  });
  for (const node of nodes) {
    sortNodes(node.children);
  }
}

function activate(node: TreeNode): void {
  if (node.isDir) {
    emit('toggleFolder', node.path);
  } else {
    emit('select', node.path);
  }
}

function toggleFolder(node: TreeNode): void {
  if (node.isDir) {
    emit('toggleFolder', node.path);
  }
}

function onRowContextMenu(event: MouseEvent, node: TreeNode): void {
  openMenu(event, {
    path: node.path,
    name: node.name,
    isDir: node.isDir,
  });
}

function onRootContextMenu(event: MouseEvent): void {
  openMenu(event, null);
}

function openMenu(event: MouseEvent, target: FileEntry | null): void {
  if (props.busy || !props.notesDir) return;
  event.preventDefault();
  menu.value = { x: event.clientX, y: event.clientY, target };
  void nextTick(() => {
    clampMenuPosition();
    attachDismissListeners();
    menuElement.value?.focus();
  });
}

function clampMenuPosition(): void {
  const element = menuElement.value;
  const state = menu.value;
  if (!element || !state) return;

  const margin = 8;
  const rect = element.getBoundingClientRect();
  state.x = Math.min(
    Math.max(margin, state.x),
    Math.max(margin, window.innerWidth - rect.width - margin),
  );
  state.y = Math.min(
    Math.max(margin, state.y),
    Math.max(margin, window.innerHeight - rect.height - margin),
  );
}

function attachDismissListeners(): void {
  detachMenu?.();

  const onPointerDown = (event: PointerEvent): void => {
    if (event.target instanceof Node && menuElement.value?.contains(event.target)) {
      return;
    }
    closeMenu();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    }
  };
  const onDismiss = (): void => closeMenu();

  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('scroll', onDismiss, true);
  window.addEventListener('resize', onDismiss);
  window.addEventListener('blur', onDismiss);

  detachMenu = () => {
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onDismiss, true);
    window.removeEventListener('resize', onDismiss);
    window.removeEventListener('blur', onDismiss);
  };
}

function closeMenu(): void {
  menu.value = null;
  detachMenu?.();
  detachMenu = null;
}

function runAction(action: 'create-file' | 'create-folder' | 'rename' | 'delete'): void {
  const target = menu.value?.target ?? null;
  const parent = target ? (target.isDir ? target.path : dirname(target.path)) : '';
  closeMenu();

  if (action === 'create-file') {
    emit('createFile', parent);
  } else if (action === 'create-folder') {
    emit('createFolder', parent);
  } else if (action === 'rename' && target) {
    emit('rename', target);
  } else if (action === 'delete' && target) {
    emit('remove', target);
  }
}
</script>

<template>
  <aside class="sidebar">
    <div class="tree" role="tree" @contextmenu.prevent="onRootContextMenu">
      <div
        v-for="row in rows"
        :key="row.node.path"
        class="tree-row"
        :class="{ selected: row.node.path === selectedPath, folder: row.node.isDir }"
        :style="{ paddingLeft: `${10 + row.depth * 14}px` }"
        role="treeitem"
        :aria-expanded="row.node.isDir ? expanded.has(row.node.path) : undefined"
        tabindex="0"
        :title="row.node.path"
        @click="activate(row.node)"
        @keydown.enter.prevent="activate(row.node)"
        @keydown.space.prevent="activate(row.node)"
        @contextmenu.stop.prevent="onRowContextMenu($event, row.node)"
      >
        <span
          class="chevron"
          :class="{ open: expanded.has(row.node.path) }"
          @click.stop="toggleFolder(row.node)"
        >
          <svg v-if="row.node.isDir" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span class="entry-icon">
          <svg v-if="row.node.isDir" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l1.5 2h9.5A1.5 1.5 0 0 1 21 9.5v7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
            <path d="M14 3.5V8h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
            <path d="M10 13h4M10 16h4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </span>
        <span class="entry-name">{{ row.node.name }}</span>
      </div>

      <p v-if="rows.length === 0" class="empty">
        {{ notesDir ? '右键此处新建文件或文件夹。' : '先选择一个文件夹来保存笔记。' }}
      </p>
    </div>

    <footer class="sidebar-footer">
      <button
        class="folder-button"
        type="button"
        :title="notesDir ?? '选择笔记文件夹'"
        @click="emit('chooseFolder')"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l1.5 2h9.5A1.5 1.5 0 0 1 21 9.5v7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </svg>
        <span class="folder-name">{{ notesDir ? folderName : '选择笔记文件夹' }}</span>
      </button>
    </footer>

    <Teleport to="body">
      <div
        v-if="menu"
        ref="menuElement"
        class="context-menu"
        role="menu"
        tabindex="-1"
        :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
        @contextmenu.prevent
      >
        <template v-if="!menu.target || menu.target.isDir">
          <button class="menu-item" type="button" role="menuitem" @click="runAction('create-file')">
            新建文件
          </button>
          <button class="menu-item" type="button" role="menuitem" @click="runAction('create-folder')">
            新建文件夹
          </button>
        </template>
        <div v-if="menu.target" class="menu-separator"></div>
        <template v-if="menu.target">
          <button class="menu-item" type="button" role="menuitem" @click="runAction('rename')">
            重命名
          </button>
          <button class="menu-item danger" type="button" role="menuitem" @click="runAction('delete')">
            删除（移到回收站）
          </button>
        </template>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
  padding: 10px 14px 14px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.tree {
  flex: 1;
  min-height: 0;
  margin: 0 -4px;
  padding: 2px 4px 8px;
  overflow: auto;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding-right: 8px;
  border-radius: 7px;
  color: var(--ink);
  font-size: 13.5px;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}

.tree-row:hover {
  background: var(--hover);
}

.tree-row.selected {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.tree-row.selected .entry-name {
  font-weight: 600;
}

.tree-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.chevron {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 14px;
  height: 14px;
  color: var(--faint);
  transition: transform 0.15s ease;
}

.chevron svg {
  width: 12px;
  height: 12px;
}

.chevron.open {
  transform: rotate(90deg);
}

.entry-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 16px;
  height: 16px;
  color: var(--faint);
}

.entry-icon svg {
  width: 15px;
  height: 15px;
}

.tree-row.folder .entry-icon {
  color: var(--folder-icon);
}

.tree-row.selected .entry-icon {
  color: inherit;
}

.entry-name {
  overflow: hidden;
  font-family: var(--mono-font);
  font-size: 12.5px;
  text-overflow: ellipsis;
}

.empty {
  margin: 0;
  padding: 10px 6px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 4px 0;
  border-top: 1px solid var(--border);
}
.folder-button {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 6px 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  text-align: left;
}

.folder-button:hover {
  background: var(--hover);
  color: var(--ink);
}

.folder-button svg {
  flex-shrink: 0;
}

.folder-name {
  overflow: hidden;
  font-family: var(--mono-font);
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.context-menu {
  position: fixed;
  z-index: 80;
  min-width: 190px;
  max-height: min(360px, calc(100vh - 16px));
  padding: 6px;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--menu-shadow);
  outline: none;
}

.menu-item {
  display: flex;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink);
  font-size: 12.5px;
  text-align: left;
}

.menu-item:hover,
.menu-item:focus-visible {
  background: var(--accent-soft);
  outline: none;
}

.menu-item.danger {
  color: var(--error);
}

.menu-item.danger:hover,
.menu-item.danger:focus-visible {
  background: var(--error-soft);
}

.menu-separator {
  height: 1px;
  margin: 5px 4px;
  background: var(--border);
}
</style>
