import type { ThemeRegistrationAny } from '@shikijs/types';
import {
  BUILTIN_CODE_THEME_REGISTRATIONS,
  type BuiltInCodeThemeId,
} from './codeThemeRegistrations';

import { customCodeThemes, type CustomCodeTheme } from './customThemes';
import { t } from './i18n';
import { useCodeTheme } from './shikiHighlighter';
import {
  deriveSyntaxPalette,
  type SyntaxPalette,
} from './themePalette';

export interface CodeThemeDefinition {
  id: CodeThemeId;
  label: string;
  background: string;
  foreground: string;
  shikiTheme: ThemeRegistrationAny;
  shikiThemeName: string;
  palette: SyntaxPalette;
  legacyCss?: string;
  custom?: boolean;
}

export type { BuiltInCodeThemeId } from './codeThemeRegistrations';

export type CodeThemeId =
  | BuiltInCodeThemeId
  | `custom-code-${string}`;

export const DEFAULT_CODE_THEME: BuiltInCodeThemeId = 'github-dark';

function themeName(theme: ThemeRegistrationAny, fallback: string): string {
  return typeof theme.name === 'string' && theme.name
    ? theme.name
    : fallback;
}

function makeTheme(
  id: BuiltInCodeThemeId,
  label: string,
  shikiTheme: ThemeRegistrationAny,
): CodeThemeDefinition {
  const palette = deriveSyntaxPalette(shikiTheme);
  return {
    id,
    label,
    background: palette.background,
    foreground: palette.foreground,
    shikiTheme,
    shikiThemeName: themeName(shikiTheme, id),
    palette,
  };
}

export const CODE_THEMES: readonly CodeThemeDefinition[] =
  BUILTIN_CODE_THEME_REGISTRATIONS.map((registration) =>
    makeTheme(
      registration.id,
      registration.label,
      registration.theme,
    ),
  );

const customPaletteCache = new WeakMap<CustomCodeTheme, SyntaxPalette>();

const BUILT_IN_IDS = new Set<string>(
  CODE_THEMES.map((theme) => theme.id),
);

export function isBuiltInCodeThemeId(
  value: unknown,
): value is BuiltInCodeThemeId {
  return typeof value === 'string' && BUILT_IN_IDS.has(value);
}

export function isCodeThemeId(value: unknown): value is CodeThemeId {
  return (
    isBuiltInCodeThemeId(value) ||
    (typeof value === 'string' &&
      customCodeThemes.value.some((theme) => theme.id === value))
  );
}

function customDefinition(theme: CustomCodeTheme): CodeThemeDefinition {
  const shikiThemeName = `custom:${theme.id}`;
  let palette = customPaletteCache.get(theme);
  if (!palette) {
    palette = deriveSyntaxPalette(theme.theme);
    customPaletteCache.set(theme, palette);
  }
  return {
    id: theme.id,
    label: t('theme.custom', { name: theme.name }),
    background: theme.background,
    foreground: theme.foreground,
    shikiTheme: theme.theme,
    shikiThemeName,
    palette,
    legacyCss: theme.legacyCss,
    custom: true,
  };
}

export function allCodeThemes(): CodeThemeDefinition[] {
  return [
    ...CODE_THEMES,
    ...customCodeThemes.value.map(customDefinition),
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
  const root = document.documentElement;
  for (const [name, color] of Object.entries(theme.palette.colors)) {
    root.style.setProperty(`--code-syntax-${name}`, color);
  }
  root.style.setProperty('--code-bg', theme.background);
  root.style.setProperty('--code-fg', theme.foreground);
  root.dataset.codeTheme = theme.id;
  root.dataset.codeThemeType = theme.palette.type;
  useCodeTheme(theme);
}
