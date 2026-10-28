import { ref } from 'vue';
import {
  clearRecentFiles,
  pruneRecentFiles,
  readRecentFilesMap,
  recentFilesForWorkspace,
  recordRecentFile,
  writeRecentFilesMap,
  type RecentFilesMap,
} from '../lib/recentFiles';

export function useRecentFiles() {
  let map: RecentFilesMap = readRecentFilesMap();
  const files = ref<string[]>([]);

  function sync(notesDir: string | null): void {
    files.value = recentFilesForWorkspace(map, notesDir);
  }

  function record(notesDir: string | null, path: string): void {
    const next = recordRecentFile(map, notesDir, path);
    if (next === map) return;
    map = next;
    files.value = recentFilesForWorkspace(map, notesDir);
    writeRecentFilesMap(map);
  }

  function clear(notesDir: string | null): void {
    const next = clearRecentFiles(map, notesDir);
    if (next === map) return;
    map = next;
    files.value = recentFilesForWorkspace(map, notesDir);
    writeRecentFilesMap(map);
  }

  function prune(
    notesDir: string | null,
    validPaths: Iterable<string>,
  ): void {
    const next = pruneRecentFiles(map, notesDir, validPaths);
    if (next === map) return;
    map = next;
    files.value = recentFilesForWorkspace(map, notesDir);
    writeRecentFilesMap(map);
  }

  return { files, sync, record, clear, prune };
}
