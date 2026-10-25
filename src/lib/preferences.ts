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
  isLanguagePreference,
  resolveLanguage,
  setLanguage,
  type LanguagePreference,
} from './i18n';
import {
  DEFAULT_THEME,
  LEGACY_THEME_STORAGE_KEY,
  THEME_STORAGE_KEY,
  applyUiTheme,
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
export const SOURCE_HIGHLIGHT_STORAGE_KEY = 'inker-source-highlight';
export const LANGUAGE_STORAGE_KEY = 'inker-language';
export const EXPORT_FORMAT_STORAGE_KEY = 'inker-export-format';
export const EXPORT_EMBED_IMAGES_STORAGE_KEY =
  'inker-export-embed-images';
export const EXPORT_OPEN_AFTER_STORAGE_KEY =
  'inker-export-open-after';
export const EXPORT_INCLUDE_TOC_STORAGE_KEY = 'inker-export-toc';
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
  sourceHighlight: boolean;
  language: LanguagePreference;
  exportFormat: ExportFormat;
  exportEmbedImages: boolean;
  exportOpenAfter: boolean;
  exportIncludeToc: boolean;
}

export type ExportFormat = 'pdf' | 'html' | 'docx';

export function isExportFormat(value: unknown): value is ExportFormat {
  return value === 'pdf' || value === 'html' || value === 'docx';
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
    sourceHighlight: source.sourceHighlight !== false,
    language: isLanguagePreference(source.language)
      ? source.language
      : 'system',
    exportFormat: isExportFormat(source.exportFormat)
      ? source.exportFormat
      : 'pdf',
    exportEmbedImages: source.exportEmbedImages !== false,
    exportOpenAfter: source.exportOpenAfter === true,
    exportIncludeToc: source.exportIncludeToc !== false,
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
    const rawSourceHighlight = window.localStorage.getItem(
      SOURCE_HIGHLIGHT_STORAGE_KEY,
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
      sourceHighlight:
        rawSourceHighlight === null
          ? true
          : rawSourceHighlight === 'true',
      language: window.localStorage.getItem(
        LANGUAGE_STORAGE_KEY,
      ) ?? undefined,
      exportFormat:
        window.localStorage.getItem(EXPORT_FORMAT_STORAGE_KEY) ??
        undefined,
      exportEmbedImages:
        window.localStorage.getItem(EXPORT_EMBED_IMAGES_STORAGE_KEY) ===
        null
          ? undefined
          : window.localStorage.getItem(
              EXPORT_EMBED_IMAGES_STORAGE_KEY,
            ) === 'true',
      exportOpenAfter:
        window.localStorage.getItem(EXPORT_OPEN_AFTER_STORAGE_KEY) ===
        'true',
      exportIncludeToc:
        window.localStorage.getItem(EXPORT_INCLUDE_TOC_STORAGE_KEY) ===
        null
          ? undefined
          : window.localStorage.getItem(
              EXPORT_INCLUDE_TOC_STORAGE_KEY,
            ) === 'true',
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
    window.localStorage.setItem(
      SOURCE_HIGHLIGHT_STORAGE_KEY,
      String(preferences.sourceHighlight),
    );
    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      preferences.language,
    );
    window.localStorage.setItem(
      EXPORT_FORMAT_STORAGE_KEY,
      preferences.exportFormat,
    );
    window.localStorage.setItem(
      EXPORT_EMBED_IMAGES_STORAGE_KEY,
      String(preferences.exportEmbedImages),
    );
    window.localStorage.setItem(
      EXPORT_OPEN_AFTER_STORAGE_KEY,
      String(preferences.exportOpenAfter),
    );
    window.localStorage.setItem(
      EXPORT_INCLUDE_TOC_STORAGE_KEY,
      String(preferences.exportIncludeToc),
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
  setLanguage(resolveLanguage(preferences.language));
  applyUiTheme(preferences.theme);
  document.documentElement.dataset.font = preferences.fontFamily;
  document.documentElement.style.setProperty(
    '--content-font-size',
    `${preferences.fontSize}px`,
  );
  applyCodeTheme(preferences.codeTheme);
}
