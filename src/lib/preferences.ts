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
  DEFAULT_IMAGE_FOLDER,
  DEFAULT_IMAGE_FORMAT,
  DEFAULT_IMAGE_NAME_TEMPLATE,
  DEFAULT_IMAGE_QUALITY,
  clampImageQuality,
  isImageFormat,
  type ImageFormat,
} from './imagePaste';
import { DEFAULT_VIM_MAPPINGS } from './vimMappings';
import {
  themePresetForPair,
  type ThemePresetValue,
} from './themePresets';
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
export const DEFAULT_AUTO_SAVE_DELAY = 1000;
export const MIN_AUTO_SAVE_DELAY = 300;
export const MAX_AUTO_SAVE_DELAY = 10000;
export const AUTO_SAVE_STORAGE_KEY = 'inker-auto-save';
export const AUTO_SAVE_DELAY_STORAGE_KEY = 'inker-auto-save-delay';
export const RESTORE_SESSION_STORAGE_KEY = 'inker-restore-session';
export const IMAGE_CONFIRM_STORAGE_KEY = 'inker-image-confirm';
export const IMAGE_TEMPLATE_STORAGE_KEY = 'inker-image-template';
export const IMAGE_FORMAT_STORAGE_KEY = 'inker-image-format';
export const IMAGE_FOLDER_STORAGE_KEY = 'inker-image-folder';
export const IMAGE_QUALITY_STORAGE_KEY = 'inker-image-quality';
export const VIM_MAPPINGS_STORAGE_KEY = 'inker-vim-mappings';
export const QUICK_OPEN_IMAGES_STORAGE_KEY = 'inker-quick-open-images';
export const FONT_SIZE_STORAGE_KEY = 'inker-font-size';
export const FONT_FAMILY_STORAGE_KEY = 'inker-font-family';
export const VIM_STORAGE_KEY = 'inker-vim';
export const IMMERSIVE_STORAGE_KEY = 'inker-immersive';
export const CODE_HIGHLIGHT_STORAGE_KEY = 'inker-code-highlight';
export const CODE_THEME_STORAGE_KEY = 'inker-code-theme';
export const SOURCE_HIGHLIGHT_STORAGE_KEY = 'inker-source-highlight';
export const LANGUAGE_STORAGE_KEY = 'inker-language';
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
  themePreset: ThemePresetValue;
  sourceHighlight: boolean;
  language: LanguagePreference;
  exportEmbedImages: boolean;
  exportOpenAfter: boolean;
  exportIncludeToc: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  restoreSession: boolean;
  imageConfirmPaste: boolean;
  imageNameTemplate: string;
  imageFormat: ImageFormat;
  imageFolder: string;
  imageQuality: number;
  vimMappings: string;
  quickOpenIncludeImages: boolean;
}

export function normalizeImageFolder(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

function normalizeImageTemplate(value: string): string {
  return value.trim() === '' ? DEFAULT_IMAGE_NAME_TEMPLATE : value;
}

export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FONT_SIZE;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(value)));
}

export function clampAutoSaveDelay(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AUTO_SAVE_DELAY;
  return Math.min(
    MAX_AUTO_SAVE_DELAY,
    Math.max(MIN_AUTO_SAVE_DELAY, Math.round(value)),
  );
}

