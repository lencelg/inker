<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { api } from './api';
import ConfirmDialog from './components/ConfirmDialog.vue';
import NoteSidebar from './components/NoteSidebar.vue';
import PreviewPane from './components/PreviewPane.vue';
import SyntaxIssues from './components/SyntaxIssues.vue';
import { lintMarkdown } from './lib/lint';
import { renderMarkdown } from './lib/markdown';
import type { NoteMeta, NotesState, SyntaxIssue } from './types';

const notes = ref<NoteMeta[]>([]);
const notesDir = ref<string | null>(null);
const selectedFilename = ref<string | null>(null);
const title = ref('');
const content = ref('');
const issues = ref<SyntaxIssue[]>([]);
const checked = ref(false);
const dirty = ref(false);
const error = ref('');
const notice = ref('');
const saving = ref(false);
const editorRef = ref<HTMLTextAreaElement | null>(null);

const previewHtml = computed(() => renderMarkdown(content.value));

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}

interface PendingConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (confirmed: boolean) => void;
}

const confirmation = ref<PendingConfirmation | null>(null);

onMounted(() => {
  void bootstrap();
});

async function bootstrap(): Promise<void> {
  try {
    const state = await api.getState();
    applyState(state);
    const first = state.notes[0];
    if (first) {
      await loadNote(first.filename);
    }
  } catch (err) {
    setError(err);
  }
}

function applyState(state: NotesState): void {
  notesDir.value = state.notesDir;
  notes.value = state.notes;
}

async function loadNote(filename: string): Promise<void> {
  const detail = await api.readNote(filename);
  selectedFilename.value = filename;
  title.value = detail.note.title;
  content.value = detail.content;
  issues.value = [];
  checked.value = false;
  dirty.value = false;
  notice.value = '';
  await scrollEditorToTop();
}

async function chooseFolder(): Promise<void> {
  if (!(await confirmDiscard())) return;
  clearFeedback();
  try {
    const state = await api.chooseNotesDir();
    if (!state) return;
    applyState(state);
    const first = state.notes[0];
    if (first) {
      await loadNote(first.filename);
    } else {
      resetEditor();
    }
  } catch (err) {
    setError(err);
  }
}

async function selectNote(filename: string): Promise<void> {
  if (filename === selectedFilename.value) return;
  if (!(await confirmDiscard())) return;
  clearFeedback();
  try {
    await loadNote(filename);
  } catch (err) {
    setError(err);
  }
}

async function startNewNote(): Promise<void> {
  if (!notesDir.value) {
    await chooseFolder();
    return;
  }
  if (!(await confirmDiscard())) return;
  resetEditor();
  clearFeedback();
}

function markDirty(): void {
  dirty.value = true;
  notice.value = '';
  checked.value = false;
  issues.value = [];
}

async function importNote(): Promise<void> {
  if (!notesDir.value) {
    await chooseFolder();
    return;
  }
  if (!(await confirmDiscard())) return;
  clearFeedback();
  try {
    const note = await api.importNote();
    if (!note) return;
    await refreshNotes();
    await loadNote(note.filename);
    notice.value = '已导入。';
  } catch (err) {
    setError(err);
  }
}

function runSyntaxCheck(): void {
  clearFeedback();
  issues.value = lintMarkdown(content.value);
  checked.value = true;
}

async function saveNote(): Promise<void> {
  if (saving.value) return;
  if (!notesDir.value) {
    error.value = '请先选择笔记文件夹';
    return;
  }
  if (!content.value.trim()) {
    error.value = '笔记内容不能为空';
    return;
  }

  saving.value = true;
  clearFeedback();
  try {
    const note = selectedFilename.value
      ? await api.updateNote({
          filename: selectedFilename.value,
          title: title.value,
          content: content.value,
        })
      : await api.createNote({ title: title.value, content: content.value });

    selectedFilename.value = note.filename;
    title.value = note.title;
    dirty.value = false;
    notice.value = '已保存。';
    await refreshNotes();
  } catch (err) {
    setError(err);
  } finally {
    saving.value = false;
  }
}

async function refreshNotes(): Promise<void> {
  const state = await api.refresh();
  applyState(state);
}

