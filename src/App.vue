<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import type { UnlistenFn } from '@tauri-apps/api/event';
import {
  getCurrentWindow,
  type CloseRequestedEvent,
} from '@tauri-apps/api/window';
import { openPath } from '@tauri-apps/plugin-opener';
import { api } from './api';
import ActivityRail from './components/ActivityRail.vue';
import AppMenu from './components/AppMenu.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import EditorPane from './components/EditorPane.vue';
import EditorTabs from './components/EditorTabs.vue';
import ExportPreviewDialog from './components/ExportPreviewDialog.vue';
import HtmlExportDialog from './components/HtmlExportDialog.vue';
import ImagePane from './components/ImagePane.vue';
import ImagePasteDialog from './components/ImagePasteDialog.vue';
import InkerMark from './components/InkerMark.vue';
import NoteSidebar from './components/NoteSidebar.vue';
import PreviewPane from './components/PreviewPane.vue';
import PromptDialog from './components/PromptDialog.vue';
import SearchPanel from './components/SearchPanel.vue';
import SettingsOverlay from './components/SettingsOverlay.vue';
import StatusBar from './components/StatusBar.vue';
import {
  buildDocxBase64,
  buildDocxPreviewDocument,
  prepareExport,
  saveDocxBase64,
  saveHtmlExport,
  type PreparedExport,
  type SaveDocxOptions,
} from './lib/exportContent';
import {
  blobToBase64,
  buildImageFileName,
  convertImageFile,
  encodeMarkdownImagePath,
  extensionForFormat,
  renderImageName,
  sanitizeImageStem,
  stripImageExtension,
  type ImageFormat,
  type ImageSaveResult,
} from './lib/imagePaste';
import {
  clearWorkspaceDrafts,
  putDraftEntry,
  readDraftList,
  readDraftsForWorkspace,
  removeDraft,
  removeDraftEntry,
  removeDraftsUnder,
  renameDrafts,
  writeDraft,
  writeDraftList,
  type DraftEntry,
} from './lib/drafts';
import { isImagePath } from './lib/fileKinds';
import { localizeError, t } from './lib/i18n';
import { renderMarkdown } from './lib/markdown';
import {
  ancestorDirs,
  basename,
  flattenFiles,
  isSameOrDescendant,
  replacePrefix,
} from './lib/paths';
import {
  applyPreferences,
  normalizePreferences,
  readPreferences,
  savePreferences,
  type Preferences,
} from './lib/preferences';
import {
  pruneWorkspaceSession,
  readWorkspaceSession,
  writeWorkspaceSession,
  type WorkspaceSession,
} from './lib/session';
import type { ViewMode } from './lib/viewModes';
import { applySlowWheel } from './lib/wheelScroll';
import type { FileEntry, NotesState, SearchMatch } from './types';

const WysiwygPane = defineAsyncComponent(
  () => import('./components/WysiwygPane.vue'),
);

interface NoteTab {
  path: string;
  content: string;
  savedContent: string;
}

interface EditorTabState {
  line: number;
  column: number;
  scrollTop: number;
}

interface PendingImagePaste {
  file: File;
  defaultName: string;
  extension: string;
  folder: string;
  resolve: (name: string | null) => void;
}

const SESSION_DEBOUNCE_MS = 400;
const SESSION_MAX_INTERVAL_MS = 5000;
const DRAFT_IDLE_MS = 2000;
const DRAFT_MAX_INTERVAL_MS = 15000;
const SPLIT_STORAGE_KEY = 'inker-split-ratio';
const LEGACY_SPLIT_STORAGE_KEY = 'markleaf-split-ratio';
const SIDEBAR_WIDTH_STORAGE_KEY = 'inker-sidebar-width';
const LEGACY_SIDEBAR_WIDTH_STORAGE_KEY = 'markleaf-sidebar-width';
const DEFAULT_SIDEBAR_WIDTH = 252;
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 480;

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
const exportPreview = ref<{
  format: 'pdf' | 'docx';
  title: string;
  html: string;
  warnings: string[];
  docxPrepared?: PreparedExport;
  docxOptions?: SaveDocxOptions;
  docxBase64?: string;
} | null>(null);
const htmlExport = ref<{
  title: string;
  embedded: PreparedExport;
  linked: PreparedExport;
  embeddedBytes: number;
  linkedBytes: number;
  warnings: string[];
} | null>(null);
const settingsOpen = ref(false);
const isMaximized = ref(false);
const appWindow = getCurrentWindow();
let unlistenWindow: UnlistenFn | null = null;
const error = ref('');
const warning = ref('');
const preferences = ref<Preferences>(readPreferences());
const vimMode = ref<string | null>('NORMAL');
const activeView = ref<'explorer' | 'search'>('explorer');
const sidebarVisible = ref(true);
const sidebarWidth = ref(readSidebarWidth());
const resizingSidebar = ref(false);
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
  promptImageName: (
    defaultName: string,
    extension?: string,
  ) => Promise<string | null>;
} | null>(null);

const tabStates = new Map<string, EditorTabState>();
const autoSaveTimers = new Map<string, number>();
let draftTimer = 0;
let lastDraftFlushAt = 0;
let lastSessionPersistAt = 0;
let sessionTimer = 0;
let sessionHydrating = false;
let closeApproved = false;
let closeInProgress = false;
let suppressDrafts = false;
let restoringTabPath: string | null = null;
let unlistenClose: UnlistenFn | null = null;

applyPreferences(preferences.value);

const activeTab = computed(
  () => tabs.value.find((tab) => tab.path === activePath.value) ?? null,
);
const selectedPath = computed(() => activeTab.value?.path ?? null);
const activeImagePath = computed(() =>
  activeTab.value && isImagePath(activeTab.value.path)
    ? activeTab.value.path
    : null,
);
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
    kind: isImagePath(tab.path) ? ('image' as const) : ('note' as const),
  })),
);
const saveState = computed<'saved' | 'saving' | 'dirty' | null>(() => {
  const tab = activeTab.value;
  if (!tab || isImagePath(tab.path)) return null;
  if (savingPaths.value.includes(tab.path)) return 'saving';
  return tab.content === tab.savedContent ? 'saved' : 'dirty';
});

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
const imagePaste = ref<PendingImagePaste | null>(null);
const wysiwygPane = ref<{ focus: () => void } | null>(null);
const saveTasks = new Map<string, Promise<boolean>>();
let wheelAccumulator = 0;
let imageRequestActive = false;

