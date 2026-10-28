export const RECENT_FILES_STORAGE_KEY = 'inker-recent-files-v1';
export const MAX_RECENT_FILES = 20;
export const MAX_RECENT_WORKSPACES = 10;

export type RecentFilesMap = Record<string, string[]>;

export function normalizeRecentFiles(value: unknown): RecentFilesMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: RecentFilesMap = {};
  for (const [workspace, raw] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (!workspace || !Array.isArray(raw)) continue;
    const files: string[] = [];
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      const path = item.trim();
      if (!path || path.includes('\0') || files.includes(path)) {
        continue;
      }
      files.push(path);
      if (files.length >= MAX_RECENT_FILES) break;
    }
    result[workspace] = files;
  }

  const keys = Object.keys(result);
  if (keys.length <= MAX_RECENT_WORKSPACES) return result;
  return Object.fromEntries(
    keys
      .slice(-MAX_RECENT_WORKSPACES)
      .map((key) => [key, result[key]]),
  );
}

export function recentFilesForWorkspace(
  map: RecentFilesMap,
  notesDir: string | null,
): string[] {
  const workspace = notesDir?.trim();
  if (!workspace) return [];
  return map[workspace] ?? [];
}

export function recordRecentFile(
  map: RecentFilesMap,
  notesDir: string | null,
  path: string,
): RecentFilesMap {
  const workspace = notesDir?.trim();
  const value = path.trim();
  if (!workspace || !value) return map;

  const files = [
    value,
    ...(map[workspace] ?? []).filter((item) => item !== value),
  ].slice(0, MAX_RECENT_FILES);
  const next: RecentFilesMap = { ...map, [workspace]: files };
  const keys = Object.keys(next).filter((key) => key !== workspace);
  keys.push(workspace);
  return Object.fromEntries(
    keys
      .slice(-MAX_RECENT_WORKSPACES)
      .map((key) => [key, next[key]]),
  );
}

export function readRecentFilesMap(): RecentFilesMap {
  try {
    const raw = window.localStorage.getItem(RECENT_FILES_STORAGE_KEY);
    if (!raw) return {};
    return normalizeRecentFiles(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeRecentFilesMap(map: RecentFilesMap): void {
  try {
    window.localStorage.setItem(
      RECENT_FILES_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    // Recent files are a convenience; storage may be unavailable.
  }
}
