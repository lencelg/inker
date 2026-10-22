<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { api } from './api';
import ConfirmDialog from './components/ConfirmDialog.vue';
import EditorPane from './components/EditorPane.vue';
import EditorTabs from './components/EditorTabs.vue';
import LeafIcon from './components/LeafIcon.vue';
import NoteSidebar from './components/NoteSidebar.vue';
import PreviewPane from './components/PreviewPane.vue';
import PromptDialog from './components/PromptDialog.vue';
import { renderMarkdown } from './lib/markdown';
import {
  ancestorDirs,
  basename,
  flattenFiles,
  isSameOrDescendant,
  replacePrefix,
} from './lib/paths';
import type { FileEntry, NotesState } from './types';

interface NoteTab {
  path: string;
  content: string;
  savedContent: string;
}

const entries = ref<FileEntry[]>([]);
const notesDir = ref<string | null>(null);
const tabs = ref<NoteTab[]>([]);
const activePath = ref<string | null>(null);
const switching = ref(false);
const mutating = ref(false);
const savingPaths = ref<string[]>([]);
const error = ref('');
const notice = ref('');
const previewVisible = ref(false);
const vimEnabled = ref(false);
const expandedPaths = ref<string[]>([]);
const editorSession = ref(0);
const editorScrollLine = ref(1);
const editorScrollRatio = ref(0);

const activeTab = computed(
  () => tabs.value.find((tab) => tab.path === activePath.value) ?? null,
);
const selectedPath = computed(() => activeTab.value?.path ?? null);
const previewHtml = computed(() => renderMarkdown(activeTab.value?.content ?? ''));
const activeDirty = computed(
  () =>
    activeTab.value !== null &&
    activeTab.value.content !== activeTab.value.savedContent,
);
const saving = computed(
  () =>
    activePath.value !== null && savingPaths.value.includes(activePath.value),
);
const anySaving = computed(() => savingPaths.value.length > 0);
const busy = computed(() => switching.value || mutating.value);
const tabItems = computed(() =>
  tabs.value.map((tab) => ({
    path: tab.path,
    name: basename(tab.path),
    dirty: tab.content !== tab.savedContent,
  })),
);

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

interface PromptState {
  title: string;
  label: string;
  initialValue: string;
  confirmLabel: string;
  placeholder: string;
  busy: boolean;
  error: string;
  submit: (value: string) => Promise<void>;
}

const confirmation = ref<PendingConfirmation | null>(null);
const prompt = ref<PromptState | null>(null);
const saveTasks = new Map<string, Promise<boolean>>();

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown, true);
  void bootstrap();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown, true);
});

async function bootstrap(): Promise<void> {
  try {
    const state = await api.getState();
    applyState(state);
    const first = flattenFiles(state.entries)[0];
    if (first) {
      await openNote(first.path);
    }
  } catch (err) {
    setError(err);
  }
}

function applyState(state: NotesState): void {
  notesDir.value = state.notesDir;
  entries.value = state.entries;
  pruneExpandedPaths();
  pruneTabs();
}

function pruneExpandedPaths(): void {
  const directories = new Set(
    entries.value.filter((entry) => entry.isDir).map((entry) => entry.path),
  );
  expandedPaths.value = expandedPaths.value.filter((path) => directories.has(path));
}

function pruneTabs(): void {
  const files = new Set(
    entries.value.filter((entry) => !entry.isDir).map((entry) => entry.path),
  );
  const stale = tabs.value.filter((tab) => !files.has(tab.path));
  if (stale.length === 0) return;

  const activeIndex = tabs.value.findIndex((tab) => tab.path === activePath.value);
  const activeRemoved =
    activeIndex >= 0 && stale.some((tab) => tab.path === activePath.value);
  tabs.value = tabs.value.filter((tab) => files.has(tab.path));
  if (!activeRemoved) return;

  const fallback = tabs.value[Math.max(0, Math.min(activeIndex, tabs.value.length - 1))];
  if (fallback) {
    activePath.value = fallback.path;
    revealPath(fallback.path);
  } else {
    activePath.value = null;
  }
  editorSession.value += 1;
  editorScrollLine.value = 1;
  editorScrollRatio.value = 0;
}

async function openNote(path: string): Promise<boolean> {
  const existing = tabs.value.find((tab) => tab.path === path);
  if (existing) {
    activateTab(path);
    return true;
  }

  try {
    const detail = await api.readNote(path);
    const opened = tabs.value.find((tab) => tab.path === detail.path);
    if (opened) {
      activateTab(detail.path);
      return true;
    }
    tabs.value.push({
      path: detail.path,
      content: detail.content,
      savedContent: detail.content,
    });
    activateTab(detail.path);
    return true;
  } catch (err) {
    setError(err);
    return false;
  }
}