function readSplitRatio(): number {
  try {
    const raw =
      window.localStorage.getItem(SPLIT_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_SPLIT_STORAGE_KEY);
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
    window.localStorage.removeItem(LEGACY_SPLIT_STORAGE_KEY);
  } catch {
    // Persisting the layout is optional.
  }
}

function readSidebarWidth(): number {
  try {
    const raw =
      window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_SIDEBAR_WIDTH_STORAGE_KEY);
    if (raw !== null) {
      const value = Number(raw);
      if (Number.isFinite(value)) {
        return clampSidebarWidth(value);
      }
    }
  } catch {
    // Use the default width when storage is unavailable.
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

function clampSidebarWidth(value: number): number {
  return Math.min(
    MAX_SIDEBAR_WIDTH,
    Math.max(MIN_SIDEBAR_WIDTH, Math.round(value)),
  );
}

function persistSidebarWidth(): void {
  try {
    window.localStorage.setItem(
      SIDEBAR_WIDTH_STORAGE_KEY,
      String(sidebarWidth.value),
    );
    window.localStorage.removeItem(LEGACY_SIDEBAR_WIDTH_STORAGE_KEY);
  } catch {
    // Persisting the layout is optional.
  }
}

function resetSidebarWidth(): void {
  sidebarWidth.value = DEFAULT_SIDEBAR_WIDTH;
  persistSidebarWidth();
}

function startSidebarResize(event: PointerEvent): void {
  if (event.button !== 0 || !sidebarVisible.value) return;
  event.preventDefault();

  const handle = event.currentTarget as HTMLElement;
  const startX = event.clientX;
  const startWidth = sidebarWidth.value;
  resizingSidebar.value = true;
  handle.setPointerCapture(event.pointerId);

  const move = (moveEvent: PointerEvent): void => {
    sidebarWidth.value = clampSidebarWidth(
      startWidth + moveEvent.clientX - startX,
    );
  };
  const stop = (): void => {
    resizingSidebar.value = false;
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', stop);
    handle.removeEventListener('pointercancel', stop);
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    persistSidebarWidth();
  };

  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}

function onSidebarResizerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const delta = event.key === 'ArrowLeft' ? -12 : 12;
  sidebarWidth.value = clampSidebarWidth(sidebarWidth.value + delta);
  persistSidebarWidth();
}

function selectExplorer(): void {
  if (activeView.value === 'explorer' && sidebarVisible.value) {
    sidebarVisible.value = false;
    return;
  }
  activeView.value = 'explorer';
  sidebarVisible.value = true;
}

function selectSearch(): void {
  if (activeView.value === 'search' && sidebarVisible.value) {
    sidebarVisible.value = false;
    return;
  }
  activeView.value = 'search';
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
  window.addEventListener('wheel', handleSlowScrollWheel, {
    capture: true,
    passive: false,
  });
  window.addEventListener('blur', handleWindowBlur);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  void appWindow
    .onCloseRequested(handleCloseRequested)
    .then((unlisten) => {
      unlistenClose = unlisten;
    })
    .catch(() => undefined);
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
  void bootstrap();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown, true);
  window.removeEventListener('wheel', handleGlobalWheel, true);
  window.removeEventListener('wheel', handleSlowScrollWheel, true);
  window.removeEventListener('blur', handleWindowBlur);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  cancelImagePasteName();
  cancelAllAutoSaveTimers();
  clearDraftTimer();
  clearSessionTimer();
  unlistenWindow?.();
  unlistenClose?.();
});

async function bootstrap(): Promise<void> {
  sessionHydrating = true;
  try {
    const state = await api.getState();
    applyState(state);
    let restored = false;
    try {
      restored = await restoreWorkspaceSession(state);
    } catch {
      restored = false;
    }
    if (restored) return;
    const first = firstNotePath(state.entries);
    if (first) {
      await openNote(first);
    }
  } catch (err) {
    setError(err);
  } finally {
    sessionHydrating = false;
    scheduleSessionPersist();
  }
}

function updatePreferences(patch: Partial<Preferences>): void {
  const next = normalizePreferences({ ...preferences.value, ...patch });
  preferences.value = next;
  savePreferences(next);
  applyPreferences(next);
}

function requestImagePasteName(
  file: File,
  defaultName: string,
  format: ImageFormat,
  folder: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    imagePaste.value = {
      file,
      defaultName,
      extension: extensionForFormat(format),
      folder,
      resolve,
    };
  });
}

function focusActiveEditor(): void {
  if (viewMode.value === 'wysiwyg') {
    wysiwygPane.value?.focus();
  } else {
    editorPane.value?.refresh();
  }
}

function confirmImagePasteName(name: string): void {
  const pending = imagePaste.value;
  imagePaste.value = null;
  pending?.resolve(name);
  if (pending) focusActiveEditor();
}

function cancelImagePasteName(): void {
  const pending = imagePaste.value;
  imagePaste.value = null;
  pending?.resolve(null);
  if (pending) focusActiveEditor();
}