export function normalizePreferences(value: unknown): Preferences {
  const source =
    value && typeof value === 'object'
      ? (value as Partial<Preferences>)
      : {};
  const theme = isThemeId(source.theme)
    ? source.theme
    : DEFAULT_THEME;
  const codeTheme = isCodeThemeId(source.codeTheme)
    ? source.codeTheme
    : DEFAULT_CODE_THEME;
  return {
    theme,
    themePreset: themePresetForPair(theme, codeTheme) ?? 'custom',
    fontSize: clampFontSize(Number(source.fontSize)),
    fontFamily: isFontId(source.fontFamily)
      ? source.fontFamily
      : DEFAULT_FONT,
    vimEnabled: source.vimEnabled === true,
    immersive: source.immersive === true,
    codeHighlight: source.codeHighlight !== false,
    codeTheme,
    sourceHighlight: source.sourceHighlight !== false,
    language: isLanguagePreference(source.language)
      ? source.language
      : 'system',
    exportEmbedImages: source.exportEmbedImages !== false,
    exportOpenAfter: source.exportOpenAfter === true,
    exportIncludeToc: source.exportIncludeToc === true,
    autoSave: source.autoSave === true,
    autoSaveDelay: clampAutoSaveDelay(Number(source.autoSaveDelay)),
    restoreSession: source.restoreSession !== false,
    imageConfirmPaste: source.imageConfirmPaste !== false,
    imageNameTemplate:
      typeof source.imageNameTemplate === 'string'
        ? normalizeImageTemplate(source.imageNameTemplate)
        : DEFAULT_IMAGE_NAME_TEMPLATE,
    imageFormat: isImageFormat(source.imageFormat)
      ? source.imageFormat
      : DEFAULT_IMAGE_FORMAT,
    imageFolder:
      typeof source.imageFolder === 'string'
        ? normalizeImageFolder(source.imageFolder)
        : DEFAULT_IMAGE_FOLDER,
    imageQuality: clampImageQuality(Number(source.imageQuality)),
    vimMappings:
      typeof source.vimMappings === 'string'
        ? source.vimMappings
        : DEFAULT_VIM_MAPPINGS,
    quickOpenIncludeImages: source.quickOpenIncludeImages === true,
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
    const rawAutoSave = window.localStorage.getItem(AUTO_SAVE_STORAGE_KEY);
    const rawAutoSaveDelay = window.localStorage.getItem(
      AUTO_SAVE_DELAY_STORAGE_KEY,
    );
    const rawRestoreSession = window.localStorage.getItem(
      RESTORE_SESSION_STORAGE_KEY,
    );
    const rawImageConfirm = window.localStorage.getItem(
      IMAGE_CONFIRM_STORAGE_KEY,
    );
    const rawImageTemplate = window.localStorage.getItem(
      IMAGE_TEMPLATE_STORAGE_KEY,
    );
    const rawImageFormat = window.localStorage.getItem(
      IMAGE_FORMAT_STORAGE_KEY,
    );
    const rawImageFolder = window.localStorage.getItem(
      IMAGE_FOLDER_STORAGE_KEY,
    );
    const rawImageQuality = window.localStorage.getItem(
      IMAGE_QUALITY_STORAGE_KEY,
    );
    const rawVimMappings = window.localStorage.getItem(
      VIM_MAPPINGS_STORAGE_KEY,
    );
    const rawQuickOpenImages = window.localStorage.getItem(
      QUICK_OPEN_IMAGES_STORAGE_KEY,
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
        'true',
      autoSave: rawAutoSave === null ? undefined : rawAutoSave === 'true',
      autoSaveDelay:
        rawAutoSaveDelay === null ? undefined : Number(rawAutoSaveDelay),
      restoreSession:
        rawRestoreSession === null
          ? undefined
          : rawRestoreSession === 'true',
      imageConfirmPaste:
        rawImageConfirm === null ? undefined : rawImageConfirm === 'true',
      imageNameTemplate:
        rawImageTemplate === null ? undefined : rawImageTemplate,
      imageFormat: rawImageFormat === null ? undefined : rawImageFormat,
      imageFolder: rawImageFolder === null ? undefined : rawImageFolder,
      imageQuality:
        rawImageQuality === null ? undefined : Number(rawImageQuality),
      vimMappings:
        rawVimMappings === null ? undefined : rawVimMappings,
      quickOpenIncludeImages:
        rawQuickOpenImages === null
          ? undefined
          : rawQuickOpenImages === 'true',
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
    window.localStorage.setItem(
      AUTO_SAVE_STORAGE_KEY,
      String(preferences.autoSave),
    );
    window.localStorage.setItem(
      AUTO_SAVE_DELAY_STORAGE_KEY,
      String(preferences.autoSaveDelay),
    );
    window.localStorage.setItem(
      RESTORE_SESSION_STORAGE_KEY,
      String(preferences.restoreSession),
    );
    window.localStorage.setItem(
      IMAGE_CONFIRM_STORAGE_KEY,
      String(preferences.imageConfirmPaste),
    );
    window.localStorage.setItem(
      IMAGE_TEMPLATE_STORAGE_KEY,
      preferences.imageNameTemplate,
    );
    window.localStorage.setItem(
      IMAGE_FORMAT_STORAGE_KEY,
      preferences.imageFormat,
    );
    window.localStorage.setItem(
      IMAGE_FOLDER_STORAGE_KEY,
      preferences.imageFolder,
    );
    window.localStorage.setItem(
      IMAGE_QUALITY_STORAGE_KEY,
      String(preferences.imageQuality),
    );
    window.localStorage.setItem(
      VIM_MAPPINGS_STORAGE_KEY,
      preferences.vimMappings,
    );
    window.localStorage.setItem(
      QUICK_OPEN_IMAGES_STORAGE_KEY,
      String(preferences.quickOpenIncludeImages),
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
