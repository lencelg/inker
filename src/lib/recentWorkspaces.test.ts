import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_RECENT_WORKSPACES,
  RECENT_WORKSPACES_STORAGE_KEY,
  normalizeRecentWorkspaces,
  readRecentWorkspaces,
  recordRecentWorkspace,
  seedRecentWorkspaces,
  workspaceDisplayName,
  writeRecentWorkspaces,
  type RecentWorkspace,
} from './recentWorkspaces';

afterEach(() => {
  window.localStorage.clear();
});

function workspace(
  path: string,
  openedAt: number,
): RecentWorkspace {
  return { path, name: workspaceDisplayName(path), openedAt };
}

describe('recent workspaces', () => {
  it('derives display names from paths', () => {
    expect(workspaceDisplayName('/home/user/notes')).toBe('notes');
    expect(workspaceDisplayName('/home/user/notes/')).toBe('notes');
    expect(workspaceDisplayName('C:\\Users\\me\\Notes')).toBe('Notes');
    expect(workspaceDisplayName('/')).toBe('/');
  });

  it('normalizes, dedupes and sorts entries', () => {
    const normalized = normalizeRecentWorkspaces([
      { path: '/notes', openedAt: 10 },
      { path: '/notes', openedAt: 80 },
      { path: '/other', name: 'Other', openedAt: 50 },
      { path: '', openedAt: 1 },
      { path: '/bad\0path', openedAt: 1 },
      'nope',
    ]);
    expect(normalized).toEqual([
      { path: '/notes', name: 'notes', openedAt: 80 },
      { path: '/other', name: 'Other', openedAt: 50 },
    ]);
  });

  it('caps the list and moves recorded workspaces to the front', () => {
    let list = normalizeRecentWorkspaces(
      Array.from({ length: MAX_RECENT_WORKSPACES }, (_, index) => ({
        path: `/notes-${index}`,
        openedAt: index,
      })),
    );
    list = recordRecentWorkspace(list, '/notes-3', 100);
    expect(list[0]).toMatchObject({
      path: '/notes-3',
      openedAt: 100,
    });
    expect(list).toHaveLength(MAX_RECENT_WORKSPACES);
    expect(
      list.filter((entry) => entry.path === '/notes-3'),
    ).toHaveLength(1);

    list = recordRecentWorkspace(list, '/brand-new', 200);
    expect(list[0].path).toBe('/brand-new');
    expect(list).toHaveLength(MAX_RECENT_WORKSPACES);
    expect(list.some((entry) => entry.path === '/notes-0')).toBe(false);
  });

  it('persists and reads the list', () => {
    const list = [workspace('/notes', 12)];
    writeRecentWorkspaces(list);
    expect(window.localStorage.getItem(RECENT_WORKSPACES_STORAGE_KEY)).toBe(
      JSON.stringify(list),
    );
    expect(readRecentWorkspaces()).toEqual(list);
  });

  it('seeds from session snapshots and the current folder', () => {
    window.localStorage.setItem(
      RECENT_WORKSPACES_STORAGE_KEY,
      JSON.stringify([workspace('/stored', 1)]),
    );
    window.localStorage.setItem(
      'inker-session-v1',
      JSON.stringify({
        '/older': {
          version: 1,
          tabs: [{ path: 'a.md', line: 1, column: 1, scrollTop: 0 }],
          activePath: 'a.md',
          previewPath: null,
          viewMode: 'source',
          expandedPaths: [],
          activeView: 'explorer',
          sidebarVisible: true,
          savedAt: 100,
        },
        '/newer': {
          version: 1,
          tabs: [{ path: 'b.md', line: 1, column: 1, scrollTop: 0 }],
          activePath: 'b.md',
          previewPath: null,
          viewMode: 'source',
          expandedPaths: [],
          activeView: 'explorer',
          sidebarVisible: true,
          savedAt: 300,
        },
      }),
    );

    const list = seedRecentWorkspaces('/current', 400);
    expect(list.map((entry) => entry.path)).toEqual([
      '/current',
      '/newer',
      '/older',
      '/stored',
    ]);
    expect(readRecentWorkspaces().map((entry) => entry.path)).toEqual(
      list.map((entry) => entry.path),
    );
  });
});