async function requestImageSave(
  file: File,
): Promise<ImageSaveResult | null> {
  if (imageRequestActive || closeInProgress || closeApproved) return null;
  const tab = activeTab.value;
  if (!tab || isImagePath(tab.path)) return null;
  if (imagePaste.value || prompt.value || confirmation.value) return null;

  imageRequestActive = true;
  const session = editorSession.value;
  try {
    const notePath = tab.path;
    const format = preferences.value.imageFormat;
    const folder = preferences.value.imageFolder.trim();
    const quality = preferences.value.imageQuality;
    const defaultName = renderImageName(
      preferences.value.imageNameTemplate,
      { notePath },
    );
    let stem = defaultName;

    if (preferences.value.imageConfirmPaste) {
      const useVim =
        preferences.value.vimEnabled && viewMode.value !== 'wysiwyg';
      let chosen: string | null = null;
      if (useVim) {
        chosen = editorPane.value
          ? await editorPane.value.promptImageName(
              defaultName,
              extensionForFormat(format),
            )
          : null;
      } else {
        chosen = await requestImagePasteName(
          file,
          defaultName,
          format,
          folder,
        );
      }
      if (chosen === null) return null;
      stem = sanitizeImageStem(stripImageExtension(chosen.trim()));
    }

    if (
      activeTab.value?.path !== notePath ||
      editorSession.value !== session ||
      closeInProgress ||
      closeApproved
    ) {
      return null;
    }

    const blob = await convertImageFile(file, format, quality);
    if (
      activeTab.value?.path !== notePath ||
      editorSession.value !== session ||
      closeInProgress ||
      closeApproved
    ) {
      return null;
    }

    const data = await blobToBase64(blob);
    const fileName = buildImageFileName(stem, format);
    const source = await api.saveImage(notePath, folder, fileName, data);
    window.setTimeout(() => {
      void refreshEntries().catch((err) => setError(err));
    }, 0);
    return {
      source: encodeMarkdownImagePath(source),
      alt: stem,
    };
  } catch (err) {
    if (err instanceof Error && err.message === 'IMAGE_FORMAT_UNSUPPORTED') {
      setError(t('imagePaste.unsupportedFormat'));
    } else if (err instanceof Error && err.message === 'IMAGE_TOO_LARGE') {
      setError(t('imagePaste.tooLarge'));
    } else if (
      err instanceof Error &&
      err.message === 'IMAGE_CONVERT_FAILED'
    ) {
      setError(t('imagePaste.convertFailed'));
    } else {
      setError(err);
    }
    return null;
  } finally {
    imageRequestActive = false;
  }
}

function clearSessionTimer(): void {
  if (sessionTimer) {
    window.clearTimeout(sessionTimer);
    sessionTimer = 0;
  }
}

function captureTabState(path: string | null = activePath.value): void {
  if (!path || path !== activePath.value || restoringTabPath === path) return;
  const tab = tabs.value.find((item) => item.path === path);
  if (!tab || isImagePath(tab.path) || viewMode.value === 'wysiwyg') return;
  const state = editorPane.value?.captureState();
  if (!state) return;
  const previous = tabStates.get(path);
  tabStates.set(path, {
    line: state.line,
    column: state.column,
    scrollTop:
      viewMode.value === 'preview' && previous
        ? previous.scrollTop
        : state.scrollTop,
  });
}

async function restoreTabState(path: string | null): Promise<void> {
  if (!path || viewMode.value === 'wysiwyg') return;
  const tab = tabs.value.find((item) => item.path === path);
  if (!tab || isImagePath(tab.path)) return;
  const state = tabStates.get(path);
  if (!state) return;
  const session = editorSession.value;
  restoringTabPath = path;
  try {
    await nextTick();
    if (activePath.value !== path || editorSession.value !== session) return;
    editorPane.value?.restoreState(state);
    tabStates.set(path, { ...state });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  } finally {
    if (restoringTabPath === path) restoringTabPath = null;
  }
}

function buildWorkspaceSession(): WorkspaceSession | null {
  if (!notesDir.value || !preferences.value.restoreSession) return null;
  captureTabState(activePath.value);
  return {
    version: 1,
    tabs: tabs.value.map((tab) => ({
      path: tab.path,
      ...(tabStates.get(tab.path) ?? { line: 1, column: 1, scrollTop: 0 }),
    })),
    activePath: activePath.value,
    previewPath: previewPath.value,
    viewMode: viewMode.value,
    expandedPaths: [...expandedPaths.value],
    activeView: activeView.value,
    sidebarVisible: sidebarVisible.value,
    savedAt: Date.now(),
  };
}

function persistSessionNow(): void {
  clearSessionTimer();
  if (sessionHydrating || !notesDir.value) return;
  const session = buildWorkspaceSession();
  if (!session) return;
  writeWorkspaceSession(notesDir.value, session);
  lastSessionPersistAt = Date.now();
}

function scheduleSessionPersist(): void {
  if (!preferences.value.restoreSession || sessionHydrating) return;
  if (Date.now() - lastSessionPersistAt >= SESSION_MAX_INTERVAL_MS) {
    persistSessionNow();
    return;
  }
  clearSessionTimer();
  sessionTimer = window.setTimeout(() => {
    sessionTimer = 0;
    persistSessionNow();
  }, SESSION_DEBOUNCE_MS);
}

function cancelAutoSave(path: string): void {
  const timer = autoSaveTimers.get(path);
  if (timer === undefined) return;
  window.clearTimeout(timer);
  autoSaveTimers.delete(path);
}

function cancelAllAutoSaveTimers(): void {
  for (const timer of autoSaveTimers.values()) {
    window.clearTimeout(timer);
  }
  autoSaveTimers.clear();
}

function forgetTab(path: string): void {
  cancelAutoSave(path);
  tabStates.delete(path);
  if (notesDir.value && !isImagePath(path)) {
    removeDraft(notesDir.value, path);
  }
}

function scheduleAutoSave(path: string): void {
  if (!preferences.value.autoSave) return;
  cancelAutoSave(path);
  autoSaveTimers.set(
    path,
    window.setTimeout(() => {
      autoSaveTimers.delete(path);
      void runAutoSave(path);
    }, preferences.value.autoSaveDelay),
  );
}

function scheduleAutoSaveForDirtyTabs(): void {
  if (!preferences.value.autoSave) return;
  for (const tab of tabs.value) {
    if (tab.content !== tab.savedContent) {
      scheduleAutoSave(tab.path);
    }
  }
}

