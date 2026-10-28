import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRecentFiles,
  MAX_RECENT_FILES,
  MAX_RECENT_WORKSPACES,
  normalizeRecentFiles,
  pruneRecentFiles,
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

  it('clears recent files for one workspace', () => {
    let map = recordRecentFile({}, '/notes', 'a.md');
    map = recordRecentFile(map, '/other', 'b.md');

    map = clearRecentFiles(map, '/notes');

    expect(recentFilesForWorkspace(map, '/notes')).toEqual([]);
    expect(recentFilesForWorkspace(map, '/other')).toEqual(['b.md']);
  });

  it('prunes recent files that no longer exist', () => {
    let map = recordRecentFile({}, '/notes', 'a.md');
    map = recordRecentFile(map, '/notes', 'b.md');
    map = recordRecentFile(map, '/notes', 'c.md');

    map = pruneRecentFiles(map, '/notes', ['a.md', 'c.md']);

    expect(recentFilesForWorkspace(map, '/notes')).toEqual([
      'c.md',
      'a.md',
    ]);

    map = pruneRecentFiles(map, '/notes', ['c.md']);
    expect(recentFilesForWorkspace(map, '/notes')).toEqual(['c.md']);
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
