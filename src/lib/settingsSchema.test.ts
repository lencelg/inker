import { describe, expect, it } from 'vitest';
import { normalizePreferences } from './preferences';
import {
  createSettingsSchema,
  isSettingModified,
  matchesSetting,
  settingsCategories,
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

  it('exposes image settings in the images category', () => {
    const schema = createSettingsSchema(
      normalizePreferences({
        imageConfirmPaste: false,
        imageNameTemplate: '{note}',
        imageFormat: 'webp',
        imageFolder: 'image',
        imageQuality: 0.8,
      }),
    );

    const confirm = schema.find(
      (setting) => setting.id === 'images.confirmPaste',
    );
    const template = schema.find(
      (setting) => setting.id === 'images.nameTemplate',
    );
    const format = schema.find((setting) => setting.id === 'images.format');
    const folder = schema.find((setting) => setting.id === 'images.folder');
    const quality = schema.find((setting) => setting.id === 'images.quality');

    expect(confirm?.category).toBe('images');
    expect(confirm?.value).toBe(false);
    expect(confirm?.defaultValue).toBe(true);
    expect(confirm?.preference).toBe('imageConfirmPaste');

    expect(template?.controlType).toBe('text');
    expect(template?.value).toBe('{note}');
    expect(template?.defaultValue).toBe('{datetime}');
    expect(template?.preference).toBe('imageNameTemplate');

    expect(format?.controlType).toBe('select');
    expect(format?.value).toBe('webp');
    expect(format?.defaultValue).toBe('png');
    expect(format?.options?.map((option) => option.value)).toEqual([
      'png',
      'jpeg',
      'webp',
    ]);

    expect(folder?.controlType).toBe('text');
    expect(folder?.value).toBe('image');
    expect(folder?.defaultValue).toBe('assets');

    expect(quality?.controlType).toBe('input');
    expect(quality?.value).toBe(0.8);
    expect(quality?.defaultValue).toBe(0.92);
    expect(quality?.min).toBe(0.1);
    expect(quality?.max).toBe(1);
  });

  it('exposes the quick open images setting', () => {
    const schema = createSettingsSchema(
      normalizePreferences({ quickOpenIncludeImages: true }),
    );
    const item = schema.find(
      (setting) => setting.id === 'workbench.quickOpenImages',
    );

    expect(item?.category).toBe('common');
    expect(item?.controlType).toBe('checkbox');
    expect(item?.value).toBe(true);
    expect(item?.defaultValue).toBe(false);
    expect(item?.preference).toBe('quickOpenIncludeImages');
  });

  it('exposes configurable Vim mappings', () => {
    const schema = createSettingsSchema(normalizePreferences({}));
    const item = schema.find(
      (setting) => setting.id === 'editor.vimMappings',
    );

    expect(item?.category).toBe('editor');
    expect(item?.controlType).toBe('textarea');
    expect(item?.defaultValue).toBe('normal <Space>p pasteimage');
    expect(item?.value).toBe('normal <Space>p pasteimage');
    expect(item?.preference).toBe('vimMappings');
    expect(item && matchesSetting(item, 'pasteimage')).toBe(true);
  });

  it('includes a dedicated images category', () => {
    expect(settingsCategories().map((category) => category.id)).toContain(
      'images',
    );
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
