<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { api } from './api';
import AppMenu from './components/AppMenu.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import EditorPane from './components/EditorPane.vue';
import EditorTabs from './components/EditorTabs.vue';
import LeafIcon from './components/LeafIcon.vue';
import NoteSidebar from './components/NoteSidebar.vue';
import PreviewPane from './components/PreviewPane.vue';
import PrintPreview from './components/PrintPreview.vue';
import PromptDialog from './components/PromptDialog.vue';
import SearchPanel from './components/SearchPanel.vue';
import StatusBar from './components/StatusBar.vue';
import {
  prepareExport,
  saveDocxExport,
  saveHtmlExport,
} from './lib/exportContent';
import { renderMarkdown } from './lib/markdown';
import {
  ancestorDirs,
  basename,
  flattenFiles,
  isSameOrDescendant,
  replacePrefix,
} from './lib/paths';
import {
  PREFERENCES_EVENT,
  PREFERENCES_REQUEST_EVENT,
  applyPreferences,
  normalizePreferences,
  readPreferences,
  savePreferences,
  type Preferences,
} from './lib/preferences';
import type { ViewMode } from './lib/viewModes';
import type { FileEntry, NotesState, SearchMatch } from './types';

const WysiwygPane = defineAsyncComponent(
  () => import('./components/WysiwygPane.vue'),
);

interface NoteTab {
  path: string;
  content: string;
  savedContent: string;
}

const SPLIT_STORAGE_KEY = 'markleaf-split-ratio';

const entries = ref<FileEntry[]>([]);
const notesDir = ref<string | null>(null);
const tabs = ref<NoteTab[]>([]);
const activePath = ref<string | null>(null);
const previewPath = ref<string | null>(null);
const previewOpenTasks = new Map<string, Promise<void>>();
const switching = ref(false);
const mutating = ref(false);
const savingPaths = ref<string[]>([]);
const exporting = ref(false);
const printPreview = ref<{ title: string; html: string } | null>(null);
const isMaximized = ref(false);
const appWindow = getCurrentWindow();
let unlistenWindow: UnlistenFn | null = null;
const error = ref('');
const preferences = ref<Preferences>(readPreferences());
const activeView = ref<'explorer' | 'search'>('explorer');
const sidebarVisible = ref(true);
const viewMode = ref<ViewMode>('source');
const splitRatio = ref(readSplitRatio());
const resizing = ref(false);
const expandedPaths = ref<string[]>([]);
const editorSession = ref(0);
const editorScrollRatio = ref(0);
const previewFocusLine = ref(1);
const cursorLine = ref<number | null>(null);
const cursorColumn = ref<number | null>(null);
let cursorSyncTime = 0;
let previewScrollLock = 0;
const pendingEditorRestore = ref<{
  path: string;
  state: { line: number; column: number; scrollTop: number };
} | null>(null);
const editorPane = ref<{
  revealLine: (line: number, column?: number) => void;
  refresh: () => void;
  scrollToLine: (line: number) => void;
  captureState: () => {
    line: number;
    column: number;
    scrollTop: number;
  } | null;
  restoreState: (state: {
    line: number;
    column: number;
    scrollTop: number;
  }) => void;
} | null>(null);

applyPreferences(preferences.value);

const activeTab = computed(
  () => tabs.value.find((tab) => tab.path === activePath.value) ?? null,
);
const selectedPath = computed(() => activeTab.value?.path ?? null);
const previewHtml = computed(() =>
  renderMarkdown(activeTab.value?.content ?? '', {
    codeHighlight: preferences.value.codeHighlight,
  }),
);
const anySaving = computed(() => savingPaths.value.length > 0);
const busy = computed(() => switching.value || mutating.value);
const vimEnabled = computed(() => preferences.value.vimEnabled);
const lineEnding = computed(() =>
  activeTab.value?.content.includes('\r\n') ? 'CRLF' : 'LF',
);
const previewLayoutKey = computed(
  () =>
    `${preferences.value.theme}:${preferences.value.fontFamily}:${preferences.value.fontSize}`,
);
const immersiveEnabled = computed(() => preferences.value.immersive);
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
let wheelAccumulator = 0;
let unlistenPreferences: UnlistenFn | null = null;
let unlistenPreferencesRequest: UnlistenFn | null = null;

