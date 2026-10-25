import {
  DEFAULT_CODE_THEME,
  applyCodeTheme,
  isCodeThemeId,
  type CodeThemeId,
} from './codeThemes';
import {
  DEFAULT_FONT,
  isFontId,
  type FontId,
} from './fonts';
import {
  DEFAULT_THEME,
  LEGACY_THEME_STORAGE_KEY,
  THEME_STORAGE_KEY,
  isThemeId,
  type ThemeId,
} from './themes';

export const DEFAULT_FONT_SIZE = 15;
export const MIN_FONT_SIZE = 11;
export const MAX_FONT_SIZE = 28;
export const FONT_SIZE_STORAGE_KEY = 'inker-font-size';
export const FONT_FAMILY_STORAGE_KEY = 'inker-font-family';
export const VIM_STORAGE_KEY = 'inker-vim';
export const IMMERSIVE_STORAGE_KEY = 'inker-immersive';
export const CODE_HIGHLIGHT_STORAGE_KEY = 'inker-code-highlight';
export const CODE_THEME_STORAGE_KEY = 'inker-code-theme';
const LEGACY_FONT_SIZE_STORAGE_KEY = 'markleaf-font-size';
const LEGACY_FONT_FAMILY_STORAGE_KEY = 'markleaf-font-family';
const LEGACY_VIM_STORAGE_KEY = 'markleaf-vim';
const LEGACY_IMMERSIVE_STORAGE_KEY = 'markleaf-immersive';
const LEGACY_CODE_HIGHLIGHT_STORAGE_KEY = 'markleaf-code-highlight';

export interface Preferences {
  theme: ThemeId;
  fontSize: number;
  fontFamily: FontId;
  vimEnabled: boolean;
  immersive: boolean;
  codeHighlight: boolean;
  codeTheme: CodeThemeId;
}

export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FONT_SIZE;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(value)));
}

export function normalizePreferences(value: unknown): Preferences {
  const source =
    value && typeof value === 'object'
      ? (value as Partial<Preferences>)
      : {};
  return {
    theme: isThemeId(source.theme) ? source.theme : DEFAULT_THEME,
    fontSize: clampFontSize(Number(source.fontSize)),
    fontFamily: isFontId(source.fontFamily)
      ? source.fontFamily
      : DEFAULT_FONT,
    vimEnabled: source.vimEnabled === true,
    immersive: source.immersive === true,
    codeHighlight: source.codeHighlight !== false,
    codeTheme: isCodeThemeId(source.codeTheme)
      ? source.codeTheme
      : DEFAULT_CODE_THEME,
  };
}

export function readPreferences(): Preferences {
  try {
    let usedLegacyKeys = false;
    const read = (key: string, legacyKey: string): string | null => {
      const current = window.localStorage.getItem(key);
      if (current !== null) return current;
      const legacy = window.localStorage.getItem(legacyKey);
      if (legacy !== null) usedLegacyKeys = true;
      return legacy;
    };

    const rawSize = read(
      FONT_SIZE_STORAGE_KEY,
      LEGACY_FONT_SIZE_STORAGE_KEY,
    );
    const rawHighlight = read(
      CODE_HIGHLIGHT_STORAGE_KEY,
      LEGACY_CODE_HIGHLIGHT_STORAGE_KEY,
    );
    const preferences = normalizePreferences({
      theme: read(THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY),
      fontSize: rawSize === null ? DEFAULT_FONT_SIZE : Number(rawSize),
      fontFamily: read(
        FONT_FAMILY_STORAGE_KEY,
        LEGACY_FONT_FAMILY_STORAGE_KEY,
      ),
      vimEnabled:
        read(VIM_STORAGE_KEY, LEGACY_VIM_STORAGE_KEY) === 'true',
      immersive:
        read(IMMERSIVE_STORAGE_KEY, LEGACY_IMMERSIVE_STORAGE_KEY) ===
        'true',
      codeHighlight:
        rawHighlight === null ? true : rawHighlight === 'true',
      codeTheme: window.localStorage.getItem(CODE_THEME_STORAGE_KEY),
    });

    if (usedLegacyKeys) savePreferences(preferences);
    return preferences;
  } catch {
    return normalizePreferences({});
  }
}

export function savePreferences(preferences: Preferences): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preferences.theme);
    window.localStorage.setItem(
      FONT_SIZE_STORAGE_KEY,
      String(preferences.fontSize),
    );
    window.localStorage.setItem(
      FONT_FAMILY_STORAGE_KEY,
      preferences.fontFamily,
    );
    window.localStorage.setItem(
      VIM_STORAGE_KEY,
      String(preferences.vimEnabled),
    );
    window.localStorage.setItem(
      IMMERSIVE_STORAGE_KEY,
      String(preferences.immersive),
    );
    window.localStorage.setItem(
      CODE_HIGHLIGHT_STORAGE_KEY,
      String(preferences.codeHighlight),
    );
    window.localStorage.setItem(
      CODE_THEME_STORAGE_KEY,
      preferences.codeTheme,
    );
    window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_FONT_SIZE_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_FONT_FAMILY_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_VIM_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_IMMERSIVE_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_CODE_HIGHLIGHT_STORAGE_KEY);
  } catch {
    // Persisting the preference is optional.
  }
}

export function applyPreferences(preferences: Preferences): void {
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.dataset.font = preferences.fontFamily;
  document.documentElement.style.setProperty(
    '--content-font-size',
    `${preferences.fontSize}px`,
  );
  applyCodeTheme(preferences.codeTheme);
}