async function runAutoSave(path: string): Promise<void> {
  if (!preferences.value.autoSave) return;
  const tab = tabs.value.find((item) => item.path === path);
  if (!tab || isImagePath(tab.path) || tab.content === tab.savedContent) {
    return;
  }
  if (prompt.value || confirmation.value || busy.value) {
    scheduleAutoSave(path);
    return;
  }

  const saved = await saveTab(tab);
  if (
    saved &&
    tab.content !== tab.savedContent &&
    preferences.value.autoSave
  ) {
    scheduleAutoSave(path);
  }
}

async function flushAutoSave(): Promise<void> {
  if (!preferences.value.autoSave) return;
  cancelAllAutoSaveTimers();
  await saveAllDirtyTabs();
}

function clearDraftTimer(): void {
  if (draftTimer) {
    window.clearTimeout(draftTimer);
    draftTimer = 0;
  }
}

function flushDrafts(): void {
  if (suppressDrafts) return;
  const dir = notesDir.value;
  if (!dir) return;
  clearDraftTimer();
  lastDraftFlushAt = Date.now();

  let list = readDraftList();
  let changed = false;
  for (const tab of tabs.value) {
    if (isImagePath(tab.path)) continue;
    const existing = list.find(
      (entry) => entry.notesDir === dir && entry.path === tab.path,
    );
    if (tab.content !== tab.savedContent) {
      if (existing?.content === tab.content) continue;
      const next = putDraftEntry(list, {
        notesDir: dir,
        path: tab.path,
        content: tab.content,
        updatedAt: Date.now(),
      });
      if (next !== list) {
        list = next;
        changed = true;
      }
    } else if (existing) {
      const next = removeDraftEntry(list, dir, tab.path);
      if (next !== list) {
        list = next;
        changed = true;
      }
    }
  }
  if (changed) writeDraftList(list);
}

function scheduleDraftFlush(): void {
  if (!notesDir.value) return;
  if (Date.now() - lastDraftFlushAt >= DRAFT_MAX_INTERVAL_MS) {
    flushDrafts();
    return;
  }
  clearDraftTimer();
  draftTimer = window.setTimeout(() => {
    draftTimer = 0;
    flushDrafts();
  }, DRAFT_IDLE_MS);
}

async function handleWindowBlur(): Promise<void> {
  if (sessionHydrating) return;
  captureTabState(activePath.value);
  persistSessionNow();
  await flushAutoSave();
  flushDrafts();
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    void handleWindowBlur();
  }
}