function activateTab(path: string): void {
  if (!tabs.value.some((tab) => tab.path === path)) return;
  if (activePath.value === path) {
    revealPath(path);
    return;
  }
  activePath.value = path;
  editorSession.value += 1;
  editorScrollLine.value = 1;
  editorScrollRatio.value = 0;
  clearFeedback();
  revealPath(path);
}

function revealPath(path: string): void {
  const directories = ancestorDirs(path);
  if (directories.length === 0) return;
  expandedPaths.value = [
    ...new Set([...expandedPaths.value, ...directories]),
  ];
}

function handleContentChange(value: string): void {
  const tab = activeTab.value;
  if (!tab) return;
  tab.content = value;
  notice.value = '';
}

function handleEditorScroll(position: { line: number; ratio: number }): void {
  editorScrollLine.value = position.line;
  editorScrollRatio.value = position.ratio;
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return;
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (
    prompt.value ||
    confirmation.value ||
    switching.value ||
    mutating.value ||
    !activeTab.value
  ) {
    return;
  }
  void saveCurrentNote();
}

function markSaving(path: string, value: boolean): void {
  const next = new Set(savingPaths.value);
  if (value) {
    next.add(path);
  } else {
    next.delete(path);
  }
  savingPaths.value = [...next];
}

async function saveTab(tab: NoteTab): Promise<boolean> {
  const pending = saveTasks.get(tab.path);
  if (pending) return pending;
  if (tab.content === tab.savedContent) return true;

  const snapshot = tab.content;
  markSaving(tab.path, true);

  const task = (async (): Promise<boolean> => {
    try {
      await api.saveNote(tab.path, snapshot);
      if (tab.content === snapshot) {
        tab.savedContent = snapshot;
      }
      if (activePath.value === tab.path) {
        notice.value = '已保存。';
      }
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      saveTasks.delete(tab.path);
      markSaving(tab.path, false);
    }
  })();

  saveTasks.set(tab.path, task);
  return task;
}

async function saveCurrentNote(): Promise<boolean> {
  const tab = activeTab.value;
  if (!tab) return true;

  clearFeedback();
  const pending = saveTasks.get(tab.path);
  if (pending && !(await pending)) return false;
  if (tab.content === tab.savedContent) {
    if (activePath.value === tab.path) {
      notice.value = '已保存。';
    }
    return true;
  }
  return saveTab(tab);
}

async function saveAllDirtyTabs(): Promise<boolean> {
  for (const tab of [...tabs.value]) {
    const pending = saveTasks.get(tab.path);
    if (pending && !(await pending)) return false;
    if (tab.content === tab.savedContent) continue;
    if (!(await saveTab(tab))) return false;
    if (tab.content !== tab.savedContent) return false;
  }
  return true;
}

async function selectNote(path: string): Promise<void> {
  if (busy.value || path === activePath.value) return;

  const existing = tabs.value.find((tab) => tab.path === path);
  if (existing) {
    activateTab(path);
    return;
  }

  switching.value = true;
  clearFeedback();
  try {
    await openNote(path);
  } finally {
    switching.value = false;
  }
}

async function chooseFolder(): Promise<void> {
  if (busy.value) return;

  try {
    const path = await api.pickNotesDir();
    if (!path) return;

    switching.value = true;
    try {
      clearFeedback();
      if (!(await saveAllDirtyTabs())) return;
    } finally {
      switching.value = false;
    }

    const state = await api.chooseNotesDir(path);
    resetTabs();
    expandedPaths.value = [];
    applyState(state);

    const first = flattenFiles(state.entries)[0];
    if (first) {
      await openNote(first.path);
    }
  } catch (err) {
    setError(err);
  }
}

function resetTabs(): void {
  tabs.value = [];
  activePath.value = null;
  editorSession.value += 1;
  editorScrollLine.value = 1;
  editorScrollRatio.value = 0;
}

function toggleFolder(path: string): void {
  const next = new Set(expandedPaths.value);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  expandedPaths.value = [...next];
}

function requestCreateFile(parent: string): void {
  openPrompt({
    title: '新建文件',
    label: '文件名',
    initialValue: '未命名.md',
    confirmLabel: '创建',
    placeholder: '例如：笔记.md',
    submit: async (name) => {
      if (mutating.value || switching.value) {
        throw new Error('请稍后再试。');
      }
      mutating.value = true;
      try {
        const path = await api.createFile(parent, name);
        await refreshEntries();
        revealPath(path);
        const opened = await openNote(path);
        notice.value = opened ? '文件已创建。' : '文件已创建，但打开失败。';
      } finally {
        mutating.value = false;
      }
    },
  });
}

