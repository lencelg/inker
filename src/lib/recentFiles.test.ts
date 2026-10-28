import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_RECENT_FILES,
  MAX_RECENT_WORKSPACES,
  normalizeRecentFiles,
  recentFilesForWorkspace,
  recordRecentFile,
  RECENT_FILES_STORAGE_KEY,
  readRecentFilesMap,
  writeRecentFilesMap,
} from './recentFiles';

afterEach(() => {
  window.localStorage.clear();
});

describe('recent files', () => {
  it('adds files to the front and deduplicates them', () => {
    let map = recordRecentFile({}, '/notes', 'a.md');
    map = recordRecentFile(map, '/notes', 'b.md');
    map = recordRecentFile(map, '/notes', 'a.md');

    expect(recentFilesForWorkspace(map, '/notes')).toEqual([
      'a.md',
      'b.md',
    ]);
  });

  it('caps the number of files per workspace', () => {
    let map = {};
    for (let index = 0; index < MAX_RECENT_FILES + 5; index += 1) {
      map = recordRecentFile(map, '/notes', `note-${index}.md`);
    }

    expect(recentFilesForWorkspace(map, '/notes')).toHaveLength(
      MAX_RECENT_FILES,
    );
    expect(recentFilesForWorkspace(map, '/notes')[0]).toBe(
      `note-${MAX_RECENT_FILES + 4}.md`,
    );
  });

  it('keeps workspaces isolated and caps their count', () => {
    let map = {};
    for (let index = 0; index < MAX_RECENT_WORKSPACES + 2; index += 1) {
      map = recordRecentFile(map, `/notes-${index}`, 'a.md');
    }

    expect(Object.keys(map)).toHaveLength(MAX_RECENT_WORKSPACES);
    expect(recentFilesForWorkspace(map, '/notes-0')).toEqual([]);
    expect(recentFilesForWorkspace(map, '/notes-11')).toEqual(['a.md']);
  });

  it('normalizes invalid stored data', () => {
    expect(
      normalizeRecentFiles({
        '/notes': ['a.md', 'a.md', 42, '', 'b.md'],
        '': ['ignored.md'],
        '/empty': [],
        '/bad': 'nope',
      }),
    ).toEqual({
      '/notes': ['a.md', 'b.md'],
      '/empty': [],
    });
  });

  it('reads and writes the storage map', () => {
    const map = recordRecentFile({}, '/notes', 'a.md');
    writeRecentFilesMap(map);

    expect(
      window.localStorage.getItem(RECENT_FILES_STORAGE_KEY),
    ).toContain('a.md');
    expect(readRecentFilesMap()).toEqual(map);
  });
});
