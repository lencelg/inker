import { describe, expect, it } from 'vitest';
import { normalizePreferences } from './preferences';
import {
  createSettingsSchema,
  isSettingModified,
  matchesSetting,
} from './settingsSchema';

describe('settings schema', () => {
  it('maps preferences into the rendered setting values', () => {
    const schema = createSettingsSchema(
      normalizePreferences({
        theme: 'dark',
        fontSize: 20,
        fontFamily: 'fira-code',
        vimEnabled: true,
        immersive: true,
        codeHighlight: false,
      }),
    );

    expect(
      schema.find((setting) => setting.id === 'workbench.colorTheme')?.value,
    ).toBe('dark');
    expect(
      schema.find((setting) => setting.id === 'editor.fontSize')?.value,
    ).toBe(20);
    expect(
      schema.find((setting) => setting.id === 'editor.fontFamily')?.value,
    ).toBe('fira-code');
    expect(
      schema.find((setting) => setting.id === 'editor.vimMode')?.value,
    ).toBe(true);
    expect(
      schema.find((setting) => setting.id === 'preview.codeHighlight')?.value,
    ).toBe(false);
  });

  it('maps export preferences into the rendered setting values', () => {
    const schema = createSettingsSchema(
      normalizePreferences({
        exportEmbedImages: false,
        exportOpenAfter: true,
        exportIncludeToc: false,
      }),
    );

    expect(
      schema.find((setting) => setting.id === 'export.includeImages')?.value,
    ).toBe(false);
    expect(
      schema.find((setting) => setting.id === 'export.openAfterExport')?.value,
    ).toBe(true);
    expect(
      schema.find((setting) => setting.id === 'export.includeToc')?.value,
    ).toBe(false);
  });

  it('exposes auto-save and session settings', () => {
    const schema = createSettingsSchema(
      normalizePreferences({
        autoSave: true,
        autoSaveDelay: 2500,
        restoreSession: false,
      }),
    );

    const autoSave = schema.find(
      (setting) => setting.id === 'files.autoSave',
    );
    const autoSaveDelay = schema.find(
      (setting) => setting.id === 'files.autoSaveDelay',
    );
    const restoreSession = schema.find(
      (setting) => setting.id === 'workbench.restoreSession',
    );

    expect(autoSave?.value).toBe(true);
    expect(autoSave?.defaultValue).toBe(false);
    expect(autoSave?.preference).toBe('autoSave');
    expect(autoSaveDelay?.value).toBe(2500);
    expect(autoSaveDelay?.defaultValue).toBe(1000);
    expect(autoSaveDelay?.min).toBe(300);
    expect(autoSaveDelay?.max).toBe(10000);
    expect(autoSaveDelay?.preference).toBe('autoSaveDelay');
    expect(restoreSession?.value).toBe(false);
    expect(restoreSession?.defaultValue).toBe(true);
    expect(restoreSession?.preference).toBe('restoreSession');
  });

  it('searches auto-save settings by keywords', () => {
    const schema = createSettingsSchema(normalizePreferences({}));
    const autoSave = schema.find(
      (setting) => setting.id === 'files.autoSave',
    );

    expect(autoSave && matchesSetting(autoSave, '自动保存')).toBe(true);
    expect(autoSave && matchesSetting(autoSave, 'autosave')).toBe(true);
  });

  it('searches titles, descriptions and keywords', () => {
    const schema = createSettingsSchema(normalizePreferences({}));
    const vim = schema.find((setting) => setting.id === 'editor.vimMode');
    const fontSize = schema.find((setting) => setting.id === 'editor.fontSize');

    expect(vim && matchesSetting(vim, 'VIM')).toBe(true);
    expect(fontSize && matchesSetting(fontSize, '字号')).toBe(true);
    expect(fontSize && matchesSetting(fontSize, '不存在的设置')).toBe(false);
  });

  it('marks values that differ from their defaults', () => {
    const schema = createSettingsSchema(
      normalizePreferences({ fontSize: 22 }),
    );
    const fontSize = schema.find((setting) => setting.id === 'editor.fontSize');
    const theme = schema.find((setting) => setting.id === 'workbench.colorTheme');

    expect(fontSize && isSettingModified(fontSize)).toBe(true);
    expect(theme && isSettingModified(theme)).toBe(false);
  });
});
