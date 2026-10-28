import {
  putDraftEntry,
  readDraftList,
  removeDraftEntry,
  writeDraftList,
} from '../lib/drafts';

export interface DraftTab {
  path: string;
  content: string;
  savedContent: string;
}

export interface DraftPersistenceOptions {
  notesDir: () => string | null;
  tabs: () => readonly DraftTab[];
  isImage: (path: string) => boolean;
  isSuppressed: () => boolean;
  idleMs?: number;
  maxIntervalMs?: number;
  now?: () => number;
}

export function useDraftPersistence(
  options: DraftPersistenceOptions,
) {
  const idleMs = options.idleMs ?? 2000;
  const maxIntervalMs = options.maxIntervalMs ?? 15000;
  const now = options.now ?? Date.now;
  let timer = 0;
  let lastFlushedAt = 0;

  function clearTimer(): void {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
  }

  function flush(): void {
    if (options.isSuppressed()) return;
    const dir = options.notesDir();
    if (!dir) return;
    clearTimer();
    lastFlushedAt = now();

    let list = readDraftList();
    let changed = false;
    for (const tab of options.tabs()) {
      if (options.isImage(tab.path)) continue;
      const existing = list.find(
        (entry) =>
          entry.notesDir === dir && entry.path === tab.path,
      );
      if (tab.content !== tab.savedContent) {
        if (existing?.content === tab.content) continue;
        const next = putDraftEntry(list, {
          notesDir: dir,
          path: tab.path,
          content: tab.content,
          updatedAt: now(),
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

  function schedule(): void {
    if (!options.notesDir()) return;
    if (now() - lastFlushedAt >= maxIntervalMs) {
      flush();
      return;
    }
    clearTimer();
    timer = window.setTimeout(() => {
      timer = 0;
      flush();
    }, idleMs);
  }

  return { schedule, flush, clearTimer };
}
