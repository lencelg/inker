import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readDraftList,
  writeDraftList,
  type DraftEntry,
} from '../lib/drafts';
import { useDraftPersistence } from './useDraftPersistence';

interface Tab {
  path: string;
  content: string;
  savedContent: string;
}

function setup(
  options: {
    notesDir?: string | null;
    tabs?: Tab[];
    suppressed?: boolean;
    isImage?: (path: string) => boolean;
  } = {},
) {
  let now = 0;
  let tabs = options.tabs ?? [];
  let suppressed = options.suppressed ?? false;
  const notesDir =
    options.notesDir === undefined ? '/notes' : options.notesDir;
  const persistence = useDraftPersistence({
    notesDir: () => notesDir,
    tabs: () => tabs,
    isImage: options.isImage ?? (() => false),
    isSuppressed: () => suppressed,
    idleMs: 2000,
    maxIntervalMs: 15000,
    now: () => now,
  });

  return {
    persistence,
    setTabs: (next: Tab[]) => {
      tabs = next;
    },
    setSuppressed: (value: boolean) => {
      suppressed = value;
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function draftEntry(content = 'local'): DraftEntry {
  return {
    notesDir: '/notes',
    path: 'a.md',
    content,
    updatedAt: 1,
  };
}

afterEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
});

describe('useDraftPersistence', () => {
  it('writes dirty tabs after the idle delay', async () => {
    vi.useFakeTimers();
    const { persistence, advance } = setup({
      tabs: [{ path: 'a.md', content: 'local', savedContent: 'saved' }],
    });

    advance(1000);
    persistence.schedule();
    await vi.advanceTimersByTimeAsync(2000);

    expect(readDraftList()).toEqual([
      expect.objectContaining({
        notesDir: '/notes',
        path: 'a.md',
        content: 'local',
      }),
    ]);
  });

  it('removes drafts for clean tabs', () => {
    vi.useFakeTimers();
    writeDraftList([draftEntry()]);
    const { persistence } = setup({
      tabs: [{ path: 'a.md', content: 'same', savedContent: 'same' }],
    });

    persistence.flush();

    expect(readDraftList()).toEqual([]);
  });

  it('skips suppressed flushes and missing workspaces', () => {
    vi.useFakeTimers();
    const suppressed = setup({
      suppressed: true,
      tabs: [{ path: 'a.md', content: 'local', savedContent: 'saved' }],
    });
    suppressed.persistence.flush();
    expect(readDraftList()).toEqual([]);

    const missing = setup({
      notesDir: null,
      tabs: [{ path: 'a.md', content: 'local', savedContent: 'saved' }],
    });
    missing.persistence.flush();
    expect(readDraftList()).toEqual([]);
  });

  it('flushes immediately after the maximum interval', () => {
    vi.useFakeTimers();
    const { persistence, advance } = setup({
      tabs: [{ path: 'a.md', content: 'local', savedContent: 'saved' }],
    });

    advance(15000);
    persistence.schedule();

    expect(readDraftList()).toHaveLength(1);
  });

  it('ignores images', () => {
    vi.useFakeTimers();
    const { persistence } = setup({
      tabs: [{ path: 'pic.png', content: '', savedContent: '' }],
      isImage: () => true,
    });

    persistence.flush();

    expect(readDraftList()).toEqual([]);
  });

  it('clears a pending flush', async () => {
    vi.useFakeTimers();
    const { persistence, advance } = setup({
      tabs: [{ path: 'a.md', content: 'local', savedContent: 'saved' }],
    });

    advance(1000);
    persistence.schedule();
    persistence.clearTimer();
    await vi.advanceTimersByTimeAsync(2000);

    expect(readDraftList()).toEqual([]);
  });
});