function handleBeforeUnload(): void {
  persistSessionNow();
  flushDrafts();
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

function handleSlowScrollWheel(event: WheelEvent): void {
  applySlowWheel(event);
}

function handleCursor(position: {
  line: number;
  column: number;
}): void {
  cursorLine.value = position.line;
  cursorColumn.value = position.column;
  cursorSyncTime = performance.now();
  previewFocusLine.value = position.line;
  captureTabState(activePath.value);
  scheduleSessionPersist();
}

function handleVimMode(mode: string | null): void {
  vimMode.value = mode;
}

async function setViewMode(mode: ViewMode): Promise<void> {
  if (viewMode.value === mode) return;
  const previousMode = viewMode.value;
  const leavingWysiwyg = previousMode === 'wysiwyg';
  const enteringWysiwyg = mode === 'wysiwyg';

  if (enteringWysiwyg) {
    const state = editorPane.value?.captureState() ?? null;
    const path = activeTab.value?.path;
    pendingEditorRestore.value =
      state && path ? { path, state } : null;
    if (state && path) tabStates.set(path, state);
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
    if (previousMode === 'preview') {
      await restoreTabState(activePath.value);
    }
  }
  scheduleSessionPersist();
}

function openSettings(): void {
  settingsOpen.value = true;
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

async function prepareForClose(): Promise<boolean> {
  const dirtyTabs = tabs.value.filter(
    (tab) => !isImagePath(tab.path) && tab.content !== tab.savedContent,
  );
  if (dirtyTabs.length === 0) return true;

  const shouldSave = preferences.value.autoSave
    ? true
    : await askConfirmation({
        title: t('close.windowUnsavedTitle'),
        message: t('close.windowUnsavedMessage', {
          count: dirtyTabs.length,
        }),
        confirmLabel: t('close.saveAndClose'),
        danger: false,
      });
  if (!shouldSave) return false;

  if (await saveAllDirtyTabs()) return true;
  if (await saveAllDirtyTabs()) return true;
  if (confirmation.value || prompt.value || imagePaste.value) return false;

  const closeAnyway = await askConfirmation({
    title: t('close.saveFailedTitle'),
    message: t('close.saveFailedMessage'),
    confirmLabel: t('close.closeAnyway'),
  });
  if (closeAnyway && notesDir.value) {
    clearWorkspaceDrafts(notesDir.value);
    suppressDrafts = true;
  }
  return closeAnyway;
}

async function handleCloseRequested(
  event: CloseRequestedEvent,
): Promise<void> {
  if (closeApproved) return;
  event.preventDefault();
  if (closeInProgress || confirmation.value || prompt.value || busy.value) {
    return;
  }
  if (imagePaste.value) {
    cancelImagePasteName();
  }

  closeInProgress = true;
  try {
    captureTabState(activePath.value);
    persistSessionNow();
    cancelAllAutoSaveTimers();
    await Promise.allSettled([...saveTasks.values()]);
    if (confirmation.value || prompt.value || imagePaste.value) {
      closeApproved = false;
      scheduleAutoSaveForDirtyTabs();
      return;
    }
    if (!(await prepareForClose())) {
      closeApproved = false;
      flushDrafts();
      scheduleAutoSaveForDirtyTabs();
      return;
    }
    closeApproved = true;
    await appWindow.close();
  } catch (err) {
    closeApproved = false;
    suppressDrafts = false;
    scheduleAutoSaveForDirtyTabs();
    setError(err);
  } finally {
    closeInProgress = false;
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
  if (!tab || isImagePath(tab.path) || exporting.value) return;

  exporting.value = true;
  clearFeedback();
  try {
    const preferencesValue = preferences.value;
    const commonOptions = {
      codeHighlight: preferencesValue.codeHighlight,
      codeTheme: preferencesValue.codeTheme,
    };
    if (format === 'pdf') {
      const prepared = await prepareExport(tab.path, tab.content, {
        ...commonOptions,
        embedImages: true,
        includeToc: preferencesValue.exportIncludeToc,
      });
      exportPreview.value = {
        format: 'pdf',
        title: prepared.title,
        html: prepared.documentHtml,
        warnings: prepared.warnings,
      };
      return;
    }
    if (format === 'html') {
      const [embedded, linked] = await Promise.all([
        prepareExport(tab.path, tab.content, {
          ...commonOptions,
          embedImages: true,
          includeToc: preferencesValue.exportIncludeToc,
        }),
        prepareExport(tab.path, tab.content, {
          ...commonOptions,
          embedImages: false,
          includeToc: preferencesValue.exportIncludeToc,
        }),
      ]);
      htmlExport.value = {
        title: embedded.title,
        embedded,
        linked,
        embeddedBytes: new TextEncoder().encode(
          embedded.documentHtml,
        ).length,
        linkedBytes: new TextEncoder().encode(
          linked.documentHtml,
        ).length,
        warnings: [...new Set(embedded.warnings)],
      };
      return;
    }

    const prepared = await prepareExport(tab.path, tab.content, {
      ...commonOptions,
      embedImages: true,
      includeToc: false,
    });
    exportPreview.value = {
      format: 'docx',
      title: prepared.title,
      html: buildDocxPreviewDocument(
        prepared,
        preferencesValue.exportIncludeToc,
        preferencesValue.codeTheme,
      ),
      warnings: prepared.warnings,
      docxPrepared: markRaw(prepared),
      docxOptions: {
        codeTheme: preferencesValue.codeTheme,
        includeToc: preferencesValue.exportIncludeToc,
      },
    };
  } catch (err) {
    setError(err);
  } finally {
    exporting.value = false;
  }
}

async function savePreviewDocx(): Promise<void> {
  const current = exportPreview.value;
  if (
    !current ||
    current.format !== 'docx' ||
    !current.docxPrepared ||
    !current.docxOptions ||
    exporting.value
  ) {
    return;
  }

  exporting.value = true;
  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    const base64 =
      current.docxBase64 ??
      (await buildDocxBase64(
        current.docxPrepared,
        current.docxOptions,
      ));
    if (!base64) return;
    current.docxBase64 = base64;
    const path = await saveDocxBase64(current.title, base64);
    if (!path) return;
    exportPreview.value = null;
    if (preferences.value.exportOpenAfter) {
      await openExportedFile(path);
    }
  } catch (err) {
    setError(err);
  } finally {
    exporting.value = false;
  }
}

async function saveHtml(
  embedded: boolean,
): Promise<void> {
  const current = htmlExport.value;
  if (!current || exporting.value) return;

  exporting.value = true;
  try {
    const prepared = embedded ? current.embedded : current.linked;
    const path = await saveHtmlExport(prepared, {
      defaultDirectory:
        embedded ? undefined : notesDir.value ?? undefined,
    });
    if (!path) return;
    htmlExport.value = null;
    if (preferences.value.exportOpenAfter) {
      await openExportedFile(path);
    }
  } catch (err) {
    setError(err);
  } finally {
    exporting.value = false;
  }
}

async function openExportedFile(path: string): Promise<void> {
  try {
    await openPath(path);
  } catch (err) {
    setError(err);
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

  for (const tab of stale) {
    forgetTab(tab.path);
  }

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
  if (!activeRemoved) {
    scheduleSessionPersist();
    return;
  }

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
  if (fallback) {
    void restoreTabState(fallback.path);
  }
  scheduleSessionPersist();
}

async function openNote(path: string): Promise<boolean> {
  if (isImagePath(path)) {
    openImagePinned(path);
    return true;
  }

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

function firstNotePath(list: FileEntry[]): string | null {
  return (
    flattenFiles(list).find((entry) => !isImagePath(entry.path))?.path ?? null
  );
}

async function restoreWorkspaceSession(state: NotesState): Promise<boolean> {
  const dir = state.notesDir;
  if (!dir) return false;

  const files = new Set(
    state.entries
      .filter((entry) => !entry.isDir)
      .map((entry) => entry.path),
  );
  const dirs = new Set(
    state.entries.filter((entry) => entry.isDir).map((entry) => entry.path),
  );
  const snapshot = preferences.value.restoreSession
    ? readWorkspaceSession(dir)
    : null;
  const pruned = snapshot
    ? pruneWorkspaceSession(snapshot, files, dirs)
    : null;
  const sessionTabs = pruned?.tabs ?? [];

  const drafts = new Map<string, DraftEntry>();
  for (const draft of readDraftsForWorkspace(dir)) {
    if (!files.has(draft.path) || isImagePath(draft.path)) {
      removeDraft(dir, draft.path);
      continue;
    }
    drafts.set(draft.path, draft);
  }

  const sessionPaths = new Set(sessionTabs.map((tab) => tab.path));
  const orphanPaths = [...drafts.keys()]
    .filter((path) => !sessionPaths.has(path))
    .sort();
  const notePaths = [
    ...sessionTabs
      .filter((tab) => !isImagePath(tab.path))
      .map((tab) => tab.path),
    ...orphanPaths,
  ];
  const results = await Promise.allSettled(
    notePaths.map((path) => api.readNote(path)),
  );
  const contents = new Map<string, string>();
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      contents.set(notePaths[index], result.value.content);
    }
  });

  let recovered = 0;
  const restoredTabs: NoteTab[] = [];
  for (const tab of sessionTabs) {
    const image = isImagePath(tab.path);
    const diskContent = image ? '' : contents.get(tab.path);
    if (!image && diskContent === undefined) continue;
    let content = diskContent ?? '';
    if (!image) {
      const draft = drafts.get(tab.path);
      if (draft) {
        if (draft.content === diskContent) {
          removeDraft(dir, tab.path);
        } else {
          content = draft.content;
          recovered += 1;
        }
      }
    }
    restoredTabs.push({
      path: tab.path,
      content,
      savedContent: diskContent ?? '',
    });
  }

  for (const path of orphanPaths) {
    const diskContent = contents.get(path);
    const draft = drafts.get(path);
    if (diskContent === undefined || !draft) continue;
    if (draft.content === diskContent) {
      removeDraft(dir, path);
      continue;
    }
    restoredTabs.push({
      path,
      content: draft.content,
      savedContent: diskContent,
    });
    recovered += 1;
  }
  if (restoredTabs.length === 0) return false;

  const paths = new Set(restoredTabs.map((tab) => tab.path));
  const dirtyPaths = new Set(
    restoredTabs
      .filter((tab) => tab.content !== tab.savedContent)
      .map((tab) => tab.path),
  );
  const active =
    pruned?.activePath && paths.has(pruned.activePath)
      ? pruned.activePath
      : restoredTabs[0].path;
  const preview =
    pruned?.previewPath &&
    paths.has(pruned.previewPath) &&
    !dirtyPaths.has(pruned.previewPath)
      ? pruned.previewPath
      : null;

  tabs.value = restoredTabs;
  activePath.value = active;
  previewPath.value = preview;
  viewMode.value = pruned?.viewMode ?? 'source';
  expandedPaths.value = [
    ...new Set([...(pruned?.expandedPaths ?? []), ...ancestorDirs(active)]),
  ];
  activeView.value = pruned?.activeView ?? 'explorer';
  sidebarVisible.value = pruned?.sidebarVisible ?? true;

  tabStates.clear();
  for (const tab of restoredTabs) {
    if (isImagePath(tab.path)) continue;
    const saved = sessionTabs.find((item) => item.path === tab.path);
    if (saved) {
      tabStates.set(tab.path, {
        line: saved.line,
        column: saved.column,
        scrollTop: saved.scrollTop,
      });
    }
  }

  editorSession.value += 1;
  editorScrollRatio.value = 0;
  previewFocusLine.value = 1;
  cursorLine.value = null;
  cursorColumn.value = null;
  revealPath(active);

  await nextTick();
  await restoreTabState(active);

  if (recovered > 0) {
    warning.value = t('draft.recovered', { count: recovered });
  }
  return true;
}

function openImagePreview(path: string): void {
  const existing = tabs.value.find((tab) => tab.path === path);
  if (existing) {
    activateTab(path);
    return;
  }

  const previewIndex = previewPath.value
    ? tabs.value.findIndex((tab) => tab.path === previewPath.value)
    : -1;
  const previewTab = previewIndex >= 0 ? tabs.value[previewIndex] : null;
  const replaceable =
    previewTab !== null && previewTab.content === previewTab.savedContent;
  const next: NoteTab = { path, content: '', savedContent: '' };

  if (replaceable && previewIndex >= 0) {
    forgetTab(tabs.value[previewIndex].path);
    tabs.value.splice(previewIndex, 1, next);
  } else {
    tabs.value.push(next);
  }
  previewPath.value = path;
  activateTab(path);
}

function openImagePinned(path: string): void {
  const existing = tabs.value.find((tab) => tab.path === path);
  if (existing) {
    if (previewPath.value === path) previewPath.value = null;
    activateTab(path);
    return;
  }

  tabs.value.push({ path, content: '', savedContent: '' });
  if (previewPath.value === path) previewPath.value = null;
  activateTab(path);
}

async function activateTab(path: string): Promise<void> {
  if (!tabs.value.some((tab) => tab.path === path)) return;
  if (activePath.value === path) {
    revealPath(path);
    return;
  }
  captureTabState(activePath.value);
  activePath.value = path;
  editorSession.value += 1;
  editorScrollRatio.value = 0;
  previewFocusLine.value = 1;
  cursorLine.value = null;
  cursorColumn.value = null;
  clearFeedback();
  revealPath(path);
  scheduleSessionPersist();
  await restoreTabState(path);
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
  if (!tab || isImagePath(tab.path)) return;
  tab.content = value;
  if (
    previewPath.value === tab.path &&
    tab.content !== tab.savedContent
  ) {
    previewPath.value = null;
  }
  suppressDrafts = false;
  scheduleAutoSave(tab.path);
  scheduleDraftFlush();
}

function handleEditorScroll(position: { line: number; ratio: number }): void {
  if (performance.now() < previewScrollLock) return;
  editorScrollRatio.value = position.ratio;
  if (performance.now() - cursorSyncTime > 150) {
    previewFocusLine.value = position.line;
  }
  captureTabState(activePath.value);
  scheduleSessionPersist();
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
  const path = tab.path;
  const dir = notesDir.value;
  const pending = saveTasks.get(path);
  if (pending) return pending;
  if (tab.content === tab.savedContent) return true;

  const snapshot = tab.content;
  markSaving(path, true);

  const task = (async (): Promise<boolean> => {
    try {
      await api.saveNote(path, snapshot);
      if (tab.content === snapshot) {
        tab.savedContent = snapshot;
      }
      if (dir && !isImagePath(path)) {
        if (tab.content === snapshot) {
          removeDraft(dir, path);
        } else {
          writeDraft(dir, path, tab.content, Date.now());
        }
      }
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      saveTasks.delete(path);
      markSaving(path, false);
    }
  })();

  saveTasks.set(path, task);
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
      forgetTab(tabs.value[previewIndex].path);
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

  if (isImagePath(path)) {
    openImagePreview(path);
    return;
  }

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
  if (isImagePath(path)) {
    openImagePinned(path);
    return;
  }

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

    captureTabState(activePath.value);
    persistSessionNow();

    sessionHydrating = true;
    switching.value = true;
    try {
      const state = await api.chooseNotesDir(path);
      resetTabs();
      expandedPaths.value = [];
      applyState(state);

      let restored = false;
      try {
        restored = await restoreWorkspaceSession(state);
      } catch {
        restored = false;
      }
      if (!restored) {
        const first = firstNotePath(state.entries);
        if (first) {
          await openNote(first);
        }
      }
    } finally {
      sessionHydrating = false;
      switching.value = false;
      scheduleSessionPersist();
    }
  } catch (err) {
    setError(err);
  }
}

