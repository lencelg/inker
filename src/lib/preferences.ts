import {
  DEFAULT_FONT,
  isFontId,
  type FontId,
} from './fonts';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isThemeId,
  type ThemeId,
} from './themes';

export const DEFAULT_FONT_SIZE = 15;
export const MIN_FONT_SIZE = 11;
export const MAX_FONT_SIZE = 28;
export const FONT_SIZE_STORAGE_KEY = 'markleaf-font-size';
export const FONT_FAMILY_STORAGE_KEY = 'markleaf-font-family';
export const VIM_STORAGE_KEY = 'markleaf-vim';
export const IMMERSIVE_STORAGE_KEY = 'markleaf-immersive';
export const CODE_HIGHLIGHT_STORAGE_KEY = 'markleaf-code-highlight';
export const PREFERENCES_EVENT = 'markleaf-preferences';
export const PREFERENCES_REQUEST_EVENT = 'markleaf-preferences-request';

export interface Preferences {
  theme: ThemeId;
  fontSize: number;
  fontFamily: FontId;
  vimEnabled: boolean;
  immersive: boolean;
  codeHighlight: boolean;
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
  };
}

export function readPreferences(): Preferences {
  try {
    const rawSize = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    const rawHighlight = window.localStorage.getItem(
      CODE_HIGHLIGHT_STORAGE_KEY,
    );
    return normalizePreferences({
      theme: window.localStorage.getItem(THEME_STORAGE_KEY),
      fontSize:
        rawSize === null ? DEFAULT_FONT_SIZE : Number(rawSize),
      fontFamily: window.localStorage.getItem(FONT_FAMILY_STORAGE_KEY),
      vimEnabled:
        window.localStorage.getItem(VIM_STORAGE_KEY) === 'true',
      immersive:
        window.localStorage.getItem(IMMERSIVE_STORAGE_KEY) === 'true',
      codeHighlight: rawHighlight === null ? true : rawHighlight === 'true',
    });
  } catch {
    return normalizePreferences({});
  }
}

export function savePreferences(preferences: Preferences): void {
  try {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      preferences.theme,
    );
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
}
