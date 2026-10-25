import { ref } from 'vue';
import { t } from './i18n';

export type CustomUiThemeId = `custom-ui-${string}`;
export type CustomCodeThemeId = `custom-code-${string}`;

export interface CustomUiTheme {
  id: CustomUiThemeId;
  name: string;
  base: string;
  colors: Record<string, string>;
}

export interface CustomCodeTheme {
  id: CustomCodeThemeId;
  name: string;
  background: string;
  foreground: string;
  css: string;
}

export const CUSTOM_UI_THEMES_STORAGE_KEY = 'inker-custom-ui-themes';
export const CUSTOM_CODE_THEMES_STORAGE_KEY = 'inker-custom-code-themes';
export const MAX_CUSTOM_THEMES = 20;

const UI_THEME_ID_PREFIX = 'custom-ui-';
const CODE_THEME_ID_PREFIX = 'custom-code-';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function isUiTheme(value: unknown): value is CustomUiTheme {
  if (!value || typeof value !== 'object') return false;
  const theme = value as Partial<CustomUiTheme>;
  return (
    typeof theme.id === 'string' &&
    theme.id.startsWith(UI_THEME_ID_PREFIX) &&
    typeof theme.name === 'string' &&
    typeof theme.base === 'string' &&
    !!theme.colors &&
    typeof theme.colors === 'object' &&
    Object.entries(theme.colors).every(
      ([key, color]) =>
        key.startsWith('--') && typeof color === 'string',
    )
  );
}

function isCodeTheme(value: unknown): value is CustomCodeTheme {
  if (!value || typeof value !== 'object') return false;
  const theme = value as Partial<CustomCodeTheme>;
  return (
    typeof theme.id === 'string' &&
    theme.id.startsWith(CODE_THEME_ID_PREFIX) &&
    typeof theme.name === 'string' &&
    typeof theme.background === 'string' &&
    typeof theme.foreground === 'string' &&
    typeof theme.css === 'string'
  );
}

function readList<T>(
  key: string,
  guard: (value: unknown) => value is T,
): T[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(guard).slice(0, MAX_CUSTOM_THEMES);
  } catch {
    return [];
  }
}

function writeList(key: string, value: unknown[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is optional; the in-memory list still works.
  }
}

function createThemeId(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 10)}`;
  return `${prefix}${suffix}`;
}

function createUiThemeId(): CustomUiThemeId {
  return createThemeId(UI_THEME_ID_PREFIX) as CustomUiThemeId;
}

function createCodeThemeId(): CustomCodeThemeId {
  return createThemeId(CODE_THEME_ID_PREFIX) as CustomCodeThemeId;
}

export const customUiThemes = ref<CustomUiTheme[]>(
  readList(CUSTOM_UI_THEMES_STORAGE_KEY, isUiTheme),
);
export const customCodeThemes = ref<CustomCodeTheme[]>(
  readList(CUSTOM_CODE_THEMES_STORAGE_KEY, isCodeTheme),
);

export function findCustomUiTheme(
  id: string,
): CustomUiTheme | undefined {
  return customUiThemes.value.find((theme) => theme.id === id);
}

export function findCustomCodeTheme(
  id: string,
): CustomCodeTheme | undefined {
  return customCodeThemes.value.find((theme) => theme.id === id);
}

export function addCustomUiTheme(
  theme: Omit<CustomUiTheme, 'id'>,
): CustomUiTheme {
  if (customUiThemes.value.length >= MAX_CUSTOM_THEMES) {
    throw new Error(
      t('themeImport.error.limitUi', { count: MAX_CUSTOM_THEMES }),
    );
  }
  const next: CustomUiTheme = {
    ...theme,
    id: createUiThemeId(),
  };
  customUiThemes.value = [...customUiThemes.value, next];
  writeList(CUSTOM_UI_THEMES_STORAGE_KEY, customUiThemes.value);
  return next;
}

export function addCustomCodeTheme(
  theme: Omit<CustomCodeTheme, 'id'>,
): CustomCodeTheme {
  if (customCodeThemes.value.length >= MAX_CUSTOM_THEMES) {
    throw new Error(
      t('themeImport.error.limitCode', { count: MAX_CUSTOM_THEMES }),
    );
  }
  const next: CustomCodeTheme = {
    ...theme,
    id: createCodeThemeId(),
  };
  customCodeThemes.value = [...customCodeThemes.value, next];
  writeList(CUSTOM_CODE_THEMES_STORAGE_KEY, customCodeThemes.value);
  return next;
}

export function removeCustomUiTheme(id: string): void {
  customUiThemes.value = customUiThemes.value.filter(
    (theme) => theme.id !== id,
  );
  writeList(CUSTOM_UI_THEMES_STORAGE_KEY, customUiThemes.value);
}

export function removeCustomCodeTheme(id: string): void {
  customCodeThemes.value = customCodeThemes.value.filter(
    (theme) => theme.id !== id,
  );
  writeList(CUSTOM_CODE_THEMES_STORAGE_KEY, customCodeThemes.value);
}