function readSplitRatio(): number {
  try {
    const raw = window.localStorage.getItem(SPLIT_STORAGE_KEY);
    if (raw !== null) {
      const value = Number(raw);
      if (Number.isFinite(value)) {
        return Math.min(0.8, Math.max(0.2, value));
      }
    }
  } catch {
    // Use the default split when storage is unavailable.
  }
  return 0.5;
}

function persistSplitRatio(): void {
  try {
    window.localStorage.setItem(
      SPLIT_STORAGE_KEY,
      String(splitRatio.value),
    );
  } catch {
    // Persisting the layout is optional.
  }
}

function toggleSidebar(): void {
  sidebarVisible.value = !sidebarVisible.value;
}

function showActivity(view: 'explorer' | 'search'): void {
  activeView.value = view;
  sidebarVisible.value = true;
}

function startResize(event: PointerEvent): void {
  if (viewMode.value !== 'side') return;
  event.preventDefault();

  const resizer = event.currentTarget as HTMLElement;
  const container = resizer.parentElement;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  resizing.value = true;
  resizer.setPointerCapture(event.pointerId);

  const move = (moveEvent: PointerEvent): void => {
    const ratio = (moveEvent.clientX - rect.left) / rect.width;
    splitRatio.value = Math.min(0.8, Math.max(0.2, ratio));
  };
  const stop = (): void => {
    resizing.value = false;
    resizer.removeEventListener('pointermove', move);
    resizer.removeEventListener('pointerup', stop);
    resizer.removeEventListener('pointercancel', stop);
    if (resizer.hasPointerCapture(event.pointerId)) {
      resizer.releasePointerCapture(event.pointerId);
    }
    persistSplitRatio();
  };

  resizer.addEventListener('pointermove', move);
  resizer.addEventListener('pointerup', stop);
  resizer.addEventListener('pointercancel', stop);
}

function onResizerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const delta = event.key === 'ArrowLeft' ? -0.02 : 0.02;
  splitRatio.value = Math.min(0.8, Math.max(0.2, splitRatio.value + delta));
  persistSplitRatio();
}

function resetSplit(): void {
  splitRatio.value = 0.5;
  persistSplitRatio();
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown, true);
  window.addEventListener('wheel', handleGlobalWheel, {
    capture: true,
    passive: false,
  });
  void appWindow
    .isMaximized()
    .then((maximized) => {
      isMaximized.value = maximized;
    })
    .catch(() => undefined);
  void appWindow
    .onResized(() => {
      void appWindow
        .isMaximized()
        .then((maximized) => {
          isMaximized.value = maximized;
        })
        .catch(() => undefined);
    })
    .then((unlisten) => {
      unlistenWindow = unlisten;
    })
    .catch(() => undefined);
  void setupPreferenceSync();
  void bootstrap();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown, true);
  window.removeEventListener('wheel', handleGlobalWheel, true);
  unlistenPreferences?.();
  unlistenPreferencesRequest?.();
  unlistenWindow?.();
});

async function setupPreferenceSync(): Promise<void> {
  try {
    unlistenPreferences = await listen<Preferences>(
      PREFERENCES_EVENT,
      (event) => {
        const next = normalizePreferences(event.payload);
        preferences.value = next;
        savePreferences(next);
        applyPreferences(next);
      },
    );
    unlistenPreferencesRequest = await listen(
      PREFERENCES_REQUEST_EVENT,
      () => {
        void emit(PREFERENCES_EVENT, preferences.value).catch(() => {
          // Live sync is best-effort; local storage still applies.
        });
      },
    );
  } catch {
    // Preferences remain usable without cross-window events.
  }
}

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

