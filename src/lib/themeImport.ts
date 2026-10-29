import type { ThemeRegistration } from '@shikijs/types';
import { isBuiltInThemeId, type BuiltInThemeId } from './themes';
import { t } from './i18n';
import { convertHljsCssToShikiTheme } from './legacyCodeTheme';

export const MAX_THEME_FILE_BYTES = 256 * 1024;

export const UI_THEME_COLOR_TOKENS = [
  '--bg',
  '--bg-soft',
  '--panel',
  '--ink',
  '--muted',
  '--faint',
  '--border',
  '--accent',
  '--accent-strong',
  '--accent-soft',
  '--leaf',
  '--leaf-strong',
  '--warning',
  '--warning-soft',
  '--error',
  '--error-soft',
  '--error-border',
  '--success',
  '--success-soft',
  '--draft-soft',
  '--body-glow',
  '--sidebar-bg',
  '--overlay',
  '--hover',
  '--hover-strong',
  '--btn-hover-bg',
  '--btn-hover-border',
  '--primary-bg',
  '--primary-bg-hover',
  '--primary-ink',
  '--danger-bg',
  '--danger-bg-hover',
  '--danger-ink',
  '--blockquote-border',
  '--code-inline-bg',
  '--editor-active-line',
  '--editor-active-line-gutter',
  '--editor-selection',
  '--focus-ring',
  '--folder-icon',
  '--activity-bg',
  '--activity-icon',
  '--activity-icon-hover',
  '--activity-icon-active',
  '--activity-active-bg',
  '--activity-hover',
  '--statusbar-bg',
  '--statusbar-ink',
  '--statusbar-muted',
  '--statusbar-hover',
  '--statusbar-border',
  '--statusbar-border-soft',
  '--syntax-keyword',
  '--syntax-string',
  '--syntax-comment',
  '--syntax-number',
  '--syntax-type',
  '--syntax-function',
  '--syntax-variable',
  '--syntax-operator',
  '--syntax-tag',
  '--syntax-heading',
  '--syntax-link',
  '--syntax-quote',
  '--syntax-invalid',
] as const;

