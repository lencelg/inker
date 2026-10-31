import { readSessionMap } from './session';

export interface RecentWorkspace {
  path: string;
  name: string;
  openedAt: number;
}

export const RECENT_WORKSPACES_STORAGE_KEY =
  'inker-recent-workspaces-v1';
export const MAX_RECENT_WORKSPACES = 10;

const MAX_PATH_LENGTH = 4096;
const MAX_NAME_LENGTH = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function workspaceDisplayName(path: string): string {
  const value = path.replace(/[\\/]+$/, '');
  const index = Math.max(
    value.lastIndexOf('/'),
    value.lastIndexOf('\\'),
  );
  const name = index >= 0 ? value.slice(index + 1) : value;
  return name || path;
}

export function normalizeRecentWorkspaces(
  value: unknown,
): RecentWorkspace[] {
  if (!Array.isArray(value)) return [];
  const byPath = new Map<string, RecentWorkspace>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (typeof item.path !== 'string') continue;
    const path = item.path.trim();
    if (
      !path ||
      path.includes('\0') ||
      path.length > MAX_PATH_LENGTH
    ) {
      continue;
    }
    const rawName =
      typeof item.name === 'string' ? item.name.trim() : '';
    const openedAt = Number(item.openedAt);
    const entry: RecentWorkspace = {
      path,
      name: (rawName || workspaceDisplayName(path)).slice(
        0,
        MAX_NAME_LENGTH,
      ),
      openedAt: Number.isFinite(openedAt)
        ? Math.max(0, Math.round(openedAt))
        : 0,
    };
    const existing = byPath.get(path);
    if (!existing || entry.openedAt > existing.openedAt) {
      byPath.set(path, entry);
    }
  }
  return [...byPath.values()]
    .sort((left, right) => right.openedAt - left.openedAt)
    .slice(0, MAX_RECENT_WORKSPACES);
}

export function recordRecentWorkspace(
  list: readonly RecentWorkspace[],
  path: string,
  openedAt = Date.now(),
): RecentWorkspace[] {
  const value = path.trim();
  if (!value) return [...list];
  const entry: RecentWorkspace = {
    path: value,
    name: workspaceDisplayName(value),
    openedAt,
  };
  return [
    entry,
    ...list.filter((workspace) => workspace.path !== value),
  ].slice(0, MAX_RECENT_WORKSPACES);
}

export function readRecentWorkspaces(): RecentWorkspace[] {
  try {
    const raw = window.localStorage.getItem(
      RECENT_WORKSPACES_STORAGE_KEY,
    );
    if (!raw) return [];
    return normalizeRecentWorkspaces(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeRecentWorkspaces(
  list: readonly RecentWorkspace[],
): void {
  try {
    window.localStorage.setItem(
      RECENT_WORKSPACES_STORAGE_KEY,
      JSON.stringify(list),
    );
  } catch {
    // Recent workspaces are a convenience; storage may be unavailable.
  }
}

/**
 * Seeds the launcher from the previous session snapshots and the folder stored
 * by the backend, then persists the merged list.
 */
export function seedRecentWorkspaces(
  currentDir: string | null,
  now = Date.now(),
): RecentWorkspace[] {
  let list = readRecentWorkspaces();
  const sessions = Object.entries(readSessionMap()).sort(
    (left, right) => left[1].savedAt - right[1].savedAt,
  );
  for (const [dir, session] of sessions) {
    list = recordRecentWorkspace(list, dir, session.savedAt);
  }
  if (currentDir) {
    list = recordRecentWorkspace(list, currentDir, now);
  }
  const normalized = normalizeRecentWorkspaces(list);
  writeRecentWorkspaces(normalized);
  return normalized;
}
