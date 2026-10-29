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
import { convertHljsCssToShikiTheme } from './legacyCodeTheme';

function customCodeTheme(
  name: string,
  background: string,
  foreground: string,
  css: string,
) {
  return {
    name,
    background,
    foreground,
    theme: convertHljsCssToShikiTheme({
      name,
      background,
      foreground,
      css,
    }),
    legacyCss: css,
  };
}

const SOURCE_SYNTAX_VARS = [
  '--code-syntax-keyword',
  '--code-syntax-number',
  '--code-syntax-string',
  '--code-syntax-comment',
  '--code-syntax-type',
  '--code-syntax-function',
  '--code-syntax-variable',
  '--code-syntax-operator',
  '--code-syntax-tag',
];

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
  for (const name of SOURCE_SYNTAX_VARS) {
    document.documentElement.style.removeProperty(name);
  }
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
    const theme = addCustomCodeTheme(
      customCodeTheme(
        'My Code',
        '#101010',
        '#eeeeee',
        '.hljs { color: #eeeeee; background: #101010; }',
      ),
    );

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
      document.documentElement.style.getPropertyValue('--code-syntax-keyword'),
    ).toBe('#eeeeee');

    const schema = createSettingsSchema(normalizePreferences({}));
    const options = schema.find(
      (setting) => setting.id === 'preview.codeTheme',
    )?.options;
    expect(options?.some((option) => option.value === theme.id)).toBe(
      true,
    );
  });

  it('derives source editor token colors from the code theme CSS', () => {
    const theme = addCustomCodeTheme(
      customCodeTheme(
        'Source Colors',
        '#101010',
        '#eeeeee',
        `
        .hljs { color: #eeeeee; background: #101010; }
        .hljs-keyword { color: #ff5555; }
        .hljs-string { color: #50fa7b; }
        .hljs-comment { color: #6272a4; }
        .hljs-title.function_ { color: #8be9fd; }
        .hljs-title.class_ { color: #f1fa8c; }
        .hljs-number { color: #bd93f9; }
        .hljs-variable { color: #ffb86c; }
        .hljs-operator { color: #f8f8f2; }
        .hljs-name { color: #ff79c6; }
      `,
      ),
    );

    applyCodeTheme(theme.id);
    const style = document.documentElement.style;

    expect(style.getPropertyValue('--code-syntax-keyword')).toBe(
      'rgb(255, 85, 85)',
    );
    expect(style.getPropertyValue('--code-syntax-string')).toBe(
      'rgb(80, 250, 123)',
    );
    expect(style.getPropertyValue('--code-syntax-comment')).toBe(
      'rgb(98, 114, 164)',
    );
    expect(style.getPropertyValue('--code-syntax-function')).toBe(
      'rgb(139, 233, 253)',
    );
    expect(style.getPropertyValue('--code-syntax-type')).toBe(
      'rgb(241, 250, 140)',
    );
    expect(style.getPropertyValue('--code-syntax-number')).toBe(
      'rgb(189, 147, 249)',
    );
    expect(style.getPropertyValue('--code-syntax-variable')).toBe(
      'rgb(255, 184, 108)',
    );
    expect(style.getPropertyValue('--code-syntax-operator')).toBe(
      'rgb(248, 248, 242)',
    );
    expect(style.getPropertyValue('--code-syntax-tag')).toBe(
      'rgb(255, 121, 198)',
    );
  });

  it('accepts custom theme ids in preferences and falls back after deletion', () => {
    const ui = addCustomUiTheme({
      name: 'Ocean',
      base: 'paper',
      colors: { '--accent': '#0000ff' },
    });
    const code = addCustomCodeTheme(
      customCodeTheme(
        'Code',
        '#000000',
        '#ffffff',
        '.hljs { color: #fff; background: #000; }',
      ),
    );

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
