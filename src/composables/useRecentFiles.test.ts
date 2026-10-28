import { afterEach, describe, expect, it } from 'vitest';
import { useRecentFiles } from './useRecentFiles';
import { RECENT_FILES_STORAGE_KEY } from '../lib/recentFiles';

afterEach(() => {
  window.localStorage.clear();
});

describe('useRecentFiles', () => {
  it('tracks recent files per workspace', () => {
    const recent = useRecentFiles();

    recent.record('/notes', 'a.md');
    recent.record('/notes', 'b.md');

    expect(recent.files.value).toEqual(['b.md', 'a.md']);

    recent.sync('/other');

    expect(recent.files.value).toEqual([]);
  });

  it('persists recorded files', () => {
    const recent = useRecentFiles();

    recent.record('/notes', 'a.md');

    expect(
      window.localStorage.getItem(RECENT_FILES_STORAGE_KEY),
    ).toContain('a.md');
  });

  it('clears and prunes recent files', () => {
    const recent = useRecentFiles();
    recent.record('/notes', 'a.md');
    recent.record('/notes', 'b.md');

    recent.prune('/notes', ['b.md']);
    expect(recent.files.value).toEqual(['b.md']);

    recent.clear('/notes');
    expect(recent.files.value).toEqual([]);
    expect(
      window.localStorage.getItem(RECENT_FILES_STORAGE_KEY),
    ).not.toContain('a.md');
  });
});