function updatePreferences(patch: Partial<Preferences>): void {
  const next = normalizePreferences({ ...preferences.value, ...patch });
  preferences.value = next;
  savePreferences(next);
  applyPreferences(next);
  void emit(PREFERENCES_EVENT, next).catch(() => {
    // Persistence has already happened locally.
  });
}

function setFontSize(value: number): void {
  updatePreferences({ fontSize: value });
}

function toggleImmersive(): void {
  updatePreferences({ immersive: !preferences.value.immersive });
}

function toggleVim(): void {
  updatePreferences({ vimEnabled: !preferences.value.vimEnabled });
}

function handleGlobalWheel(event: WheelEvent): void {
  if (!(event.ctrlKey || event.metaKey)) {
    wheelAccumulator = 0;
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
  wheelAccumulator += delta;
  if (Math.abs(wheelAccumulator) < 30) return;

  const direction = Math.sign(wheelAccumulator);
  wheelAccumulator = 0;
  setFontSize(preferences.value.fontSize - direction);
}

function handleCursor(position: {
  line: number;
  column: number;
}): void {
  cursorLine.value = position.line;
  cursorColumn.value = position.column;
  cursorSyncTime = performance.now();
  previewFocusLine.value = position.line;
}

async function setViewMode(mode: ViewMode): Promise<void> {
  if (viewMode.value === mode) return;
  const leavingWysiwyg = viewMode.value === 'wysiwyg';
  const enteringWysiwyg = mode === 'wysiwyg';

  if (enteringWysiwyg) {
    const state = editorPane.value?.captureState() ?? null;
    const path = activeTab.value?.path;
    pendingEditorRestore.value =
      state && path ? { path, state } : null;
  }

  viewMode.value = mode;
  if (leavingWysiwyg || enteringWysiwyg) {
    editorSession.value += 1;
    previewFocusLine.value = 1;
    if (enteringWysiwyg) {
      cursorLine.value = null;
      cursorColumn.value = null;
    }
  }
  await nextTick();

  if (leavingWysiwyg) {
    const pending = pendingEditorRestore.value;
    pendingEditorRestore.value = null;
    if (pending && pending.path === activeTab.value?.path) {
      editorPane.value?.restoreState(pending.state);
    } else if (mode !== 'preview') {
      editorPane.value?.refresh();
    }
  } else if (mode !== 'preview' && mode !== 'wysiwyg') {
    editorPane.value?.refresh();
  }
}

async function openSettings(): Promise<void> {
  try {
    await api.openSettingsWindow();
  } catch (err) {
    setError(err);
  }
}

async function minimizeWindow(): Promise<void> {
  try {
    await appWindow.minimize();
  } catch (err) {
    setError(err);
  }
}

async function toggleMaximizeWindow(): Promise<void> {
  try {
    await appWindow.toggleMaximize();
    isMaximized.value = await appWindow.isMaximized();
  } catch (err) {
    setError(err);
  }
}

async function closeWindow(): Promise<void> {
  try {
    await appWindow.close();
  } catch (err) {
    setError(err);
  }
}

function isTitlebarInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'button, .tab, input, select, textarea, a, [role="menu"], [data-no-drag]',
    ) !== null
  );
}

function onTitlebarPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || isTitlebarInteractive(event.target)) return;
  void appWindow.startDragging().catch(() => undefined);
}

function onTitlebarDoubleClick(event: MouseEvent): void {
  if (isTitlebarInteractive(event.target)) return;
  void toggleMaximizeWindow();
}

