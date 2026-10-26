import { isSameOrDescendant, replacePrefix } from './paths';
import { isSafeSessionPath } from './session';

export interface DraftEntry {
  notesDir: string;
  path: string;
  content: string;
  updatedAt: number;
}

export const DRAFTS_STORAGE_KEY = 'inker-drafts-v1';
export const MAX_DRAFT_BYTES = 256 * 1024;
export const MAX_DRAFT_TOTAL_BYTES = 2 * 1024 * 1024;
export const MAX_DRAFTS = 20;

function draftKey(notesDir: string, path: string): string {
  return `${notesDir}\u0000${path}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function draftByteLength(content: string): number {
  if (typeof TextEncoder === 'undefined') {
    return content.length * 2;
  }
  return new TextEncoder().encode(content).length;
}

function isValidDraft(value: unknown): value is DraftEntry {
  if (!isRecord(value)) return false;
  if (typeof value.notesDir !== 'string' || value.notesDir === '') {
    return false;
  }
  if (!isSafeSessionPath(value.path)) return false;
  if (typeof value.content !== 'string') return false;
  if (!Number.isFinite(value.updatedAt)) return false;
  return draftByteLength(value.content) <= MAX_DRAFT_BYTES;
}

export function normalizeDraftList(value: unknown): DraftEntry[] {
  if (!Array.isArray(value)) return [];

  const byPath = new Map<string, DraftEntry>();
  for (const item of value) {
    if (!isValidDraft(item)) continue;
    const entry: DraftEntry = {
      notesDir: item.notesDir,
      path: item.path,
      content: item.content,
      updatedAt: Number(item.updatedAt),
    };
    const key = draftKey(entry.notesDir, entry.path);
    const existing = byPath.get(key);
    if (!existing || existing.updatedAt < entry.updatedAt) {
      byPath.set(key, entry);
    }
  }
  return [...byPath.values()];
}

export function pruneDraftList(list: DraftEntry[]): DraftEntry[] {
  const sorted = [...list].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
  const kept: DraftEntry[] = [];
  let totalBytes = 0;

  for (const entry of sorted) {
    if (kept.length >= MAX_DRAFTS) break;
    const bytes = draftByteLength(entry.content);
    if (bytes > MAX_DRAFT_BYTES) continue;
    if (totalBytes + bytes > MAX_DRAFT_TOTAL_BYTES) continue;
    kept.push(entry);
    totalBytes += bytes;
  }
  return kept;
}

export function putDraftEntry(
  list: DraftEntry[],
  entry: DraftEntry,
): DraftEntry[] {
  if (
    entry.notesDir === '' ||
    !isSafeSessionPath(entry.path) ||
    !Number.isFinite(entry.updatedAt)
  ) {
    return list;
  }

  const key = draftKey(entry.notesDir, entry.path);
  if (draftByteLength(entry.content) > MAX_DRAFT_BYTES) {
    const next = list.filter(
      (item) => draftKey(item.notesDir, item.path) !== key,
    );
    return next.length === list.length ? list : next;
  }

  const next = list.filter(
    (item) => draftKey(item.notesDir, item.path) !== key,
  );
  next.push({ ...entry, updatedAt: Number(entry.updatedAt) });
  return pruneDraftList(next);
}

export function removeDraftEntry(
  list: DraftEntry[],
  notesDir: string,
  path: string,
): DraftEntry[] {
  const key = draftKey(notesDir, path);
  const next = list.filter(
    (item) => draftKey(item.notesDir, item.path) !== key,
  );
  return next.length === list.length ? list : next;
}

export function removeDraftEntriesUnder(
  list: DraftEntry[],
  notesDir: string,
  prefix: string,
): DraftEntry[] {
  const next = list.filter(
    (item) =>
      item.notesDir !== notesDir || !isSameOrDescendant(item.path, prefix),
  );
  return next.length === list.length ? list : next;
}

export function clearDraftsForWorkspace(
  list: DraftEntry[],
  notesDir: string,
): DraftEntry[] {
  const next = list.filter((item) => item.notesDir !== notesDir);
  return next.length === list.length ? list : next;
}

export function renameDraftEntries(
  list: DraftEntry[],
  notesDir: string,
  oldPrefix: string,
  newPrefix: string,
): DraftEntry[] {
  const byPath = new Map<string, DraftEntry>();
  let changed = false;

  for (const entry of list) {
    if (
      entry.notesDir !== notesDir ||
      !isSameOrDescendant(entry.path, oldPrefix)
    ) {
      const key = draftKey(entry.notesDir, entry.path);
      const existing = byPath.get(key);
      if (!existing || existing.updatedAt < entry.updatedAt) {
        byPath.set(key, entry);
      }
      continue;
    }

    changed = true;
    const renamed: DraftEntry = {
      ...entry,
      path: replacePrefix(entry.path, oldPrefix, newPrefix),
    };
    const key = draftKey(renamed.notesDir, renamed.path);
    const existing = byPath.get(key);
    if (!existing || existing.updatedAt < renamed.updatedAt) {
      byPath.set(key, renamed);
    }
  }

  if (!changed) return list;
  return pruneDraftList([...byPath.values()]);
}

export function readDraftList(): DraftEntry[] {
  try {
    const raw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!raw) return [];
    return normalizeDraftList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeDraftList(list: DraftEntry[]): boolean {
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return false;
  }

  const pruned = pruneDraftList(list);
  try {
    storage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(pruned));
    return true;
  } catch {
    const fallback = pruned.slice(
      0,
      Math.max(1, Math.floor(pruned.length / 2)),
    );
    try {
      storage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(fallback));
      return true;
    } catch {
      return false;
    }
  }
}

export function readDraftsForWorkspace(notesDir: string): DraftEntry[] {
  return readDraftList().filter((entry) => entry.notesDir === notesDir);
}

export function getDraft(
  notesDir: string,
  path: string,
): DraftEntry | null {
  const key = draftKey(notesDir, path);
  return (
    readDraftList().find(
      (entry) => draftKey(entry.notesDir, entry.path) === key,
    ) ?? null
  );
}

export function writeDraft(
  notesDir: string,
  path: string,
  content: string,
  now: number = Date.now(),
): void {
  const list = readDraftList();
  const next = putDraftEntry(list, {
    notesDir,
    path,
    content,
    updatedAt: now,
  });
  if (next === list) return;
  writeDraftList(next);
}

export function removeDraft(notesDir: string, path: string): void {
  const list = readDraftList();
  const next = removeDraftEntry(list, notesDir, path);
  if (next !== list) writeDraftList(next);
}

export function removeDraftsUnder(notesDir: string, prefix: string): void {
  const list = readDraftList();
  const next = removeDraftEntriesUnder(list, notesDir, prefix);
  if (next !== list) writeDraftList(next);
}

export function renameDrafts(
  notesDir: string,
  oldPrefix: string,
  newPrefix: string,
): void {
  const list = readDraftList();
  const next = renameDraftEntries(list, notesDir, oldPrefix, newPrefix);
  if (next !== list) writeDraftList(next);
}

export function clearWorkspaceDrafts(notesDir: string): void {
  const list = readDraftList();
  const next = clearDraftsForWorkspace(list, notesDir);
  if (next !== list) writeDraftList(next);
}