function resetTabs(): void {
  cancelImagePasteName();
  cancelAllAutoSaveTimers();
  clearDraftTimer();
  clearSessionTimer();
  tabStates.clear();
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
    title: t('prompt.newFile.title'),
    label: t('prompt.fileName'),
    initialValue: t('prompt.newFile.initial'),
    confirmLabel: t('action.create'),
    placeholder: t('prompt.newFile.placeholder'),
    submit: async (name) => {
      if (mutating.value || switching.value) {
        throw new Error(t('app.retryLater'));
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
    title: t('prompt.newFolder.title'),
    label: t('prompt.folderName'),
    initialValue: '',
    confirmLabel: t('action.create'),
    placeholder: t('prompt.newFolder.placeholder'),
    submit: async (name) => {
      if (mutating.value || switching.value) {
        throw new Error(t('app.retryLater'));
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
  const image = !entry.isDir && isImagePath(entry.path);
  openPrompt({
    title: entry.isDir
      ? t('prompt.renameFolder.title')
      : image
        ? t('prompt.renameImage.title')
        : t('prompt.renameFile.title'),
    label: t('prompt.newName'),
    initialValue: entry.name,
    confirmLabel: t('action.rename'),
    placeholder: entry.isDir
      ? t('prompt.renameFolder.placeholder')
      : image
        ? t('prompt.renameImage.placeholder')
        : t('prompt.renameFile.placeholder'),
    submit: async (name) => {
      if (mutating.value || switching.value || anySaving.value) {
        throw new Error(t('app.retryLater'));
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
        const movedStates: [string, EditorTabState][] = [];
        for (const [statePath, state] of tabStates) {
          const nextPath = replacePrefix(statePath, entry.path, newPath);
          if (nextPath === statePath) continue;
          tabStates.delete(statePath);
          movedStates.push([nextPath, state]);
        }
        for (const [statePath, state] of movedStates) {
          tabStates.set(statePath, state);
        }
        cancelAllAutoSaveTimers();
        if (notesDir.value) {
          renameDrafts(notesDir.value, entry.path, newPath);
        }
        for (const tab of tabs.value) {
          if (tab.content !== tab.savedContent) {
            scheduleAutoSave(tab.path);
          }
        }
        await refreshEntries();
        revealPath(newPath);
        scheduleSessionPersist();
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
  const warning = hasDirtyTab ? t('delete.warning') : '';
  const confirmed = await askConfirmation({
    title: entry.isDir ? t('delete.folderTitle') : t('delete.fileTitle'),
    message: (
      entry.isDir
        ? t('delete.folderMessage', {
            name: entry.name,
            warning,
          })
        : t('delete.fileMessage', {
            name: entry.name,
            warning,
          })
    ).trim(),
    confirmLabel: t('delete.confirm'),
  });
  if (!confirmed || busy.value || anySaving.value) return;

  mutating.value = true;
  clearFeedback();
  try {
    const activeWasAffected =
      activePath.value !== null &&
      isSameOrDescendant(activePath.value, entry.path);
    await api.deleteEntry(entry.path);
    if (notesDir.value) {
      removeDraftsUnder(notesDir.value, entry.path);
    }
    for (const path of [...tabStates.keys()]) {
      if (isSameOrDescendant(path, entry.path)) {
        forgetTab(path);
      }
    }
    await refreshEntries();
    scheduleSessionPersist();

    if (activeWasAffected && tabs.value.length === 0) {
      const next = firstNotePath(entries.value);
      if (next) {
        await openNote(next);
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

  if (tab.content !== tab.savedContent && preferences.value.autoSave) {
    if (!(await saveTab(tab))) return;
  }

  if (tab.content !== tab.savedContent) {
    const confirmed = await askConfirmation({
      title: t('close.unsavedTitle'),
      message: t('close.unsavedMessage', {
        name: basename(tab.path),
      }),
      confirmLabel: t('close.discard'),
    });
    if (!confirmed) return;
  }

  const index = tabs.value.findIndex((item) => item.path === path);
  if (index === -1) return;
  forgetTab(path);

  const wasActive = activePath.value === path;
  tabs.value.splice(index, 1);
  if (previewPath.value === path) previewPath.value = null;

  if (!wasActive) {
    scheduleSessionPersist();
    return;
  }
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
  if (next) {
    void restoreTabState(next.path);
  }
  scheduleSessionPersist();
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
  warning.value = '';
}

function setError(err: unknown): void {
  error.value = errorMessage(err);
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return localizeError(message);
}

watch(
  () => [
    tabs.value.map((tab) => tab.path).join('\u0000'),
    activePath.value,
    previewPath.value,
    viewMode.value,
    expandedPaths.value.join('\u0000'),
    activeView.value,
    sidebarVisible.value,
  ],
  () => scheduleSessionPersist(),
);

watch(
  () => [
    preferences.value.autoSave,
    preferences.value.autoSaveDelay,
    preferences.value.restoreSession,
  ],
  ([autoSave, delay, restoreSession], previous) => {
    if (!autoSave) {
      cancelAllAutoSaveTimers();
      scheduleDraftFlush();
    } else if (previous?.[0] !== true || previous?.[1] !== delay) {
      cancelAllAutoSaveTimers();
      for (const tab of tabs.value) {
        if (tab.content !== tab.savedContent) {
          scheduleAutoSave(tab.path);
        }
      }
    }
    if (!restoreSession) {
      clearSessionTimer();
    } else if (previous?.[2] === false) {
      scheduleSessionPersist();
    }
  },
);
</script>

<template>
  <div
    class="app-shell"
    :class="{
      'sidebar-hidden': !sidebarVisible,
      'resizing-sidebar': resizingSidebar,
    }"
    :style="{ '--sidebar-width': `${sidebarWidth}px` }"
  >
    <header
      class="titlebar"
      @pointerdown="onTitlebarPointerDown"
      @dblclick="onTitlebarDoubleClick"
    >
      <div class="titlebar-left">
        <span v-if="sidebarVisible" class="titlebar-title">
          {{ activeView === 'search' ? t('nav.search') : t('nav.explorer') }}
        </span>
      </div>

      <div class="titlebar-main">
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
            :title="t('window.minimize')"
            :aria-label="t('window.minimize')"
            @click="minimizeWindow"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
          <button
            type="button"
            class="window-control"
            :title="isMaximized ? t('window.restore') : t('window.maximize')"
            :aria-label="
              isMaximized ? t('window.restore') : t('window.maximize')
            "
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
            :title="t('window.close')"
            :aria-label="t('window.close')"
            @click="closeWindow"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
          </div>
        </div>
      </div>
    </header>

    <ActivityRail
      :active-view="activeView"
      :sidebar-visible="sidebarVisible"
      @select-explorer="selectExplorer"
      @select-search="selectSearch"
      @open-settings="openSettings"
    />

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

    <div
      v-if="sidebarVisible"
      class="sidebar-resizer"
      role="separator"
      aria-orientation="vertical"
      :aria-valuenow="sidebarWidth"
      :aria-valuemin="MIN_SIDEBAR_WIDTH"
      :aria-valuemax="MAX_SIDEBAR_WIDTH"
      :aria-label="
        t('app.sidebar.resizeAria', { width: sidebarWidth })
      "
      tabindex="0"
      :title="t('app.sidebar.resizeTitle')"
      @pointerdown="startSidebarResize"
      @keydown="onSidebarResizerKeydown"
      @dblclick="resetSidebarWidth"
    ></div>

    <main v-if="notesDir === null" class="workspace welcome">
      <div class="welcome-card">
        <span class="welcome-icon"><InkerMark /></span>
        <h1>Inker</h1>
        <p>{{ t('app.welcome.description') }}</p>
        <button class="btn primary" type="button" @click="chooseFolder">
          {{ t('app.welcome.chooseFolder') }}
        </button>
        <p v-if="error" class="welcome-error">{{ error }}</p>
      </div>
    </main>

    <main v-else class="workspace">
      <div v-if="error" class="banner" role="alert">
        <span>{{ error }}</span>
        <button
          type="button"
          :aria-label="t('app.error.dismiss')"
          @click="error = ''"
        >
          ×
        </button>
      </div>
      <div v-if="warning" class="banner warning" role="status">
        <span>{{ warning }}</span>
        <button
          type="button"
          :aria-label="t('app.error.dismiss')"
          @click="warning = ''"
        >
          ×
        </button>
      </div>

      <template v-if="activeTab">
        <ImagePane
          v-if="activeImagePath"
          :key="activeImagePath"
          :path="activeImagePath"
        />

        <WysiwygPane
          v-else-if="viewMode === 'wysiwyg'"
          ref="wysiwygPane"
          :key="editorSession"
          :initial-content="activeTab.content"
          :note-path="activeTab.path"
          :read-only="switching || mutating"
          :immersive="immersiveEnabled"
          :code-highlight="preferences.codeHighlight"
          :request-image-save="requestImageSave"
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
              :source-highlight="preferences.sourceHighlight"
              :request-image-save="requestImageSave"
              :vim-mappings="preferences.vimMappings"
              @change="handleContentChange"
              @scroll-sync="handleEditorScroll"
              @cursor="handleCursor"
              @vim-mode="handleVimMode"
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
            :title="t('app.splitter.title')"
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
        <span class="workspace-empty-icon"><InkerMark /></span>
        <h1>{{ t('app.empty.title') }}</h1>
        <p>{{ t('app.empty.description') }}</p>
      </div>
    </main>

    <SettingsOverlay
      v-if="settingsOpen"
      :preferences="preferences"
      :maximized="isMaximized"
      @update="updatePreferences"
      @close="settingsOpen = false"
      @minimize="minimizeWindow"
      @maximize="toggleMaximizeWindow"
    />

    <StatusBar
      :line="
        activeTab && !activeImagePath && viewMode !== 'wysiwyg'
          ? cursorLine
          : null
      "
      :column="
        activeTab && !activeImagePath && viewMode !== 'wysiwyg'
          ? cursorColumn
          : null
      "
      :mode="viewMode"
      :vim-enabled="
        vimEnabled && !activeImagePath && viewMode !== 'wysiwyg'
      "
      :vim-mode="vimMode"
      :line-ending="activeImagePath ? t('app.status.image') : lineEnding"
      :immersive="immersiveEnabled"
      :save-state="saveState"
      @mode-change="setViewMode"
      @immersive-toggle="toggleImmersive"
    />

    <ImagePasteDialog
      v-if="imagePaste"
      :file="imagePaste.file"
      :default-name="imagePaste.defaultName"
      :extension="imagePaste.extension"
      :folder="imagePaste.folder"
      @confirm="confirmImagePasteName"
      @cancel="cancelImagePasteName"
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

    <ExportPreviewDialog
      v-if="exportPreview"
      :format="exportPreview.format"
      :title="exportPreview.title"
      :html="exportPreview.html"
      :warnings="exportPreview.warnings"
      :busy="exporting"
      @save="savePreviewDocx"
      @close="exportPreview = null"
    />

    <HtmlExportDialog
      v-if="htmlExport"
      :title="htmlExport.title"
      :embedded-html="htmlExport.embedded.documentHtml"
      :initial-embedded="preferences.exportEmbedImages"
      :embedded-bytes="htmlExport.embeddedBytes"
      :linked-bytes="htmlExport.linkedBytes"
      :warnings="htmlExport.warnings"
      :busy="exporting"
      @save="saveHtml"
      @close="htmlExport = null"
    />
  </div>
</template>
