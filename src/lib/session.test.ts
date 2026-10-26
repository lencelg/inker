import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_SESSION_TABS,
  MAX_SESSION_WORKSPACES,
  SESSION_STORAGE_KEY,
  normalizeWorkspaceSession,
  pruneWorkspaceSession,
  readSessionMap,
  readWorkspaceSession,
  removeWorkspaceSession,
  writeWorkspaceSession,
  type WorkspaceSession,
} from './session';

function makeSession(
  overrides: Partial<WorkspaceSession> = {},
): WorkspaceSession {
  return {
    version: 1,
    tabs: [{ path: 'a.md', line: 1, column: 1, scrollTop: 0 }],
    activePath: 'a.md',
    previewPath: null,
    viewMode: 'source',
    expandedPaths: [],
    activeView: 'explorer',
    sidebarVisible: true,
    savedAt: 100,
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('normalizeWorkspaceSession', () => {
  it('keeps a valid session', () => {
    const session = makeSession({
      tabs: [
        { path: 'a.md', line: 12, column: 3, scrollTop: 240 },
        { path: 'b.md', line: 1, column: 1, scrollTop: 0 },
      ],
      activePath: 'b.md',
      previewPath: 'a.md',
      viewMode: 'side',
      expandedPaths: ['docs'],
      activeView: 'search',
      sidebarVisible: false,
    });

    expect(normalizeWorkspaceSession(session)).toEqual(session);
  });

  it('rejects non-objects, wrong versions and missing tabs', () => {
    expect(normalizeWorkspaceSession(null)).toBeNull();
    expect(normalizeWorkspaceSession('nope')).toBeNull();
    expect(normalizeWorkspaceSession({ ...makeSession(), version: 2 })).toBeNull();
    expect(normalizeWorkspaceSession({ ...makeSession(), tabs: 'nope' })).toBeNull();
    expect(normalizeWorkspaceSession({ ...makeSession(), tabs: [] })).toBeNull();
  });

  it('clamps positions and drops malformed tabs', () => {
    const session = normalizeWorkspaceSession({
      ...makeSession(),
      tabs: [
        { path: 'a.md', line: -2, column: 0, scrollTop: -10 },
        { path: '', line: 1, column: 1, scrollTop: 0 },
        { path: 'a.md', line: 9, column: 4, scrollTop: 12 },
        { path: 42, line: 1, column: 1, scrollTop: 0 },
      ],
    });

    expect(session?.tabs).toEqual([
      { path: 'a.md', line: 1, column: 1, scrollTop: 0 },
    ]);
  });

  it('caps the number of restored tabs', () => {
    const tabs = Array.from({ length: MAX_SESSION_TABS + 5 }, (_, index) => ({
      path: `note-${index}.md`,
      line: 1,
      column: 1,
      scrollTop: 0,
    }));

    const session = normalizeWorkspaceSession({ ...makeSession(), tabs });
    expect(session?.tabs).toHaveLength(MAX_SESSION_TABS);
  });

  it('rejects unsafe relative paths', () => {
    const session = normalizeWorkspaceSession({
      ...makeSession(),
      tabs: [
        { path: '/abs.md', line: 1, column: 1, scrollTop: 0 },
        { path: '../escape.md', line: 1, column: 1, scrollTop: 0 },
        { path: 'docs/../a.md', line: 1, column: 1, scrollTop: 0 },
        { path: 'docs\\a.md', line: 1, column: 1, scrollTop: 0 },
        { path: 'a.md', line: 1, column: 1, scrollTop: 0 },
      ],
      expandedPaths: ['/abs', 'docs', 'x/../../y', 'docs/notes'],
    });

    expect(session?.tabs.map((tab) => tab.path)).toEqual(['a.md']);
    expect(session?.expandedPaths).toEqual(['docs', 'docs/notes']);
  });

  it('falls back to safe defaults for unknown view state', () => {
    const session = normalizeWorkspaceSession({
      ...makeSession(),
      viewMode: 'bogus',
      activeView: 'bogus',
      sidebarVisible: 'yes',
      activePath: 'missing.md',
      previewPath: 'missing.md',
      expandedPaths: ['docs', '', 'docs', 7],
    });

    expect(session?.viewMode).toBe('source');
    expect(session?.activeView).toBe('explorer');
    expect(session?.sidebarVisible).toBe(true);
    expect(session?.activePath).toBeNull();
    expect(session?.previewPath).toBeNull();
    expect(session?.expandedPaths).toEqual(['docs']);
  });
});

describe('pruneWorkspaceSession', () => {
  it('removes paths that no longer exist and repairs active state', () => {
    const session = makeSession({
      tabs: [
        { path: 'a.md', line: 5, column: 2, scrollTop: 30 },
        { path: 'gone.md', line: 1, column: 1, scrollTop: 0 },
      ],
      activePath: 'gone.md',
      previewPath: 'gone.md',
      expandedPaths: ['docs', 'gone-dir'],
    });

    const pruned = pruneWorkspaceSession(
      session,
      new Set(['a.md']),
      new Set(['docs']),
    );

    expect(pruned?.tabs.map((tab) => tab.path)).toEqual(['a.md']);
    expect(pruned?.activePath).toBe('a.md');
    expect(pruned?.previewPath).toBeNull();
    expect(pruned?.expandedPaths).toEqual(['docs']);
  });

  it('returns null when nothing remains', () => {
    const pruned = pruneWorkspaceSession(
      makeSession(),
      new Set(),
      new Set(),
    );

    expect(pruned).toBeNull();
  });

  it('falls back to the first tab when no active path is stored', () => {
    const pruned = pruneWorkspaceSession(
      makeSession({
        tabs: [
          { path: 'a.md', line: 1, column: 1, scrollTop: 0 },
          { path: 'b.md', line: 2, column: 1, scrollTop: 10 },
        ],
        activePath: null,
      }),
      new Set(['a.md', 'b.md']),
      new Set(),
    );

    expect(pruned?.activePath).toBe('a.md');
  });
});

describe('session storage', () => {
  it('round-trips sessions per notes directory', () => {
    writeWorkspaceSession('/notes/one', makeSession());
    writeWorkspaceSession(
      '/notes/two',
      makeSession({ tabs: [{ path: 'x.md', line: 1, column: 1, scrollTop: 0 }] }),
    );

    expect(readWorkspaceSession('/notes/one')?.tabs[0].path).toBe('a.md');
    expect(readWorkspaceSession('/notes/two')?.tabs[0].path).toBe('x.md');
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeTruthy();
  });

  it('removes a workspace session', () => {
    writeWorkspaceSession('/notes/one', makeSession());
    removeWorkspaceSession('/notes/one');

    expect(readWorkspaceSession('/notes/one')).toBeNull();
  });

  it('keeps only the most recent workspaces', () => {
    vi.useFakeTimers();
    for (let index = 0; index < MAX_SESSION_WORKSPACES + 3; index += 1) {
      vi.setSystemTime(new Date(2026, 0, 1, 0, 0, index));
      writeWorkspaceSession(`/notes/${index}`, makeSession());
    }

    const map = readSessionMap();
    expect(Object.keys(map)).toHaveLength(MAX_SESSION_WORKSPACES);
    expect(map['/notes/0']).toBeUndefined();
    expect(map[`/notes/${MAX_SESSION_WORKSPACES + 2}`]).toBeDefined();
  });

  it('keeps the previous session when storage rejects a write', () => {
    writeWorkspaceSession('/notes/one', makeSession());
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(() => {
      writeWorkspaceSession('/notes/two', makeSession());
    }).not.toThrow();
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe(raw);
  });

  it('ignores corrupted stored data', () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, '{not json');
    expect(readSessionMap()).toEqual({});

    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ '/notes/one': { version: 9 }, '/notes/two': makeSession() }),
    );
    expect(Object.keys(readSessionMap())).toEqual(['/notes/two']);
  });
});
