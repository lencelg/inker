import { describe, expect, it } from 'vitest';
import {
  buildRestorePlan,
  type RestoreSnapshot,
} from './workspaceRestore';

function snapshot(
  overrides: Partial<RestoreSnapshot> = {},
): RestoreSnapshot {
  return {
    tabs: [],
    activePath: null,
    previewPath: null,
    viewMode: 'source',
    expandedPaths: [],
    activeView: 'explorer',
    sidebarVisible: true,
    ...overrides,
  };
}

const isImage = (path: string) =>
  /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(path);

describe('buildRestorePlan', () => {
  it('restores session tabs and tab states', () => {
    const plan = buildRestorePlan({
      snapshot: snapshot({
        tabs: [
          { path: 'a.md', line: 3, column: 2, scrollTop: 40 },
          { path: 'pic.png', line: 1, column: 1, scrollTop: 0 },
        ],
        activePath: 'a.md',
      }),
      drafts: [],
      diskContents: { 'a.md': '# A' },
      isImage,
    });

    expect(plan?.tabs).toEqual([
      { path: 'a.md', content: '# A', savedContent: '# A' },
      { path: 'pic.png', content: '', savedContent: '' },
    ]);
    expect(plan?.tabStates).toEqual({
      'a.md': { line: 3, column: 2, scrollTop: 40 },
    });
    expect(plan?.activePath).toBe('a.md');
  });

  it('recovers drafts over disk content', () => {
    const plan = buildRestorePlan({
      snapshot: snapshot({
        tabs: [
          { path: 'a.md', line: 1, column: 1, scrollTop: 0 },
        ],
      }),
      drafts: [{ path: 'a.md', content: 'local' }],
      diskContents: { 'a.md': 'disk' },
      isImage,
    });

    expect(plan?.tabs[0]).toEqual({
      path: 'a.md',
      content: 'local',
      savedContent: 'disk',
    });
    expect(plan?.recovered).toBe(1);
    expect(plan?.staleDraftPaths).toEqual([]);
  });

  it('removes drafts that match disk content', () => {
    const plan = buildRestorePlan({
      snapshot: snapshot({
        tabs: [
          { path: 'a.md', line: 1, column: 1, scrollTop: 0 },
        ],
      }),
      drafts: [{ path: 'a.md', content: 'same' }],
      diskContents: { 'a.md': 'same' },
      isImage,
    });

    expect(plan?.tabs[0].content).toBe('same');
    expect(plan?.recovered).toBe(0);
    expect(plan?.staleDraftPaths).toEqual(['a.md']);
  });

  it('adds orphan drafts as recovered tabs', () => {
    const plan = buildRestorePlan({
      snapshot: snapshot({
        tabs: [
          { path: 'a.md', line: 1, column: 1, scrollTop: 0 },
        ],
      }),
      drafts: [
        { path: 'z.md', content: 'z local' },
        { path: 'b.md', content: 'b local' },
      ],
      diskContents: { 'a.md': 'a', 'b.md': 'b', 'z.md': 'z' },
      isImage,
    });

    expect(plan?.tabs.map((tab) => tab.path)).toEqual([
      'a.md',
      'b.md',
      'z.md',
    ]);
    expect(plan?.recovered).toBe(2);
  });

  it('drops session notes that cannot be read', () => {
    const plan = buildRestorePlan({
      snapshot: snapshot({
        tabs: [
          { path: 'a.md', line: 1, column: 1, scrollTop: 0 },
          { path: 'gone.md', line: 1, column: 1, scrollTop: 0 },
        ],
      }),
      drafts: [],
      diskContents: { 'a.md': 'a' },
      isImage,
    });

    expect(plan?.tabs.map((tab) => tab.path)).toEqual(['a.md']);
  });

  it('returns null when no tabs can be restored', () => {
    const plan = buildRestorePlan({
      snapshot: snapshot(),
      drafts: [],
      diskContents: {},
      isImage,
    });

    expect(plan).toBeNull();
  });

  it('falls back from invalid active and dirty preview tabs', () => {
    const plan = buildRestorePlan({
      snapshot: snapshot({
        tabs: [
          { path: 'a.md', line: 1, column: 1, scrollTop: 0 },
          { path: 'b.md', line: 1, column: 1, scrollTop: 0 },
        ],
        activePath: 'missing.md',
        previewPath: 'b.md',
      }),
      drafts: [{ path: 'b.md', content: 'dirty' }],
      diskContents: { 'a.md': 'a', 'b.md': 'b' },
      isImage,
    });

    expect(plan?.activePath).toBe('a.md');
    expect(plan?.previewPath).toBeNull();
  });

  it('restores workspace layout and expands active ancestors', () => {
    const plan = buildRestorePlan({
      snapshot: snapshot({
        tabs: [
          {
            path: 'journal/2026/day.md',
            line: 1,
            column: 1,
            scrollTop: 0,
          },
        ],
        viewMode: 'side',
        expandedPaths: ['notes'],
        activeView: 'search',
        sidebarVisible: false,
      }),
      drafts: [],
      diskContents: { 'journal/2026/day.md': 'day' },
      isImage,
    });

    expect(plan?.viewMode).toBe('side');
    expect(plan?.expandedPaths).toEqual([
      'notes',
      'journal',
      'journal/2026',
    ]);
    expect(plan?.activeView).toBe('search');
    expect(plan?.sidebarVisible).toBe(false);
  });
});