async function removeNote(filename: string): Promise<void> {
  const confirmed = await askConfirmation({
    title: '删除这条笔记？',
    message: '笔记文件会移到系统回收站。',
    confirmLabel: '移到回收站',
  });
  if (!confirmed) return;
  clearFeedback();
  try {
    const wasSelected = selectedFilename.value === filename;
    await api.deleteNote(filename);
    await refreshNotes();
    if (wasSelected) {
      const next = notes.value[0];
      if (next) {
        await loadNote(next.filename);
      } else {
        resetEditor();
      }
    }
    notice.value = '笔记已移到回收站。';
  } catch (err) {
    setError(err);
  }
}

function resetEditor(): void {
  selectedFilename.value = null;
  title.value = '';
  content.value = '';
  issues.value = [];
  checked.value = false;
  dirty.value = false;
}

async function scrollEditorToTop(): Promise<void> {
  await nextTick();
  if (editorRef.value) {
    editorRef.value.scrollTop = 0;
  }
}

function confirmDiscard(): Promise<boolean> {
  if (!dirty.value) return Promise.resolve(true);
  return askConfirmation({
    title: '放弃未保存的修改？',
    message: '当前笔记有尚未保存的修改，继续操作会丢失这些修改。',
    confirmLabel: '放弃修改',
  });
}

function askConfirmation(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    confirmation.value = { danger: true, ...options, resolve };
  });
}

function resolveConfirmation(confirmed: boolean): void {
  confirmation.value?.resolve(confirmed);
  confirmation.value = null;
}

function handleSaveShortcut(): void {
  if (!confirmation.value) {
    void saveNote();
  }
}

function clearFeedback(): void {
  error.value = '';
  notice.value = '';
}

function setError(err: unknown): void {
  error.value = err instanceof Error ? err.message : String(err);
}
</script>

<template>
  <div
    class="app-shell"
    @keydown.ctrl.s.prevent="handleSaveShortcut"
    @keydown.meta.s.prevent="handleSaveShortcut"
  >
    <NoteSidebar
      :notes="notes"
      :selected-filename="selectedFilename"
      :notes-dir="notesDir"
      @create="startNewNote"
      @select="selectNote"
      @remove="removeNote"
      @import="importNote"
      @choose-folder="chooseFolder"
    />

    <main v-if="notesDir === null" class="workspace welcome">
      <div class="welcome-card">
        <span class="welcome-icon">M↓</span>
        <h1>Markdown 笔记</h1>
        <p>选择一个文件夹，笔记会以 .md 文件保存在其中。</p>
        <button class="btn primary" type="button" @click="chooseFolder">
          选择笔记文件夹
        </button>
        <p v-if="error" class="welcome-error">{{ error }}</p>
      </div>
    </main>

    <main v-else class="workspace">
      <header class="workspace-header">
        <div class="title-group">
          <input
            v-model="title"
            class="title-input"
            type="text"
            maxlength="120"
            placeholder="笔记标题（留空则自动生成）"
            aria-label="笔记标题"
            @input="markDirty"
          />
          <div class="status-line">
            <span v-if="dirty" class="pill dirty">未保存</span>
            <span v-else-if="selectedFilename" class="pill saved">已保存</span>
            <span v-else class="pill draft">新笔记</span>
            <span v-if="notice" class="notice-text">{{ notice }}</span>
          </div>
        </div>
        <div class="toolbar">
          <button class="btn ghost" type="button" @click="runSyntaxCheck">检查语法</button>
          <button class="btn primary" type="button" :disabled="saving" @click="saveNote">
            {{ saving ? '保存中…' : '保存笔记' }}
          </button>
        </div>
      </header>

      <div v-if="error" class="banner" role="alert">
        <span>{{ error }}</span>
        <button type="button" aria-label="关闭错误提示" @click="error = ''">×</button>
      </div>

      <div class="panes">
        <section class="editor-pane">
          <header class="pane-header">
            <span class="pane-title">Markdown</span>
          </header>
          <textarea
            ref="editorRef"
            v-model="content"
            class="editor"
            spellcheck="false"
            aria-label="Markdown 内容"
            placeholder="# 从这里开始写…"
            @input="markDirty"
          ></textarea>
          <SyntaxIssues v-if="checked" :issues="issues" />
        </section>

        <PreviewPane :html="previewHtml" />
      </div>
    </main>

    <ConfirmDialog
      v-if="confirmation"
      :title="confirmation.title"
      :message="confirmation.message"
      :confirm-label="confirmation.confirmLabel"
      :danger="confirmation.danger"
      @confirm="resolveConfirmation(true)"
      @cancel="resolveConfirmation(false)"
    />
  </div>
</template>