async function handleExport(
  format: 'pdf' | 'html' | 'docx',
): Promise<void> {
  const tab = activeTab.value;
  if (!tab || exporting.value) return;

  exporting.value = true;
  clearFeedback();
  try {
    const prepared = await prepareExport(tab.path, tab.content, {
      codeHighlight: preferences.value.codeHighlight,
    });
    if (format === 'pdf') {
      printPreview.value = {
        title: prepared.title,
        html: prepared.documentHtml,
      };
      return;
    }
    if (format === 'html') {
      await saveHtmlExport(prepared);
    } else {
      await saveDocxExport(prepared);
    }
  } catch (err) {
    setError(err);
  } finally {
    exporting.value = false;
  }
}

async function openSearchResult(match: SearchMatch): Promise<void> {
  const openTab = tabs.value.find((tab) => tab.path === match.path);
  if (!openTab) {
    if (!(await openNote(match.path))) return;
  } else if (activePath.value !== match.path) {
    activateTab(match.path);
  }
  if (previewPath.value === match.path) {
    previewPath.value = null;
  }

  if (viewMode.value === 'wysiwyg') {
    await setViewMode('source');
  }

  await nextTick();
  editorPane.value?.revealLine(match.line, match.column);
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
  if (
    previewPath.value !== null &&
    !tabs.value.some((tab) => tab.path === previewPath.value)
  ) {
    previewPath.value = null;
  }
  if (!activeRemoved) return;

  const fallback = tabs.value[Math.max(0, Math.min(activeIndex, tabs.value.length - 1))];
  if (fallback) {
    activePath.value = fallback.path;
    revealPath(fallback.path);
  } else {
    activePath.value = null;
  }
  editorSession.value += 1;
  editorScrollRatio.value = 0;
  previewFocusLine.value = 1;
  cursorLine.value = null;
  cursorColumn.value = null;
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
  editorScrollRatio.value = 0;
  previewFocusLine.value = 1;
  cursorLine.value = null;
  cursorColumn.value = null;
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
  if (
    previewPath.value === tab.path &&
    tab.content !== tab.savedContent
  ) {
    previewPath.value = null;
  }
}

function handleEditorScroll(position: { line: number; ratio: number }): void {
  if (performance.now() < previewScrollLock) return;
  editorScrollRatio.value = position.ratio;
  if (performance.now() - cursorSyncTime > 150) {
    previewFocusLine.value = position.line;
  }
}

