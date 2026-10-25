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
        exportFormat: 'html',
        exportEmbedImages: false,
        exportOpenAfter: true,
        exportIncludeToc: false,
      }),
    );

    expect(
      schema.find((setting) => setting.id === 'export.defaultFormat')?.value,
    ).toBe('html');
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
