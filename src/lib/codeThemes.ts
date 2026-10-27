import { customCodeThemes } from './customThemes';
import { t } from './i18n';
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
const SOURCE_SYNTAX_CLASSES = {
  keyword: 'hljs-keyword',
  number: 'hljs-number',
  string: 'hljs-string',
  comment: 'hljs-comment',
  type: 'hljs-title class_',
  function: 'hljs-title function_',
  variable: 'hljs-variable',
  operator: 'hljs-operator',
  tag: 'hljs-tag hljs-name',
} as const;
let sourceColorKey = '';

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
      label: t('theme.custom', { name: theme.name }),
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

function applySourceSyntaxColors(theme: CodeThemeDefinition): void {
  if (typeof document === 'undefined' || !document.body) return;

  const root = document.documentElement;
  const key = `${theme.id}\u0000${theme.css}`;
  if (
    key === sourceColorKey &&
    root.style.getPropertyValue('--code-syntax-keyword') !== ''
  ) {
    return;
  }

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'absolute';
  host.style.left = '-9999px';
  host.style.top = '0';
  host.style.visibility = 'hidden';
  host.style.pointerEvents = 'none';

  const base = document.createElement('pre');
  base.className = 'hljs';
  base.style.color = theme.foreground;
  host.append(base);

  const samples: Array<[string, HTMLElement]> = [];
  for (const [name, className] of Object.entries(
    SOURCE_SYNTAX_CLASSES,
  )) {
    const sample = document.createElement('span');
    sample.className = className;
    base.append(sample);
    samples.push([name, sample]);
  }

  document.body.append(host);
  try {
    for (const [name, sample] of samples) {
      const color = getComputedStyle(sample).color;
      if (color) {
        root.style.setProperty(`--code-syntax-${name}`, color);
      }
    }
    sourceColorKey = key;
  } finally {
    host.remove();
  }
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
  applySourceSyntaxColors(theme);
}