const UI_THEME_TOKEN_SET = new Set<string>(UI_THEME_COLOR_TOKENS);
const UNSAFE_CSS_VALUE = /url\s*\(|@import|expression\s*\(|javascript:/i;
const UNSAFE_CSS_COLOR =
  /var\s*\(|currentColor|inherit|initial|unset|revert/i;
const CODE_THEME_PROPERTIES = [
  'color',
  'background-color',
  'font-style',
  'font-weight',
  'text-decoration',
  'text-decoration-color',
  'opacity',
] as const;

export interface ParsedUiTheme {
  name: string;
  base: BuiltInThemeId;
  colors: Record<string, string>;
}

export interface ParsedCodeTheme {
  name: string;
  background: string;
  foreground: string;
  theme: ThemeRegistration;
  legacyCss?: string;
}

function checkFileSize(text: string): void {
  if (new TextEncoder().encode(text).length > MAX_THEME_FILE_BYTES) {
    throw new Error(t('themeImport.error.tooLarge'));
  }
}

function isCssColor(value: string): boolean {
  const candidate = value.trim();
  if (
    !candidate ||
    UNSAFE_CSS_VALUE.test(candidate) ||
    UNSAFE_CSS_COLOR.test(candidate)
  ) {
    return false;
  }
  const probe = document.createElement('span');
  probe.style.color = '';
  probe.style.color = candidate;
  return probe.style.color !== '';
}

function themeName(value: string, fallback: string): string {
  const name = value.trim() || fallback;
  if (!name) throw new Error(t('themeImport.error.nameEmpty'));
  if (name.length > 60) {
    throw new Error(t('themeImport.error.nameTooLong'));
  }
  return name;
}

export function parseUiThemeFile(text: string): ParsedUiTheme {
  checkFileSize(text);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(t('themeImport.error.invalidJson'));
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(t('themeImport.error.invalidFormat'));
  }

  const source = raw as {
    version?: unknown;
    name?: unknown;
    base?: unknown;
    colors?: unknown;
  };
  if (
    source.version !== undefined &&
    source.version !== 1
  ) {
    throw new Error(t('themeImport.error.unsupportedVersion'));
  }
  if (typeof source.name !== 'string') {
    throw new Error(t('themeImport.error.missingName'));
  }
  if (!isBuiltInThemeId(source.base)) {
    throw new Error(t('themeImport.error.invalidBase'));
  }
  if (
    !source.colors ||
    typeof source.colors !== 'object' ||
    Array.isArray(source.colors)
  ) {
    throw new Error(t('themeImport.error.missingColors'));
  }

  const colors: Record<string, string> = {};
  for (const [key, value] of Object.entries(source.colors)) {
    if (!UI_THEME_TOKEN_SET.has(key)) {
      throw new Error(
        t('themeImport.error.unsupportedVariable', { key }),
      );
    }
    if (typeof value !== 'string' || !isCssColor(value)) {
      throw new Error(
        t('themeImport.error.invalidColor', { key }),
      );
    }
    colors[key] = value.trim();
  }
  if (Object.keys(colors).length === 0) {
    throw new Error(t('themeImport.error.noColors'));
  }

  return {
    name: themeName(source.name, ''),
    base: source.base,
    colors,
  };
}

function parseLegacyCssThemeFile(
  text: string,
  fileName: string,
): ParsedCodeTheme {
  checkFileSize(text);
  if (UNSAFE_CSS_VALUE.test(text)) {
    throw new Error(t('themeImport.error.externalResource'));
  }

  const style = document.createElement('style');
  style.textContent = text;
  document.head.append(style);

  try {
    const sheet = style.sheet;
    if (!sheet) throw new Error(t('themeImport.error.parseCss'));

    const cssParts: string[] = [];
    let background = '';
    let foreground = '';

    for (const rule of Array.from(sheet.cssRules)) {
      if (
        !('selectorText' in rule) ||
        !('style' in rule)
      ) {
        continue;
      }

      const ruleStyle = (rule as CSSStyleRule).style;
      const selectors = (rule as CSSStyleRule).selectorText
        .split(',')
        .map((selector: string) => selector.trim())
        .filter((selector: string) => selector.startsWith('.hljs'));
      if (selectors.length === 0) continue;

      if (selectors.includes('.hljs')) {
        const nextBackground =
          ruleStyle.getPropertyValue('background-color') ||
          ruleStyle.getPropertyValue('background');
        const nextForeground = ruleStyle.getPropertyValue('color');
        if (nextBackground && isCssColor(nextBackground)) {
          background = nextBackground;
        }
        if (nextForeground && isCssColor(nextForeground)) {
          foreground = nextForeground;
        }
      }

      const declarations = CODE_THEME_PROPERTIES.map((property) => {
        const value = ruleStyle.getPropertyValue(property);
        if (!value || UNSAFE_CSS_VALUE.test(value)) return '';
        return `${property}: ${value};`;
      })
        .filter(Boolean)
        .join(' ');
      if (declarations) {
        cssParts.push(
          `${selectors.join(', ')} { ${declarations} }`,
        );
      }
    }

    if (!background || !foreground) {
      throw new Error(t('themeImport.error.missingBaseColors'));
    }
    if (cssParts.length === 0) {
      throw new Error(t('themeImport.error.noRules'));
    }

    const fallback = fileName
      .replace(/\.css$/i, '')
      .replace(/\.min$/i, '')
      .trim();
    const name = themeName('', fallback || 'Custom Code Theme');
    const css = cssParts.join('\n');
    return {
      name,
      background,
      foreground,
      theme: convertHljsCssToShikiTheme({
        name,
        background,
        foreground,
        css,
      }),
      legacyCss: css,
    };
  } finally {
    style.remove();
  }
}

function normalizeJsonc(text: string): string {
  let output = '';
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (lineComment) {
      if (character === '\n') {
        lineComment = false;
        output += character;
      }
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (inString) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    output += character;
  }

  let cleaned = '';
  inString = false;
  escaped = false;
  for (let index = 0; index < output.length; index += 1) {
    const character = output[index];
    if (inString) {
      cleaned += character;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      cleaned += character;
      continue;
    }
    if (character === ',') {
      let nextIndex = index + 1;
      while (/\s/.test(output[nextIndex] ?? '')) nextIndex += 1;
      if (output[nextIndex] === '}' || output[nextIndex] === ']') {
        continue;
      }
    }
    cleaned += character;
  }
  return cleaned;
}

function inferDark(background: string): boolean {
  const hex = /^#([0-9a-f]{6})$/i.exec(background)?.[1];
  if (!hex) return true;
  const value = Number.parseInt(hex, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function parseVsCodeThemeFile(
  text: string,
  fileName: string,
): ParsedCodeTheme {
  checkFileSize(text);
  let raw: unknown;
  try {
    raw = JSON.parse(normalizeJsonc(text));
  } catch {
    throw new Error(t('themeImport.error.invalidJson'));
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(t('themeImport.error.invalidFormat'));
  }

  const source = raw as {
    name?: unknown;
    type?: unknown;
    colors?: unknown;
    tokenColors?: unknown;
    settings?: unknown;
  };
  const fallback = fileName
    .replace(/\.(?:json|jsonc)$/i, '')
    .trim();
  const name = themeName(
    typeof source.name === 'string' ? source.name : '',
    fallback || 'Custom Code Theme',
  );

  const colors: Record<string, string> = {};
  if (source.colors && typeof source.colors === 'object' && !Array.isArray(source.colors)) {
    for (const [key, value] of Object.entries(source.colors as Record<string, unknown>)) {
      if (typeof value !== 'string' || !isCssColor(value)) continue;
      colors[key] = value.trim();
    }
  }

  const rawRules = Array.isArray(source.tokenColors)
    ? source.tokenColors
    : Array.isArray(source.settings)
      ? source.settings
      : null;
  if (!rawRules) {
    throw new Error(t('themeImport.error.invalidFormat'));
  }
  if (rawRules.length > 2000) {
    throw new Error(t('themeImport.error.tooManyTokenRules'));
  }

  const tokenColors = rawRules
    .map((rule) => {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return null;
      const item = rule as {
        scope?: unknown;
        settings?: unknown;
      };
      if (!item.settings || typeof item.settings !== 'object') return null;
      const settings = item.settings as {
        foreground?: unknown;
        fontStyle?: unknown;
      };
      const foreground =
        typeof settings.foreground === 'string' && isCssColor(settings.foreground)
          ? settings.foreground.trim()
          : undefined;
      const fontStyle =
        typeof settings.fontStyle === 'string' &&
        /^[a-z\s]+$/i.test(settings.fontStyle)
          ? settings.fontStyle.trim()
          : undefined;
      if (!foreground && !fontStyle) return null;

      let scope: string[] | undefined;
      if (typeof item.scope === 'string') {
        scope = item.scope
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0 && value.length <= 200);
      } else if (Array.isArray(item.scope)) {
        scope = item.scope
          .filter((value): value is string => typeof value === 'string')
          .flatMap((value) => value.split(','))
          .map((value) => value.trim())
          .filter((value) => value.length > 0 && value.length <= 200)
          .slice(0, 200);
      }
      if (!scope || scope.length === 0) return null;
      return {
        scope,
        settings: {
          ...(foreground ? { foreground } : {}),
          ...(fontStyle ? { fontStyle } : {}),
        },
      };
    })
    .filter((rule): rule is NonNullable<typeof rule> => rule !== null);

  if (tokenColors.length === 0) {
    throw new Error(t('themeImport.error.noRules'));
  }

  const fallbackBackground = inferDark(colors['editor.background'] ?? '')
    ? '#1e1e1e'
    : '#ffffff';
  const background =
    colors['editor.background'] ?? fallbackBackground;
  const foreground =
    colors['editor.foreground'] ??
    (inferDark(background) ? '#d4d4d4' : '#1f2328');
  const type =
    source.type === 'light'
      ? 'light'
      : source.type === 'hc'
        ? 'dark'
        : inferDark(background)
          ? 'dark'
          : 'light';

  return {
    name,
    background,
    foreground,
    theme: {
      name,
      type,
      colors: {
        ...colors,
        'editor.background': background,
        'editor.foreground': foreground,
      },
      tokenColors,
    },
  };
}

export function parseCodeThemeFile(
  text: string,
  fileName: string,
): ParsedCodeTheme {
  checkFileSize(text);
  if (UNSAFE_CSS_VALUE.test(text) && !text.trimStart().startsWith('{')) {
    throw new Error(t('themeImport.error.externalResource'));
  }
  if (text.trimStart().startsWith('{')) {
    return parseVsCodeThemeFile(text, fileName);
  }
  return parseLegacyCssThemeFile(text, fileName);
}
