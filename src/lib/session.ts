import { VIEW_MODES, type ViewMode } from './viewModes';

export interface SessionTabState {
  path: string;
  line: number;
  column: number;
  scrollTop: number;
}

export type SessionActiveView = 'explorer' | 'search';

export interface WorkspaceSession {
  version: 1;
  tabs: SessionTabState[];
  activePath: string | null;
  previewPath: string | null;
  viewMode: ViewMode;
  expandedPaths: string[];
  activeView: SessionActiveView;
  sidebarVisible: boolean;
  savedAt: number;
}

export const SESSION_STORAGE_KEY = 'inker-session-v1';
export const MAX_SESSION_TABS = 50;
export const MAX_SESSION_WORKSPACES = 10;

const VIEW_MODE_IDS = new Set<string>(VIEW_MODES.map((mode) => mode.id));
const MAX_SESSION_PATH_LENGTH = 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSafeSessionPath(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_SESSION_PATH_LENGTH ||
    value.startsWith('/') ||
    value.includes('\\')
  ) {
    return false;
  }
  return value
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function positiveInteger(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.round(number)) : 1;
}

function nonNegativeInteger(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

export function normalizeWorkspaceSession(
  value: unknown,
): WorkspaceSession | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.tabs)) {
    return null;
  }

  const seen = new Set<string>();
  const tabs: SessionTabState[] = [];
  for (const item of value.tabs) {
    if (tabs.length >= MAX_SESSION_TABS) break;
    if (!isRecord(item) || !isSafeSessionPath(item.path)) {
      continue;
    }
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    tabs.push({
      path: item.path,
      line: positiveInteger(item.line),
      column: positiveInteger(item.column),
      scrollTop: nonNegativeInteger(item.scrollTop),
    });
  }
  if (tabs.length === 0) return null;

  const tabPaths = new Set(tabs.map((tab) => tab.path));
  const viewMode =
    typeof value.viewMode === 'string' && VIEW_MODE_IDS.has(value.viewMode)
      ? (value.viewMode as ViewMode)
      : 'source';
  const expandedPaths = Array.isArray(value.expandedPaths)
    ? [
        ...new Set(
          value.expandedPaths.filter(isSafeSessionPath),
        ),
      ]
    : [];

  return {
    version: 1,
    tabs,
    activePath:
      typeof value.activePath === 'string' && tabPaths.has(value.activePath)
        ? value.activePath
        : null,
    previewPath:
      typeof value.previewPath === 'string' && tabPaths.has(value.previewPath)
        ? value.previewPath
        : null,
    viewMode,
    expandedPaths,
    activeView: value.activeView === 'search' ? 'search' : 'explorer',
    sidebarVisible:
      typeof value.sidebarVisible === 'boolean' ? value.sidebarVisible : true,
    savedAt: Number.isFinite(Number(value.savedAt)) ? Number(value.savedAt) : 0,
  };
}

export function pruneWorkspaceSession(
  session: WorkspaceSession,
  availableFiles: ReadonlySet<string>,
  availableDirs: ReadonlySet<string>,
): WorkspaceSession | null {
  const tabs = session.tabs.filter((tab) => availableFiles.has(tab.path));
  if (tabs.length === 0) return null;

  const tabPaths = new Set(tabs.map((tab) => tab.path));
  return {
    ...session,
    tabs,
    activePath:
      session.activePath && tabPaths.has(session.activePath)
        ? session.activePath
        : tabs[0].path,
    previewPath:
      session.previewPath && tabPaths.has(session.previewPath)
        ? session.previewPath
        : null,
    expandedPaths: session.expandedPaths.filter((path) =>
      availableDirs.has(path),
    ),
  };
}

export function readSessionMap(): Record<string, WorkspaceSession> {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    const map: Record<string, WorkspaceSession> = {};
    for (const [notesDir, value] of Object.entries(parsed)) {
      const session = normalizeWorkspaceSession(value);
      if (session) map[notesDir] = session;
    }
    return map;
  } catch {
    return {};
  }
}

export function readWorkspaceSession(
  notesDir: string,
): WorkspaceSession | null {
  return readSessionMap()[notesDir] ?? null;
}

export function writeWorkspaceSession(
  notesDir: string,
  session: WorkspaceSession,
): void {
  try {
    const map = readSessionMap();
    map[notesDir] = { ...session, savedAt: Date.now() };
    const recent = Object.entries(map)
      .sort(([, left], [, right]) => right.savedAt - left.savedAt)
      .slice(0, MAX_SESSION_WORKSPACES);
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(recent)),
    );
  } catch {
    // Persisting the session is optional.
  }
}

export function removeWorkspaceSession(notesDir: string): void {
  try {
    const map = readSessionMap();
    if (!(notesDir in map)) return;
    delete map[notesDir];
    if (Object.keys(map).length === 0) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Removing the session is optional.
  }
}
