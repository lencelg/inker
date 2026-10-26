import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DRAFTS_STORAGE_KEY,
  MAX_DRAFT_BYTES,
  MAX_DRAFT_TOTAL_BYTES,
  MAX_DRAFTS,
  clearDraftsForWorkspace,
  clearWorkspaceDrafts,
  draftByteLength,
  getDraft,
  normalizeDraftList,
  pruneDraftList,
  putDraftEntry,
  readDraftList,
  readDraftsForWorkspace,
  removeDraft,
  removeDraftEntriesUnder,
  removeDraftEntry,
  removeDraftsUnder,
  renameDraftEntries,
  renameDrafts,
  writeDraft,
  writeDraftList,
  type DraftEntry,
} from './drafts';

function draft(
  overrides: Partial<DraftEntry> = {},
): DraftEntry {
  return {
    notesDir: '/notes',
    path: 'a.md',
    content: 'hello',
    updatedAt: 100,
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('draftByteLength', () => {
  it('counts UTF-8 bytes', () => {
    expect(draftByteLength('abc')).toBe(3);
    expect(draftByteLength('笔记')).toBe(6);
  });
});

describe('putDraftEntry', () => {
  it('adds and replaces drafts for the same workspace path', () => {
    let list = putDraftEntry([], draft());
    list = putDraftEntry(list, draft({ content: 'next', updatedAt: 200 }));

    expect(list).toHaveLength(1);
    expect(list[0].content).toBe('next');
    expect(list[0].updatedAt).toBe(200);
  });

  it('keeps drafts for the same relative path in different workspaces', () => {
    let list = putDraftEntry([], draft({ notesDir: '/a' }));
    list = putDraftEntry(list, draft({ notesDir: '/b', content: 'other' }));

    expect(list).toHaveLength(2);
  });

  it('skips oversized content and clears the stale draft for that path', () => {
    const huge = 'x'.repeat(MAX_DRAFT_BYTES + 1);
    let list = putDraftEntry([], draft());
    list = putDraftEntry(list, draft({ content: huge, updatedAt: 300 }));

    expect(list).toEqual([]);
  });

  it('allows an empty draft', () => {
    const list = putDraftEntry([], draft({ content: '' }));
    expect(list[0].content).toBe('');
  });

  it('ignores entries with invalid keys or timestamps', () => {
    const list = [draft()];

    expect(putDraftEntry(list, draft({ notesDir: '' }))).toBe(list);
    expect(putDraftEntry(list, draft({ path: '../escape.md' }))).toBe(list);
    expect(
      putDraftEntry(list, draft({ updatedAt: Number.NaN })),
    ).toBe(list);
  });
});

describe('draft removal', () => {
  it('removes one draft only from the requested workspace', () => {
    const list = [
      draft({ notesDir: '/a' }),
      draft({ notesDir: '/b', content: 'other' }),
    ];

    expect(removeDraftEntry(list, '/a', 'a.md')).toEqual([
      draft({ notesDir: '/b', content: 'other' }),
    ]);
  });

  it('removes drafts under a file or directory prefix', () => {
    const list = [
      draft({ notesDir: '/a', path: 'docs/a.md' }),
      draft({ notesDir: '/a', path: 'docs/deep/b.md' }),
      draft({ notesDir: '/a', path: 'docs2/c.md' }),
      draft({ notesDir: '/b', path: 'docs/a.md' }),
    ];

    expect(
      removeDraftEntriesUnder(list, '/a', 'docs').map((entry) => entry.path),
    ).toEqual(['docs2/c.md', 'docs/a.md']);
  });

  it('clears every draft in one workspace', () => {
    const list = [
      draft({ notesDir: '/a', path: 'a.md' }),
      draft({ notesDir: '/a', path: 'b.md' }),
      draft({ notesDir: '/b', path: 'a.md' }),
    ];

    expect(clearDraftsForWorkspace(list, '/a').map((entry) => entry.notesDir)).toEqual([
      '/b',
    ]);
  });
});

describe('renameDraftEntries', () => {
  it('renames file and directory prefixes in one workspace', () => {
    const list = [
      draft({ notesDir: '/a', path: 'a.md' }),
      draft({ notesDir: '/a', path: 'docs/b.md' }),
      draft({ notesDir: '/b', path: 'a.md' }),
    ];

    const renamed = renameDraftEntries(list, '/a', 'docs', 'archive');
    expect(renamed.map((entry) => entry.path).sort()).toEqual([
      'a.md',
      'archive/b.md',
      'a.md',
    ].sort());
    expect(renamed.filter((entry) => entry.notesDir === '/b')).toHaveLength(1);
  });

  it('keeps the newest draft when a renamed path collides', () => {
    const list = [
      draft({ notesDir: '/a', path: 'docs/b.md', content: 'old', updatedAt: 100 }),
      draft({ notesDir: '/a', path: 'archive/b.md', content: 'new', updatedAt: 200 }),
    ];

    const renamed = renameDraftEntries(list, '/a', 'docs', 'archive');
    expect(renamed).toHaveLength(1);
    expect(renamed[0]).toMatchObject({ path: 'archive/b.md', content: 'new' });
  });

  it('keeps the newest draft regardless of list order', () => {
    const olderTarget = [
      draft({ notesDir: '/a', path: 'archive/b.md', content: 'new', updatedAt: 200 }),
      draft({ notesDir: '/a', path: 'docs/b.md', content: 'old', updatedAt: 100 }),
    ];
    const olderSource = [
      draft({ notesDir: '/a', path: 'docs/b.md', content: 'new', updatedAt: 200 }),
      draft({ notesDir: '/a', path: 'archive/b.md', content: 'old', updatedAt: 100 }),
    ];

    for (const list of [olderTarget, olderSource]) {
      const renamed = renameDraftEntries(list, '/a', 'docs', 'archive');
      expect(renamed).toHaveLength(1);
      expect(renamed[0]).toMatchObject({
        path: 'archive/b.md',
        content: 'new',
      });
    }
  });
});

describe('pruneDraftList', () => {
  it('keeps only the newest entries', () => {
    const list = Array.from({ length: MAX_DRAFTS + 3 }, (_, index) =>
      draft({ path: `note-${index}.md`, updatedAt: index }),
    );

    const pruned = pruneDraftList(list);
    expect(pruned).toHaveLength(MAX_DRAFTS);
    expect(pruned.some((entry) => entry.path === 'note-0.md')).toBe(false);
    expect(pruned.some((entry) => entry.path === `note-${MAX_DRAFTS + 2}.md`)).toBe(
      true,
    );
  });

  it('skips an oversized entry while keeping an older small one', () => {
    const list = [
      draft({
        path: 'huge.md',
        content: 'x'.repeat(MAX_DRAFT_BYTES + 1),
        updatedAt: 200,
      }),
      draft({ path: 'small.md', content: 'x', updatedAt: 100 }),
    ];

    const pruned = pruneDraftList(list);
    expect(pruned.map((entry) => entry.path)).toEqual(['small.md']);
  });

  it('keeps the total size under the limit', () => {
    const list = Array.from({ length: 9 }, (_, index) =>
      draft({
        path: `note-${index}.md`,
        content: 'x'.repeat(MAX_DRAFT_BYTES),
        updatedAt: index,
      }),
    );

    const pruned = pruneDraftList(list);
    const total = pruned.reduce(
      (sum, entry) => sum + draftByteLength(entry.content),
      0,
    );
    expect(total).toBeLessThanOrEqual(MAX_DRAFT_TOTAL_BYTES);
    expect(pruned).toHaveLength(8);
    expect(pruned.some((entry) => entry.path === 'note-8.md')).toBe(true);
    expect(pruned.some((entry) => entry.path === 'note-0.md')).toBe(false);
  });
});

describe('normalizeDraftList', () => {
  it('drops malformed and unsafe entries', () => {
    const list = normalizeDraftList([
      draft(),
      draft({ path: '/absolute.md' }),
      draft({ path: '../escape.md' }),
      draft({ notesDir: '' }),
      { notesDir: '/notes', path: 'bad.md', content: 42, updatedAt: 100 },
      draft({ updatedAt: Number.NaN }),
      draft({ path: 'a.md', content: 'newer', updatedAt: 300 }),
      { nope: true },
    ]);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ path: 'a.md', content: 'newer' });
  });

  it('returns an empty list for non-arrays', () => {
    expect(normalizeDraftList(null)).toEqual([]);
    expect(normalizeDraftList({})).toEqual([]);
  });
});

