import { afterEach, describe, expect, it } from 'vitest';
import {
  AUTO_SAVE_DELAY_STORAGE_KEY,
  AUTO_SAVE_STORAGE_KEY,
  CODE_HIGHLIGHT_STORAGE_KEY,
  FONT_SIZE_STORAGE_KEY,
  IMMERSIVE_STORAGE_KEY,
  LANGUAGE_STORAGE_KEY,
  IMAGE_CONFIRM_STORAGE_KEY,
  IMAGE_FOLDER_STORAGE_KEY,
  IMAGE_FORMAT_STORAGE_KEY,
  IMAGE_QUALITY_STORAGE_KEY,
  IMAGE_TEMPLATE_STORAGE_KEY,
  MINIMAP_ENABLED_STORAGE_KEY,
  MINIMAP_MAX_COLUMN_STORAGE_KEY,
  MINIMAP_SCALE_STORAGE_KEY,
  QUICK_OPEN_IMAGES_STORAGE_KEY,
  RESTORE_SESSION_STORAGE_KEY,
  VIM_MAPPINGS_STORAGE_KEY,
  VIM_STORAGE_KEY,
  normalizeImageFolder,
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

  it('defaults auto-save off and session restore on', () => {
    const defaults = normalizePreferences({});
    expect(defaults.autoSave).toBe(false);
    expect(defaults.autoSaveDelay).toBe(1000);
    expect(defaults.restoreSession).toBe(true);
  });

  it('clamps the auto-save delay', () => {
    expect(
      normalizePreferences({ autoSaveDelay: 100 }).autoSaveDelay,
    ).toBe(300);
    expect(
      normalizePreferences({ autoSaveDelay: 99999 }).autoSaveDelay,
    ).toBe(10000);
    expect(
      normalizePreferences({ autoSaveDelay: Number.NaN }).autoSaveDelay,
    ).toBe(1000);
    expect(
      normalizePreferences({ autoSaveDelay: 1000.6 }).autoSaveDelay,
    ).toBe(1001);
  });

  it('defaults and persists Vim mappings', () => {
    expect(normalizePreferences({}).vimMappings).toBe(
      'normal <Space>p pasteimage',
    );
    expect(
      normalizePreferences({ vimMappings: '' }).vimMappings,
    ).toBe('');

    const mappings = [
      'normal <Space>p pasteimage',
      'normal <C-s> save',
    ].join('\n');
    savePreferences(normalizePreferences({ vimMappings: mappings }));

    expect(window.localStorage.getItem(VIM_MAPPINGS_STORAGE_KEY)).toBe(
      mappings,
    );
    expect(readPreferences().vimMappings).toBe(mappings);
  });

  it('defaults quick open images off and persists the choice', () => {
    expect(normalizePreferences({}).quickOpenIncludeImages).toBe(false);

    savePreferences(
      normalizePreferences({ quickOpenIncludeImages: true }),
    );
    expect(window.localStorage.getItem(QUICK_OPEN_IMAGES_STORAGE_KEY)).toBe(
      'true',
    );
    expect(readPreferences().quickOpenIncludeImages).toBe(true);
  });

  it('defaults image preferences', () => {
    const defaults = normalizePreferences({});
    expect(defaults.imageConfirmPaste).toBe(true);
    expect(defaults.imageNameTemplate).toBe('{datetime}');
    expect(defaults.imageFormat).toBe('png');
    expect(defaults.imageFolder).toBe('assets');
    expect(defaults.imageQuality).toBe(0.92);
  });

  it('normalizes image paths, templates, formats and quality', () => {
    expect(normalizeImageFolder('/image/')).toBe('image');
    expect(normalizeImageFolder('assets\\shots')).toBe('assets/shots');
    expect(normalizeImageFolder('assets//shots/')).toBe('assets/shots');
    expect(normalizeImageFolder('/')).toBe('');
    expect(normalizeImageFolder('')).toBe('');

    expect(
      normalizePreferences({ imageFolder: '/image/' }).imageFolder,
    ).toBe('image');
    expect(
      normalizePreferences({ imageFolder: '' }).imageFolder,
    ).toBe('');
    expect(
      normalizePreferences({ imageNameTemplate: '  ' }).imageNameTemplate,
    ).toBe('{datetime}');
    expect(
      normalizePreferences({ imageFormat: 'gif' }).imageFormat,
    ).toBe('png');
    expect(
      normalizePreferences({ imageQuality: 2 }).imageQuality,
    ).toBe(1);
    expect(
      normalizePreferences({ imageConfirmPaste: false }).imageConfirmPaste,
    ).toBe(false);
  });

  it('persists image preferences', () => {
    savePreferences(
      normalizePreferences({
        imageConfirmPaste: false,
        imageNameTemplate: '{note}-{time}',
        imageFormat: 'webp',
        imageFolder: 'image/screenshots',
        imageQuality: 0.8,
      }),
    );

    expect(window.localStorage.getItem(IMAGE_CONFIRM_STORAGE_KEY)).toBe(
      'false',
    );
    expect(window.localStorage.getItem(IMAGE_TEMPLATE_STORAGE_KEY)).toBe(
      '{note}-{time}',
    );
    expect(window.localStorage.getItem(IMAGE_FORMAT_STORAGE_KEY)).toBe(
      'webp',
    );
    expect(window.localStorage.getItem(IMAGE_FOLDER_STORAGE_KEY)).toBe(
      'image/screenshots',
    );
    expect(window.localStorage.getItem(IMAGE_QUALITY_STORAGE_KEY)).toBe(
      '0.8',
    );

    const stored = readPreferences();
    expect(stored.imageConfirmPaste).toBe(false);
    expect(stored.imageNameTemplate).toBe('{note}-{time}');
    expect(stored.imageFormat).toBe('webp');
    expect(stored.imageFolder).toBe('image/screenshots');
    expect(stored.imageQuality).toBe(0.8);
  });

  it('persists auto-save and session preferences', () => {
    savePreferences(
      normalizePreferences({
        autoSave: true,
        autoSaveDelay: 2500,
        restoreSession: false,
      }),
    );

    expect(window.localStorage.getItem(AUTO_SAVE_STORAGE_KEY)).toBe('true');
    expect(window.localStorage.getItem(AUTO_SAVE_DELAY_STORAGE_KEY)).toBe(
      '2500',
    );
    expect(window.localStorage.getItem(RESTORE_SESSION_STORAGE_KEY)).toBe(
      'false',
    );

    const stored = readPreferences();
    expect(stored.autoSave).toBe(true);
    expect(stored.autoSaveDelay).toBe(2500);
    expect(stored.restoreSession).toBe(false);
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

  it('defaults and clamps minimap preferences', () => {
    const defaults = normalizePreferences({});
    expect(defaults.minimapEnabled).toBe(true);
    expect(defaults.minimapScale).toBe(1);
    expect(defaults.minimapMaxColumn).toBe(120);

    expect(
      normalizePreferences({ minimapEnabled: false }).minimapEnabled,
    ).toBe(false);
    expect(normalizePreferences({ minimapScale: 0 }).minimapScale).toBe(1);
    expect(normalizePreferences({ minimapScale: 9 }).minimapScale).toBe(3);
    expect(
      normalizePreferences({ minimapScale: '3' }).minimapScale,
    ).toBe(3);
    expect(
      normalizePreferences({ minimapMaxColumn: 1 }).minimapMaxColumn,
    ).toBe(20);
    expect(
      normalizePreferences({ minimapMaxColumn: 9999 }).minimapMaxColumn,
    ).toBe(200);
  });

  it('persists minimap preferences', () => {
    savePreferences(
      normalizePreferences({
        minimapEnabled: false,
        minimapScale: 3,
        minimapMaxColumn: 120,
      }),
    );

    expect(window.localStorage.getItem(MINIMAP_ENABLED_STORAGE_KEY)).toBe(
      'false',
    );
    expect(window.localStorage.getItem(MINIMAP_SCALE_STORAGE_KEY)).toBe('3');
    expect(
      window.localStorage.getItem(MINIMAP_MAX_COLUMN_STORAGE_KEY),
    ).toBe('120');

    const stored = readPreferences();
    expect(stored.minimapEnabled).toBe(false);
    expect(stored.minimapScale).toBe(3);
    expect(stored.minimapMaxColumn).toBe(120);
  });

  it('migrates the intermediate 2x/60 minimap defaults once', () => {
    window.localStorage.setItem(MINIMAP_SCALE_STORAGE_KEY, '2');
    window.localStorage.setItem(MINIMAP_MAX_COLUMN_STORAGE_KEY, '60');

    const migrated = readPreferences();
    expect(migrated.minimapScale).toBe(1);
    expect(migrated.minimapMaxColumn).toBe(120);
    expect(
      window.localStorage.getItem(MINIMAP_SCALE_STORAGE_KEY),
    ).toBeNull();
    expect(
      window.localStorage.getItem(MINIMAP_MAX_COLUMN_STORAGE_KEY),
    ).toBeNull();

    window.localStorage.setItem(MINIMAP_SCALE_STORAGE_KEY, '2');
    window.localStorage.setItem(MINIMAP_MAX_COLUMN_STORAGE_KEY, '60');
    const explicit = readPreferences();
    expect(explicit.minimapScale).toBe(2);
    expect(explicit.minimapMaxColumn).toBe(60);
  });
});
