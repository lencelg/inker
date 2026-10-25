import { afterEach, describe, expect, it } from 'vitest';
import {
  addCustomCodeTheme,
  addCustomUiTheme,
  customCodeThemes,
  customUiThemes,
  removeCustomCodeTheme,
  removeCustomUiTheme,
} from './customThemes';
import { normalizePreferences } from './preferences';
import {
  allCodeThemes,
  applyCodeTheme,
  isCodeThemeId,
} from './codeThemes';
import {
  allThemes,
  applyUiTheme,
  isThemeId,
} from './themes';
import { createSettingsSchema } from './settingsSchema';

afterEach(() => {
  for (const theme of [...customUiThemes.value]) {
    removeCustomUiTheme(theme.id);
  }
  for (const theme of [...customCodeThemes.value]) {
    removeCustomCodeTheme(theme.id);
  }
  window.localStorage.clear();
  document.getElementById('inker-custom-ui-themes')?.remove();
  document.getElementById('inker-code-theme')?.remove();
  document.documentElement.removeAttribute('data-custom-theme');
  document.documentElement.style.removeProperty('--code-bg');
  document.documentElement.style.removeProperty('--code-fg');
});

describe('custom themes', () => {
  it('stores and applies custom UI themes over a built-in base', () => {
    const theme = addCustomUiTheme({
      name: 'Ocean',
      base: 'dark',
      colors: {
        '--accent': '#4ea1ff',
        '--bg': '#0b1220',
      },
    });

    expect(theme.id).toMatch(/^custom-ui-/);
    expect(isThemeId(theme.id)).toBe(true);
    expect(allThemes().some((item) => item.id === theme.id)).toBe(true);
    expect(
      window.localStorage.getItem('inker-custom-ui-themes'),
    ).toContain('Ocean');

    applyUiTheme(theme.id);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.customTheme).toBe(theme.id);
    expect(
      document.getElementById('inker-custom-ui-themes')?.textContent,
    ).toContain('--accent: #4ea1ff');

    const schema = createSettingsSchema(normalizePreferences({}));
    const options = schema.find(
      (setting) => setting.id === 'workbench.colorTheme',
    )?.options;
    expect(options?.some((option) => option.value === theme.id)).toBe(
      true,
    );
  });

  it('stores and applies custom code themes', () => {
    const theme = addCustomCodeTheme({
      name: 'My Code',
      background: '#101010',
      foreground: '#eeeeee',
      css: '.hljs { color: #eeeeee; background: #101010; }',
    });

    expect(theme.id).toMatch(/^custom-code-/);
    expect(isCodeThemeId(theme.id)).toBe(true);
    expect(
      allCodeThemes().some((item) => item.id === theme.id),
    ).toBe(true);

    applyCodeTheme(theme.id);

    expect(document.documentElement.dataset.codeTheme).toBe(theme.id);
    expect(
      document.documentElement.style.getPropertyValue('--code-bg'),
    ).toBe('#101010');
    expect(
      document.getElementById('inker-code-theme')?.textContent,
    ).toContain('.hljs');

    const schema = createSettingsSchema(normalizePreferences({}));
    const options = schema.find(
      (setting) => setting.id === 'preview.codeTheme',
    )?.options;
    expect(options?.some((option) => option.value === theme.id)).toBe(
      true,
    );
  });

  it('accepts custom theme ids in preferences and falls back after deletion', () => {
    const ui = addCustomUiTheme({
      name: 'Ocean',
      base: 'paper',
      colors: { '--accent': '#0000ff' },
    });
    const code = addCustomCodeTheme({
      name: 'Code',
      background: '#000000',
      foreground: '#ffffff',
      css: '.hljs { color: #fff; background: #000; }',
    });

    const preferences = normalizePreferences({
      theme: ui.id,
      codeTheme: code.id,
    });
    expect(preferences.theme).toBe(ui.id);
    expect(preferences.codeTheme).toBe(code.id);

    removeCustomUiTheme(ui.id);
    removeCustomCodeTheme(code.id);
    expect(isThemeId(ui.id)).toBe(false);
    expect(isCodeThemeId(code.id)).toBe(false);
    expect(normalizePreferences({ theme: ui.id }).theme).toBe('paper');
    expect(
      normalizePreferences({ codeTheme: code.id }).codeTheme,
    ).toBe('github-dark');
  });
});