describe('draft storage', () => {
  it('round-trips drafts across workspaces', () => {
    writeDraft('/a', 'a.md', 'alpha', 100);
    writeDraft('/b', 'a.md', 'beta', 200);

    expect(getDraft('/a', 'a.md')?.content).toBe('alpha');
    expect(getDraft('/b', 'a.md')?.content).toBe('beta');
    expect(readDraftsForWorkspace('/a')).toHaveLength(1);
    expect(window.localStorage.getItem(DRAFTS_STORAGE_KEY)).toBeTruthy();
  });

  it('removes drafts through the storage API', () => {
    writeDraft('/a', 'docs/a.md', 'alpha', 100);
    removeDraft('/a', 'docs/a.md');
    expect(getDraft('/a', 'docs/a.md')).toBeNull();

    writeDraft('/a', 'docs/a.md', 'alpha', 100);
    writeDraft('/a', 'docs/b.md', 'beta', 100);
    removeDraftsUnder('/a', 'docs');
    expect(readDraftsForWorkspace('/a')).toEqual([]);
  });

  it('renames drafts through the storage API', () => {
    writeDraft('/a', 'docs/a.md', 'alpha', 100);
    renameDrafts('/a', 'docs', 'archive');

    expect(getDraft('/a', 'docs/a.md')).toBeNull();
    expect(getDraft('/a', 'archive/a.md')?.content).toBe('alpha');
  });

  it('clears all drafts in one workspace through storage', () => {
    writeDraft('/a', 'a.md', 'alpha', 100);
    writeDraft('/a', 'b.md', 'beta', 100);
    writeDraft('/b', 'a.md', 'gamma', 100);

    clearWorkspaceDrafts('/a');

    expect(readDraftsForWorkspace('/a')).toEqual([]);
    expect(readDraftsForWorkspace('/b')).toHaveLength(1);
  });

  it('ignores corrupted storage', () => {
    window.localStorage.setItem(DRAFTS_STORAGE_KEY, '{not json');
    expect(readDraftList()).toEqual([]);
  });

  it('returns false when storage rejects the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(writeDraftList([draft()])).toBe(false);
  });

  it('falls back to a smaller set when the first write is rejected', () => {
    const original = Storage.prototype.setItem;
    let calls = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      calls += 1;
      if (calls === 1) throw new Error('quota');
      original.call(this, key, value);
    });

    const list = [
      draft({ path: 'a.md' }),
      draft({ path: 'b.md' }),
      draft({ path: 'c.md' }),
    ];
    expect(writeDraftList(list)).toBe(true);
    expect(calls).toBe(2);
    expect(readDraftList().length).toBeGreaterThan(0);
  });
});
