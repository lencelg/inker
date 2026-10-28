import { ref } from 'vue';
import {
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

  return { files, sync, record };
}