function requestCreateFolder(parent: string): void {
  openPrompt({
    title: '新建文件夹',
    label: '文件夹名称',
    initialValue: '',
    confirmLabel: '创建',
    placeholder: '例如：日记',
    submit: async (name) => {
      if (mutating.value || switching.value) {
        throw new Error('请稍后再试。');
      }
      mutating.value = true;
      try {
        const path = await api.createFolder(parent, name);
        await refreshEntries();
        revealPath(path);
        notice.value = '文件夹已创建。';
      } finally {
        mutating.value = false;
      }
    },
  });
}

function requestRename(entry: FileEntry): void {
  openPrompt({
    title: entry.isDir ? '重命名文件夹' : '重命名文件',
    label: '新名称',
    initialValue: entry.name,
    confirmLabel: '重命名',
    placeholder: entry.isDir ? '文件夹名称' : '例如：笔记.md',
    submit: async (name) => {
      if (mutating.value || switching.value || anySaving.value) {
        throw new Error('请稍后再试。');
      }
      mutating.value = true;
      try {
        const newPath = await api.renameEntry(entry.path, name);
        for (const tab of tabs.value) {
          tab.path = replacePrefix(tab.path, entry.path, newPath);
        }
        if (activePath.value) {
          activePath.value = replacePrefix(activePath.value, entry.path, newPath);
        }
        expandedPaths.value = expandedPaths.value.map((path) =>
          replacePrefix(path, entry.path, newPath),
        );
        await refreshEntries();
        revealPath(newPath);
        notice.value = '已重命名。';
      } finally {
        mutating.value = false;
      }
    },
  });
}

async function requestDelete(entry: FileEntry): Promise<void> {
  if (busy.value || anySaving.value) return;

  const affectedTabs = tabs.value.filter((tab) =>
    isSameOrDescendant(tab.path, entry.path),
  );
  const hasDirtyTab = affectedTabs.some(
    (tab) => tab.content !== tab.savedContent,
  );
  const warning = hasDirtyTab
    ? '其中有未保存的修改，删除后将无法恢复。'
    : '';
  const confirmed = await askConfirmation({
    title: entry.isDir ? '删除这个文件夹？' : '删除这个文件？',
    message: entry.isDir
      ? `文件夹“${entry.name}”及其内容会移到系统回收站。${warning}`
      : `文件“${entry.name}”会移到系统回收站。${warning}`,
    confirmLabel: '移到回收站',
  });
  if (!confirmed || busy.value || anySaving.value) return;

  mutating.value = true;
  clearFeedback();
  try {
    const activeWasAffected =
      activePath.value !== null &&
      isSameOrDescendant(activePath.value, entry.path);
    await api.deleteEntry(entry.path);
    await refreshEntries();

    if (activeWasAffected && tabs.value.length === 0) {
      const next = flattenFiles(entries.value)[0];
      if (next) {
        await openNote(next.path);
      }
    }
    notice.value = '已移到回收站。';
  } catch (err) {
    setError(err);
  } finally {
    mutating.value = false;
  }
}

async function requestCloseTab(path: string): Promise<void> {
  if (busy.value || anySaving.value) return;

  const tab = tabs.value.find((item) => item.path === path);
  if (!tab) return;

  if (tab.content !== tab.savedContent) {
    const confirmed = await askConfirmation({
      title: '关闭未保存的标签页？',
      message: `“${basename(tab.path)}”有未保存的修改，关闭后将丢失。`,
      confirmLabel: '不保存并关闭',
    });
    if (!confirmed) return;
  }

  const index = tabs.value.findIndex((item) => item.path === path);
  if (index === -1) return;
  const wasActive = activePath.value === path;
  tabs.value.splice(index, 1);

  if (!wasActive) return;
  const next = tabs.value[Math.min(index, tabs.value.length - 1)];
  if (next) {
    activePath.value = next.path;
    revealPath(next.path);
  } else {
    activePath.value = null;
  }
  editorSession.value += 1;
  editorScrollLine.value = 1;
  editorScrollRatio.value = 0;
  clearFeedback();
}

async function refreshEntries(): Promise<void> {
  const state = await api.refresh();
  applyState(state);
}

function openPrompt(config: Omit<PromptState, 'busy' | 'error'>): void {
  prompt.value = { ...config, busy: false, error: '' };
}