function handlePreviewScroll(line: number): void {
  if (viewMode.value !== 'side') return;
  previewScrollLock = performance.now() + 180;
  editorPane.value?.scrollToLine(line);
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return;
  const modifier = event.ctrlKey || event.metaKey;

  if (modifier && event.shiftKey && event.key.toLowerCase() === 'm') {
    event.preventDefault();
    event.stopPropagation();
    toggleImmersive();
    return;
  }

  if (!modifier || event.key.toLowerCase() !== 's') {
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

async function openPreviewNote(path: string): Promise<void> {
  try {
    const detail = await api.readNote(path);
    const opened = tabs.value.find((tab) => tab.path === detail.path);
    if (opened) {
      activateTab(detail.path);
      return;
    }

    const previewIndex = previewPath.value
      ? tabs.value.findIndex((tab) => tab.path === previewPath.value)
      : -1;
    const previewTab =
      previewIndex >= 0 ? tabs.value[previewIndex] : null;
    const replaceable =
      previewTab !== null &&
      previewTab.content === previewTab.savedContent;
    if (previewTab && !replaceable) {
      previewPath.value = null;
    }

    const next: NoteTab = {
      path: detail.path,
      content: detail.content,
      savedContent: detail.content,
    };
    if (replaceable && previewIndex >= 0) {
      tabs.value.splice(previewIndex, 1, next);
    } else {
      tabs.value.push(next);
    }
    previewPath.value = detail.path;
    activateTab(detail.path);
  } catch (err) {
    setError(err);
  }
}

async function selectNote(path: string): Promise<void> {
  if (busy.value || path === activePath.value) return;

  const existing = tabs.value.find((tab) => tab.path === path);
  if (existing) {
    activateTab(path);
    return;
  }

  const pending = previewOpenTasks.get(path);
  if (pending) {
    await pending;
    return;
  }

  switching.value = true;
  clearFeedback();
  const task = openPreviewNote(path).finally(() => {
    previewOpenTasks.delete(path);
    switching.value = false;
  });
  previewOpenTasks.set(path, task);
  await task;
}

async function pinNote(path: string): Promise<void> {
  const pending = previewOpenTasks.get(path);
  if (pending) await pending;
  if (busy.value) return;

  const existing = tabs.value.find((tab) => tab.path === path);
  if (existing) {
    if (previewPath.value === path) previewPath.value = null;
    activateTab(path);
    return;
  }

  switching.value = true;
  clearFeedback();
  try {
    await openNote(path);
    if (previewPath.value === path) previewPath.value = null;
  } finally {
    switching.value = false;
  }
}

function pinPreview(path: string): void {
  if (previewPath.value === path) previewPath.value = null;
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
  previewPath.value = null;
  editorSession.value += 1;
  editorScrollRatio.value = 0;
  previewFocusLine.value = 1;
  cursorLine.value = null;
  cursorColumn.value = null;
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
        await openNote(path);
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
        if (previewPath.value) {
          previewPath.value = replacePrefix(
            previewPath.value,
            entry.path,
            newPath,
          );
        }
        if (activePath.value) {
          activePath.value = replacePrefix(activePath.value, entry.path, newPath);
        }
        expandedPaths.value = expandedPaths.value.map((path) =>
          replacePrefix(path, entry.path, newPath),
        );
        await refreshEntries();
        revealPath(newPath);
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
  if (previewPath.value === path) previewPath.value = null;

  if (!wasActive) return;
  const next = tabs.value[Math.min(index, tabs.value.length - 1)];
  if (next) {
    activePath.value = next.path;
    revealPath(next.path);
  } else {
    activePath.value = null;
  }
  editorSession.value += 1;
  editorScrollRatio.value = 0;
  previewFocusLine.value = 1;
  cursorLine.value = null;
  cursorColumn.value = null;
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
}

function setError(err: unknown): void {
  error.value = errorMessage(err);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'sidebar-hidden': !sidebarVisible }"
  >
    <header
      class="titlebar"
      @pointerdown="onTitlebarPointerDown"
      @dblclick="onTitlebarDoubleClick"
    >
      <div class="titlebar-nav">
        <button
          type="button"
          class="titlebar-button"
          :class="{ active: sidebarVisible }"
          title="切换侧边栏"
          aria-label="切换侧边栏"
          @click="toggleSidebar"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="M9.5 4.5v15" fill="none" stroke="currentColor" stroke-width="1.6" />
          </svg>
        </button>
        <button
          type="button"
          class="titlebar-button"
          :class="{ active: sidebarVisible && activeView === 'explorer' }"
          title="文件"
          aria-label="文件"
          @click="showActivity('explorer')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l1.5 2h9.5A1.5 1.5 0 0 1 21 9.5v7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="titlebar-button"
          :class="{ active: sidebarVisible && activeView === 'search' }"
          title="搜索"
          aria-label="搜索"
          @click="showActivity('search')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="m15 15 5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <EditorTabs
        :tabs="tabItems"
        :active-path="activePath"
        :preview-path="previewPath"
        @select="activateTab"
        @pin="pinPreview"
        @close="requestCloseTab"
      />

      <div class="titlebar-actions">
        <AppMenu
          :view-mode="viewMode"
          :vim-enabled="vimEnabled"
          :exporting="exporting"
          @mode-change="setViewMode"
          @export="handleExport"
          @toggle-vim="toggleVim"
          @open-settings="openSettings"
        />
        <div class="window-controls">
          <button
            type="button"
            class="window-control"
            title="最小化"
            aria-label="最小化"
            @click="minimizeWindow"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
          <button
            type="button"
            class="window-control"
            :title="isMaximized ? '还原' : '最大化'"
            :aria-label="isMaximized ? '还原' : '最大化'"
            @click="toggleMaximizeWindow"
          >
            <svg v-if="isMaximized" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="7" y="7" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
              <path d="M10 7V4.5h9.5V14H17" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </button>
          <button
            type="button"
            class="window-control close"
            title="关闭"
            aria-label="关闭"
            @click="closeWindow"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <NoteSidebar
      v-if="sidebarVisible && activeView === 'explorer'"
      :entries="entries"
      :selected-path="selectedPath"
      :notes-dir="notesDir"
      :expanded-paths="expandedPaths"
      :busy="busy || anySaving"
      @select="selectNote"
      @pin="pinNote"
      @toggle-folder="toggleFolder"
      @choose-folder="chooseFolder"
      @create-file="requestCreateFile"
      @create-folder="requestCreateFolder"
      @rename="requestRename"
      @remove="requestDelete"
    />

    <SearchPanel
      v-else-if="sidebarVisible && activeView === 'search'"
      :notes-dir="notesDir"
      @open="openSearchResult"
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
        <WysiwygPane
          v-if="viewMode === 'wysiwyg'"
          :key="editorSession"
          :initial-content="activeTab.content"
          :note-path="activeTab.path"
          :read-only="switching || mutating"
          :immersive="immersiveEnabled"
          @change="handleContentChange"
        />

        <div
          v-else
          class="panes"
          :class="{ single: viewMode !== 'side', resizing }"
          :style="
            viewMode === 'side'
              ? {
                  gridTemplateColumns: `${splitRatio}fr 6px ${1 - splitRatio}fr`,
                }
              : undefined
          "
        >
          <section
            v-show="viewMode !== 'preview'"
            class="editor-pane"
          >
            <EditorPane
              ref="editorPane"
              :key="editorSession"
              :initial-content="activeTab.content"
              :vim-enabled="vimEnabled"
              :read-only="switching || mutating"
              :layout-key="previewLayoutKey"
              :immersive="immersiveEnabled"
              @change="handleContentChange"
              @scroll-sync="handleEditorScroll"
              @cursor="handleCursor"
              @save-request="saveCurrentNote"
            />
          </section>

          <div
            v-if="viewMode === 'side'"
            class="pane-resizer"
            role="separator"
            aria-orientation="vertical"
            :aria-valuenow="Math.round(splitRatio * 100)"
            aria-valuemin="20"
            aria-valuemax="80"
            tabindex="0"
            title="拖动调整编辑区和预览区宽度，双击恢复默认"
            @pointerdown="startResize"
            @keydown="onResizerKeydown"
            @dblclick="resetSplit"
          ></div>

          <PreviewPane
            v-if="viewMode !== 'source'"
            :key="editorSession"
            :html="previewHtml"
            :note-path="activeTab.path"
            :focus-line="previewFocusLine"
            :scroll-ratio="editorScrollRatio"
            :layout-key="previewLayoutKey"
            @sync-source="handlePreviewScroll"
          />
        </div>
      </template>

      <div v-else class="workspace-empty">
        <span class="workspace-empty-icon"><LeafIcon /></span>
        <h1>还没有打开笔记</h1>
        <p>在左侧文件树中打开或新建一个 Markdown 文件。</p>
      </div>
    </main>

    <StatusBar
      :line="activeTab && viewMode !== 'wysiwyg' ? cursorLine : null"
      :column="activeTab && viewMode !== 'wysiwyg' ? cursorColumn : null"
      :mode="viewMode"
      :vim-enabled="vimEnabled && viewMode !== 'wysiwyg'"
      :line-ending="lineEnding"
      :immersive="immersiveEnabled"
      @mode-change="setViewMode"
      @immersive-toggle="toggleImmersive"
    />

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

    <PrintPreview
      v-if="printPreview"
      :title="printPreview.title"
      :html="printPreview.html"
      @close="printPreview = null"
    />
  </div>
</template>
