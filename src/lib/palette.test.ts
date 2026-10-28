import { describe, expect, it } from 'vitest';
import type { FileEntry } from '../types';
import {
  buildFilePaletteItems,
  commandKeepsSettingsOpen,
  filterPaletteItems,
  fuzzyScore,
  type PaletteItem,
} from './palette';

const items: PaletteItem[] = [
  {
    id: 'theme:monokai',
    label: 'Monokai',
    detail: 'UI theme',
    keywords: ['theme', '色'],
  },
  {
    id: 'theme:dark',
    label: 'Dark',
    detail: 'UI theme',
    keywords: ['theme'],
  },
  {
    id: 'command:theme',
    label: 'Preferences: Color Theme',
    detail: 'Preferences',
    keywords: ['theme', '颜色', 'color'],
  },
];

describe('fuzzyScore', () => {
  it('scores exact, prefix and substring matches', () => {
    const exact = fuzzyScore('dark', 'Dark');
    const prefix = fuzzyScore('da', 'Dark');
    const substring = fuzzyScore('ark', 'Dark');

    expect(exact).not.toBeNull();
    expect(prefix).not.toBeNull();
    expect(substring).not.toBeNull();
    expect(exact!).toBeGreaterThan(prefix!);
    expect(prefix!).toBeGreaterThan(substring!);
  });

  it('matches subsequences and rejects missing characters', () => {
    expect(fuzzyScore('mnk', 'Monokai')).not.toBeNull();
    expect(fuzzyScore('xyz', 'Monokai')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(fuzzyScore('MONO', 'monokai')).not.toBeNull();
  });
});

describe('filterPaletteItems', () => {
  it('returns all items in original order for an empty query', () => {
    expect(filterPaletteItems(items, '   ')).toEqual(items);
  });

  it('filters labels, details and keywords', () => {
    expect(filterPaletteItems(items, 'monokai').map((item) => item.id)).toEqual(
      ['theme:monokai'],
    );
    expect(
      filterPaletteItems(items, 'preferences').map((item) => item.id),
    ).toEqual(['command:theme']);
    expect(filterPaletteItems(items, '颜色').map((item) => item.id)).toEqual([
      'command:theme',
    ]);
  });

  it('prefers label matches over detail matches', () => {
    const ranked = filterPaletteItems(items, 'theme');
    expect(ranked.map((item) => item.id)).toEqual([
      'command:theme',
      'theme:monokai',
      'theme:dark',
    ]);
  });

  it('returns nothing when no item matches', () => {
    expect(filterPaletteItems(items, 'zzz')).toEqual([]);
  });
});

describe('buildFilePaletteItems', () => {
  const entries: FileEntry[] = [
    { path: 'notes.md', name: 'notes.md', isDir: false },
    { path: 'docs/plan.md', name: 'plan.md', isDir: false },
    { path: 'assets/shot.png', name: 'shot.png', isDir: false },
    { path: 'docs', name: 'docs', isDir: true },
  ];

  it('lists only markdown files by default', () => {
    expect(buildFilePaletteItems(entries, false)).toEqual([
      {
        id: 'notes.md',
        label: 'notes.md',
        detail: '',
        keywords: ['notes.md'],
        kind: 'note',
      },
      {
        id: 'docs/plan.md',
        label: 'plan.md',
        detail: 'docs',
        keywords: ['docs/plan.md'],
        kind: 'note',
      },
    ]);
  });

  it('boosts recent files in fuzzy search results', () => {
    const same: PaletteItem[] = [
      { id: 'a.md', label: 'Same', kind: 'note' },
      { id: 'b.md', label: 'Same', kind: 'note' },
    ];

    expect(
      filterPaletteItems(same, 'same', ['b.md']).map((item) => item.id),
    ).toEqual(['b.md', 'a.md']);
  });

  it('orders recently opened files first', () => {
    const palette = buildFilePaletteItems(entries, false, [
      'docs/plan.md',
    ]);
    expect(palette.map((item) => item.id)).toEqual([
      'docs/plan.md',
      'notes.md',
    ]);
  });

  it('includes images when enabled', () => {
    const palette = buildFilePaletteItems(entries, true);
    expect(palette.map((item) => item.id)).toContain('assets/shot.png');
    expect(palette.find((item) => item.id === 'assets/shot.png')?.kind).toBe(
      'image',
    );
  });

  it('matches files by their path detail', () => {
    const palette = buildFilePaletteItems(entries, false);
    expect(filterPaletteItems(palette, 'docs').map((item) => item.id)).toEqual([
      'docs/plan.md',
    ]);
  });
});

describe('commandKeepsSettingsOpen', () => {
  it('keeps settings open for preference toggles and save', () => {
    expect(commandKeepsSettingsOpen('preferences.colorTheme')).toBe(true);
    expect(commandKeepsSettingsOpen('preferences.codeTheme')).toBe(true);
    expect(commandKeepsSettingsOpen('preferences.toggleVim')).toBe(true);
    expect(commandKeepsSettingsOpen('preferences.toggleAutoSave')).toBe(
      true,
    );
    expect(commandKeepsSettingsOpen('preferences.openSettings')).toBe(
      true,
    );
    expect(commandKeepsSettingsOpen('file.save')).toBe(true);
  });

  it('closes settings for commands that change the workspace view', () => {
    expect(commandKeepsSettingsOpen('view.source')).toBe(false);
    expect(commandKeepsSettingsOpen('view.togglePreview')).toBe(false);
    expect(commandKeepsSettingsOpen('file.chooseFolder')).toBe(false);
    expect(commandKeepsSettingsOpen('markdown.createToc')).toBe(false);
  });
});
