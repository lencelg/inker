<script setup lang="ts">
import { computed } from 'vue';
import type { NoteMeta } from '../types';

const props = defineProps<{
  notes: NoteMeta[];
  selectedFilename: string | null;
  notesDir: string | null;
}>();

const emit = defineEmits<{
  create: [];
  select: [filename: string];
  remove: [filename: string];
  import: [];
  chooseFolder: [];
}>();

const folderName = computed(() => {
  if (!props.notesDir) return '';
  const parts = props.notesDir.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? props.notesDir;
});

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' });

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="logo">M↓</span>
      <div>
        <h1>Markdown 笔记</h1>
        <p>本地 · 文件夹 · 预览</p>
      </div>
    </div>

    <div class="sidebar-actions">
      <button class="btn primary" type="button" @click="emit('create')">+ 新建笔记</button>
      <button class="btn ghost" type="button" @click="emit('import')">导入 .md</button>
    </div>

    <div class="list-heading">
      <span>笔记库</span>
      <span>{{ notes.length }}</span>
    </div>

    <ul class="note-list">
      <li v-for="note in notes" :key="note.filename">
        <button
          class="note-item"
          :class="{ active: note.filename === selectedFilename }"
          type="button"
          @click="emit('select', note.filename)"
        >
          <span class="note-title">{{ note.title }}</span>
          <span class="note-meta">{{ formatDate(note.updatedAt) }} · {{ formatSize(note.sizeBytes) }}</span>
        </button>
        <button
          class="delete"
          type="button"
          title="移到回收站"
          aria-label="移到回收站"
          @click.stop="emit('remove', note.filename)"
        >
          ×
        </button>
      </li>
    </ul>

    <p v-if="notes.length === 0" class="empty">
      {{ notesDir ? '这个文件夹里还没有 Markdown 笔记。' : '先选择一个文件夹来保存笔记。' }}
    </p>

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
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  padding: 22px 18px;
  background: rgba(255, 255, 255, 0.72);
  border-right: 1px solid var(--border);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
}

.logo {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--ink);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -1px;
}

.brand h1 {
  margin: 0;
  font-size: 15px;
}

.brand p {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--muted);
}

.sidebar-actions {
  display: grid;
  gap: 8px;
}

.list-heading {
  display: flex;
  justify-content: space-between;
  padding: 4px 2px 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.note-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

.note-list li {
  position: relative;
}

.note-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 10px 34px 10px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  text-align: left;
}

.note-item:hover {
  background: rgba(31, 41, 51, 0.05);
}

.note-item.active {
  background: var(--accent-soft);
  border-color: #c7d8ff;
}

.note-title {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.note-meta {
  font-size: 11px;
  color: var(--muted);
}

.delete {
  position: absolute;
  top: 50%;
  right: 8px;
  width: 24px;
  height: 24px;
  padding: 0;
  transform: translateY(-50%);
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  opacity: 0.35;
  transition: opacity 0.15s ease;
}

.note-list li:hover .delete,
.delete:focus-visible {
  opacity: 1;
}

.delete:hover {
  background: var(--error-soft);
  color: var(--error);
}

.empty {
  margin: 0;
  padding: 8px 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
}

.sidebar-footer {
  padding-top: 8px;
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
  background: rgba(31, 41, 51, 0.05);
  color: var(--ink);
}

.folder-button svg {
  flex-shrink: 0;
}

.folder-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

@media (max-width: 900px) {
  .sidebar {
    height: auto;
    max-height: 42vh;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .note-list {
    flex: none;
    max-height: 220px;
  }
}
</style>
