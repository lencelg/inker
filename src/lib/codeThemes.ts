import { customCodeThemes } from './customThemes';
import githubDarkCss from 'highlight.js/styles/github-dark.css?raw';
import githubLightCss from 'highlight.js/styles/github.css?raw';
import atomOneDarkCss from 'highlight.js/styles/atom-one-dark.css?raw';
import monokaiCss from 'highlight.js/styles/monokai.css?raw';
import nordCss from 'highlight.js/styles/nord.css?raw';
import tokyoNightCss from 'highlight.js/styles/tokyo-night-dark.css?raw';
import vsDarkCss from 'highlight.js/styles/vs2015.css?raw';

export const CODE_THEMES = [
  {
    id: 'github-dark',
    label: 'GitHub Dark',
    background: '#0d1117',
    foreground: '#c9d1d9',
    css: githubDarkCss,
  },
  {
    id: 'github-light',
    label: 'GitHub Light',
    background: '#ffffff',
    foreground: '#24292e',
    css: githubLightCss,
  },
  {
    id: 'atom-one-dark',
    label: 'Atom One Dark',
    background: '#282c34',
    foreground: '#abb2bf',
    css: atomOneDarkCss,
  },
  {
    id: 'monokai',
    label: 'Monokai',
    background: '#272822',
    foreground: '#f8f8f2',
    css: monokaiCss,
  },
  {
    id: 'nord',
    label: 'Nord',
    background: '#2e3440',
    foreground: '#d8dee9',
    css: nordCss,
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    background: '#1a1b26',
    foreground: '#9aa5ce',
    css: tokyoNightCss,
  },
  {
    id: 'vs-dark',
    label: 'VS Dark',
    background: '#1e1e1e',
    foreground: '#dcdcdc',
    css: vsDarkCss,
  },
] as const;

export type BuiltInCodeThemeId = (typeof CODE_THEMES)[number]['id'];
export type CodeThemeId =
  | BuiltInCodeThemeId
  | `custom-code-${string}`;

export interface CodeThemeDefinition {
  id: CodeThemeId;
  label: string;
  background: string;
  foreground: string;
  css: string;
  custom?: boolean;
}

export const DEFAULT_CODE_THEME: BuiltInCodeThemeId = 'github-dark';
const CODE_THEME_STYLE_ID = 'inker-code-theme';

export function isBuiltInCodeThemeId(
  value: unknown,
): value is BuiltInCodeThemeId {
  return (
    typeof value === 'string' &&
    CODE_THEMES.some((theme) => theme.id === value)
  );
}

export function isCodeThemeId(value: unknown): value is CodeThemeId {
  return (
    isBuiltInCodeThemeId(value) ||
    (typeof value === 'string' &&
      customCodeThemes.value.some((theme) => theme.id === value))
  );
}

export function allCodeThemes(): CodeThemeDefinition[] {
  return [
    ...CODE_THEMES.map((theme) => ({
      ...theme,
      id: theme.id as CodeThemeId,
    })),
    ...customCodeThemes.value.map((theme) => ({
      ...theme,
      id: theme.id as CodeThemeId,
      label: `${theme.name}（自定义）`,
      custom: true,
    })),
  ];
}

export function codeThemeById(id: CodeThemeId): CodeThemeDefinition {
  return (
    allCodeThemes().find((theme) => theme.id === id) ??
    CODE_THEMES[0]
  );
}

export function applyCodeTheme(id: CodeThemeId): void {
  const theme = codeThemeById(id);
  let style = document.getElementById(
    CODE_THEME_STYLE_ID,
  ) as HTMLStyleElement | null;

  if (!style) {
    style = document.createElement('style');
    style.id = CODE_THEME_STYLE_ID;
    document.head.append(style);
  }
  if (style.textContent !== theme.css) {
    style.textContent = theme.css;
  }

  document.documentElement.style.setProperty(
    '--code-bg',
    theme.background,
  );
  document.documentElement.style.setProperty(
    '--code-fg',
    theme.foreground,
  );
  document.documentElement.dataset.codeTheme = theme.id;
}
