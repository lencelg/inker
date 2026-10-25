import { isBuiltInThemeId, type BuiltInThemeId } from './themes';
import { t } from './i18n';

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
  css: string;
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

export function parseCodeThemeFile(
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
    return {
      name: themeName('', fallback || 'Custom Code Theme'),
      background,
      foreground,
      css: cssParts.join('\n'),
    };
  } finally {
    style.remove();
  }
}
