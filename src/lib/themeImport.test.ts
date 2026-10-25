import { beforeEach, describe, expect, it } from 'vitest';
import { setLanguage } from './i18n';
import {
  MAX_THEME_FILE_BYTES,
  parseCodeThemeFile,
  parseUiThemeFile,
} from './themeImport';

const uiTheme = JSON.stringify({
  version: 1,
  name: 'Ocean Dark',
  base: 'dark',
  colors: {
    '--bg': '#0b1220',
    '--panel': '#152238',
    '--ink': '#e6edf7',
    '--accent': '#4ea1ff',
  },
});

const codeTheme = `
.hljs {
  color: #d8dee9;
  background: #2e3440;
}
.hljs-keyword {
  color: #81a1c1;
}
body {
  color: red;
}
`;

beforeEach(() => {
  setLanguage('zh');
});

describe('theme import', () => {
  it('parses a valid UI theme JSON file', () => {
    const theme = parseUiThemeFile(uiTheme);

    expect(theme.name).toBe('Ocean Dark');
    expect(theme.base).toBe('dark');
    expect(theme.colors['--accent']).toBe('#4ea1ff');
    expect(Object.keys(theme.colors)).toHaveLength(4);
  });

  it('rejects invalid UI theme files and color tokens', () => {
    expect(() =>
      parseUiThemeFile(JSON.stringify({ name: 'Bad', base: 'dark' })),
    ).toThrow('colors');
    expect(() =>
      parseUiThemeFile(
        JSON.stringify({ name: 'Bad', base: 'missing', colors: { '--bg': '#fff' } }),
      ),
    ).toThrow('base');
    expect(() =>
      parseUiThemeFile(
        JSON.stringify({ name: 'Bad', base: 'dark', colors: { '--shadow': '#fff' } }),
      ),
    ).toThrow('不支持的界面主题变量');
    expect(() =>
      parseUiThemeFile(
        JSON.stringify({
          name: 'Bad',
          base: 'dark',
          colors: { '--bg': 'url(https://example.com/a.png)' },
        }),
      ),
    ).toThrow('颜色值无效');
  });

  it('sanitizes highlight.js CSS and extracts its base colors', () => {
    const theme = parseCodeThemeFile(codeTheme, 'nord-custom.min.css');

    expect(theme.name).toBe('nord-custom');
    expect(theme.background).toBeTruthy();
    expect(theme.foreground).toBeTruthy();
    expect(theme.css).toContain('.hljs-keyword');
    expect(theme.css).not.toContain('body');
    expect(theme.css).not.toContain('url(');
  });

  it('rejects unsafe or incomplete code themes', () => {
    expect(() =>
      parseCodeThemeFile('@import url("x.css");', 'bad.css'),
    ).toThrow('@import');
    expect(() =>
      parseCodeThemeFile(
        '.hljs { color: #fff; background: url(x); }',
        'bad.css',
      ),
    ).toThrow();
    expect(() =>
      parseCodeThemeFile('.hljs-keyword { color: red; }', 'bad.css'),
    ).toThrow('background');
    expect(() =>
      parseCodeThemeFile(
        `x${'a'.repeat(MAX_THEME_FILE_BYTES)}`,
        'huge.css',
      ),
    ).toThrow('文件过大');
  });
});