async function submitPrompt(value: string): Promise<void> {
  const current = prompt.value;
  if (!current || current.busy) return;

  current.busy = true;
  current.error = '';
  try {
    await current.submit(value);
    prompt.value = null;
  } catch (err) {
    current.error = errorMessage(err);
  } finally {
    if (prompt.value === current) {
      current.busy = false;
    }
  }
}

function cancelPrompt(): void {
  if (prompt.value?.busy) return;
  prompt.value = null;
}

function askConfirmation(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    confirmation.value = { danger: true, ...options, resolve };
  });
}

function resolveConfirmation(confirmed: boolean): void {
  const current = confirmation.value;
  confirmation.value = null;
  current?.resolve(confirmed);
}

function clearFeedback(): void {
  error.value = '';
  notice.value = '';
}

function setError(err: unknown): void {
  error.value = errorMessage(err);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
</script>

<template>
  <div class="app-shell">
    <NoteSidebar
      :entries="entries"
      :selected-path="selectedPath"
      :notes-dir="notesDir"
      :expanded-paths="expandedPaths"
      :busy="busy || anySaving"
      @select="selectNote"
      @toggle-folder="toggleFolder"
      @choose-folder="chooseFolder"
      @create-file="requestCreateFile"
      @create-folder="requestCreateFolder"
      @rename="requestRename"
      @remove="requestDelete"
    />

    <main v-if="notesDir === null" class="workspace welcome">
      <div class="welcome-card">
        <span class="welcome-icon"><LeafIcon /></span>
        <h1>markleaf</h1>
        <p>选择一个文件夹，笔记会以 .md 文件保存在其中。</p>
        <button class="btn primary" type="button" @click="chooseFolder">
          选择笔记文件夹
        </button>
        <p v-if="error" class="welcome-error">{{ error }}</p>
      </div>
    </main>

    <main v-else class="workspace">
      <div v-if="error" class="banner" role="alert">
        <span>{{ error }}</span>
        <button type="button" aria-label="关闭错误提示" @click="error = ''">×</button>
      </div>

      <template v-if="activeTab">
        <header class="workspace-header">
          <EditorTabs
            :tabs="tabItems"
            :active-path="activePath"
            @select="activateTab"
            @close="requestCloseTab"
          />
          <div class="toolbar">
            <button
              class="btn ghost toggle"
              :class="{ active: vimEnabled }"
              type="button"
              :aria-pressed="vimEnabled"
              title="切换 Vim 模式"
              @click="vimEnabled = !vimEnabled"
            >
              Vim
            </button>
            <button
              class="btn ghost toggle"
              :class="{ active: previewVisible }"
              type="button"
              :aria-pressed="previewVisible"
              @click="previewVisible = !previewVisible"
            >
              预览
            </button>
          </div>
        </header>

        <div class="document-meta">
          <span class="document-path">{{ activeTab.path }}</span>
          <span v-if="saving" class="pill draft">保存中…</span>
          <span v-else-if="activeDirty" class="pill dirty">未保存</span>
          <span v-else class="pill saved">已保存</span>
          <span v-if="notice" class="notice-text">{{ notice }}</span>
        </div>

        <div class="panes" :class="{ single: !previewVisible }">
          <section class="editor-pane">
            <header class="pane-header">
              <span class="pane-title">Markdown</span>
              <span v-if="vimEnabled" class="pane-hint">Vim</span>
            </header>
            <EditorPane
              :key="editorSession"
              :initial-content="activeTab.content"
              :vim-enabled="vimEnabled"
              :read-only="switching || mutating"
              @change="handleContentChange"
              @scroll-sync="handleEditorScroll"
            />
          </section>

          <PreviewPane
            v-if="previewVisible"
            :key="editorSession"
            :html="previewHtml"
            :note-path="activeTab.path"
            :scroll-line="editorScrollLine"
            :scroll-ratio="editorScrollRatio"
          />
        </div>
      </template>

      <div v-else class="workspace-empty">
        <span class="workspace-empty-icon"><LeafIcon /></span>
        <h1>还没有打开笔记</h1>
        <p>在左侧文件树中打开或新建一个 Markdown 文件。</p>
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

    <PromptDialog
      v-if="prompt"
      :title="prompt.title"
      :label="prompt.label"
      :initial-value="prompt.initialValue"
      :confirm-label="prompt.confirmLabel"
      :placeholder="prompt.placeholder"
      :busy="prompt.busy"
      :error="prompt.error"
      @confirm="submitPrompt"
      @cancel="cancelPrompt"
    />
  </div>
</template>
