import { afterEach, describe, expect, it } from 'vitest';
import {
  CODE_HIGHLIGHT_STORAGE_KEY,
  FONT_SIZE_STORAGE_KEY,
  IMMERSIVE_STORAGE_KEY,
  LANGUAGE_STORAGE_KEY,
  VIM_STORAGE_KEY,
  normalizePreferences,
  readPreferences,
  savePreferences,
} from './preferences';

afterEach(() => {
  window.localStorage.clear();
});

describe('preferences', () => {
  it('defaults immersive writing to off', () => {
    expect(normalizePreferences({}).immersive).toBe(false);
  });

  it('keeps immersive writing enabled', () => {
    expect(normalizePreferences({ immersive: true }).immersive).toBe(true);
  });

  it('enables preview code highlighting by default', () => {
    expect(normalizePreferences({}).codeHighlight).toBe(true);
  });

  it('keeps disabled preview code highlighting', () => {
    expect(
      normalizePreferences({ codeHighlight: false }).codeHighlight,
    ).toBe(false);
  });

  it('enables source highlighting by default and keeps it disabled', () => {
    expect(normalizePreferences({}).sourceHighlight).toBe(true);
    expect(
      normalizePreferences({ sourceHighlight: false }).sourceHighlight,
    ).toBe(false);
  });

  it('migrates legacy markleaf preference keys to inker keys', () => {
    window.localStorage.setItem('markleaf-theme', 'dark');
    window.localStorage.setItem('markleaf-font-size', '20');
    window.localStorage.setItem('markleaf-vim', 'true');
    window.localStorage.setItem('markleaf-immersive', 'true');
    window.localStorage.setItem('markleaf-code-highlight', 'false');

    const preferences = readPreferences();

    expect(preferences.theme).toBe('dark');
    expect(preferences.fontSize).toBe(20);
    expect(preferences.vimEnabled).toBe(true);
    expect(preferences.immersive).toBe(true);
    expect(preferences.codeHighlight).toBe(false);

    expect(window.localStorage.getItem('inker-theme')).toBe('dark');
    expect(window.localStorage.getItem(FONT_SIZE_STORAGE_KEY)).toBe('20');
    expect(window.localStorage.getItem(VIM_STORAGE_KEY)).toBe('true');
    expect(window.localStorage.getItem(IMMERSIVE_STORAGE_KEY)).toBe('true');
    expect(window.localStorage.getItem(CODE_HIGHLIGHT_STORAGE_KEY)).toBe(
      'false',
    );
    expect(window.localStorage.getItem('markleaf-theme')).toBeNull();
  });

  it('defaults the display language to the system setting', () => {
    expect(normalizePreferences({}).language).toBe('system');
  });

  it('keeps explicit language preferences and persists them', () => {
    expect(normalizePreferences({ language: 'zh' }).language).toBe('zh');
    expect(normalizePreferences({ language: 'en' }).language).toBe('en');
    expect(normalizePreferences({ language: 'fr' }).language).toBe(
      'system',
    );

    savePreferences(normalizePreferences({ language: 'en' }));
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(readPreferences().language).toBe('en');
  });

  it('defaults and persists export preferences', () => {
    const defaults = normalizePreferences({});
    expect(defaults.exportEmbedImages).toBe(true);
    expect(defaults.exportOpenAfter).toBe(false);
    expect(defaults.exportIncludeToc).toBe(false);

    savePreferences(
      normalizePreferences({
        exportEmbedImages: false,
        exportOpenAfter: true,
        exportIncludeToc: false,
      }),
    );

    const stored = readPreferences();
    expect(stored.exportEmbedImages).toBe(false);
    expect(stored.exportOpenAfter).toBe(true);
    expect(stored.exportIncludeToc).toBe(false);
  });
});
