import {
  customUiThemes,
  findCustomUiTheme,
} from './customThemes';
import { t, type TranslationKey } from './i18n';

export const THEMES = [
  { id: 'paper', labelKey: 'theme.paper' },
  { id: 'white', labelKey: 'theme.white' },
  { id: 'dark', labelKey: 'theme.dark' },
  { id: 'monokai', label: 'Monokai' },
  { id: 'vscode-light', label: 'VS Code Light+' },
  { id: 'vscode-dark', label: 'VS Code Dark+' },
  { id: 'vscode-hc', labelKey: 'theme.vscodeHc' },
] as const;

type BuiltInTheme = (typeof THEMES)[number];

export type BuiltInThemeId = BuiltInTheme['id'];
export type ThemeId = BuiltInThemeId | `custom-ui-${string}`;

export interface ThemeOption {
  id: ThemeId;
  label: string;
}

export const DEFAULT_THEME: BuiltInThemeId = 'paper';
export const THEME_STORAGE_KEY = 'inker-theme';
export const LEGACY_THEME_STORAGE_KEY = 'markleaf-theme';
const CUSTOM_THEME_STYLE_ID = 'inker-custom-ui-themes';

export function builtInThemeLabel(theme: BuiltInTheme): string {
  return 'labelKey' in theme
    ? t(theme.labelKey as TranslationKey)
    : theme.label;
}

export function isBuiltInThemeId(
  value: unknown,
): value is BuiltInThemeId {
  return (
    typeof value === 'string' &&
    THEMES.some((theme) => theme.id === value)
  );
}

export function isThemeId(value: unknown): value is ThemeId {
  return (
    isBuiltInThemeId(value) ||
    (typeof value === 'string' &&
      customUiThemes.value.some((theme) => theme.id === value))
  );
}

export function allThemes(): ThemeOption[] {
  return [
    ...THEMES.map((theme) => ({
      id: theme.id,
      label: builtInThemeLabel(theme),
    })),
    ...customUiThemes.value.map((theme) => ({
      id: theme.id as ThemeId,
      label: t('theme.custom', { name: theme.name }),
    })),
  ];
}

export function applyUiTheme(id: ThemeId): void {
  let style = document.getElementById(
    CUSTOM_THEME_STYLE_ID,
  ) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = CUSTOM_THEME_STYLE_ID;
    document.head.append(style);
  }

  const rules = customUiThemes.value
    .filter((theme) => /^custom-ui-[a-z0-9-]+$/i.test(theme.id))
    .map((theme) => {
      const declarations = Object.entries(theme.colors)
        .filter(
          ([key, value]) =>
            key.startsWith('--') &&
            !/[;{}]/.test(value) &&
            !/url\s*\(|@import/i.test(value),
        )
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n');
      return `:root[data-custom-theme="${theme.id}"] {\n${declarations}\n}`;
    })
    .join('\n');
  style.textContent = rules;

  const custom = findCustomUiTheme(id);
  if (custom) {
    const base = isBuiltInThemeId(custom.base)
      ? custom.base
      : DEFAULT_THEME;
    document.documentElement.dataset.theme = base;
    document.documentElement.dataset.customTheme = custom.id;
    return;
  }

  document.documentElement.dataset.theme = isBuiltInThemeId(id)
    ? id
    : DEFAULT_THEME;
  delete document.documentElement.dataset.customTheme;
}
