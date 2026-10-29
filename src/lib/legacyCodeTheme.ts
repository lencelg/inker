import type { ThemeRegistration } from '@shikijs/types';
import { isSafeCssColor } from './themePalette';

export interface LegacyCssThemeInput {
  name: string;
  background: string;
  foreground: string;
  css: string;
}

interface LegacyRule {
  classes: string[];
  color: string;
  fontStyle: string;
}

const CLASS_SCOPES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['hljs-keyword', ['keyword', 'storage']],
  ['hljs-built_in', ['support.function', 'support.class']],
  ['hljs-type', ['entity.name.type', 'support.type']],
  ['hljs-literal', ['constant.language']],
  ['hljs-number', ['constant.numeric']],
  ['hljs-string', ['string']],
  ['hljs-comment', ['comment']],
  ['hljs-title', ['entity.name.function', 'entity.name.type']],
  ['hljs-function', ['entity.name.function']],
  ['hljs-params', ['variable.parameter']],
  ['hljs-variable', ['variable']],
  ['hljs-property', ['variable.other.property']],
  ['hljs-attr', ['entity.other.attribute-name']],
  ['hljs-attribute', ['entity.other.attribute-name']],
  ['hljs-tag', ['entity.name.tag']],
  ['hljs-name', ['entity.name.tag']],
  ['hljs-operator', ['keyword.operator']],
  ['hljs-punctuation', ['punctuation']],
  ['hljs-meta', ['comment']],
  ['hljs-regexp', ['string.regexp']],
  ['hljs-symbol', ['constant.other.symbol']],
  ['hljs-template-variable', ['variable']],
  ['hljs-section', ['entity.name.section']],
  ['hljs-bullet', ['punctuation']],
  ['hljs-link', ['markup.underline.link']],
];

function classesOf(selector: string): string[] {
  return Array.from(selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)).map(
    (match) => match[1],
  );
}

function styleFromDeclarations(text: string): {
  color: string;
  fontStyle: string;
} {
  const color = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(text)?.[1]?.trim() ?? '';
  const parts: string[] = [];
  const fontStyle = /(?:^|;)\s*font-style\s*:\s*([^;]+)/i
    .exec(text)?.[1]
    ?.trim();
  const fontWeight = /(?:^|;)\s*font-weight\s*:\s*([^;]+)/i
    .exec(text)?.[1]
    ?.trim();
  const decoration = /(?:^|;)\s*text-decoration(?:-line)?\s*:\s*([^;]+)/i
    .exec(text)?.[1]
    ?.trim();
  if (fontStyle && fontStyle !== 'normal') parts.push('italic');
  if (fontWeight && /^(?:[6-9]00|bold)$/i.test(fontWeight)) parts.push('bold');
  if (decoration && decoration !== 'none') parts.push('underline');
  return {
    color: isSafeCssColor(color) ? color : '',
    fontStyle: parts.join(' '),
  };
}

function rulesFromCss(css: string): LegacyRule[] {
  const rules: LegacyRule[] = [];
  const style = typeof document !== 'undefined'
    ? document.createElement('style')
    : null;
  if (style) {
    style.textContent = css;
    document.head.append(style);
  }
  try {
    const sheet = style?.sheet;
    if (sheet) {
      for (const rule of Array.from(sheet.cssRules)) {
        if (!('selectorText' in rule) || !('style' in rule)) continue;
        const ruleStyle = (rule as CSSStyleRule).style;
        const declarationText = Array.from(ruleStyle)
          .map((property) => `${property}: ${ruleStyle.getPropertyValue(property)};`)
          .join('');
        const parsed = styleFromDeclarations(declarationText);
        for (const selector of (rule as CSSStyleRule).selectorText.split(',')) {
          const classes = classesOf(selector.trim());
          if (!classes.includes('hljs') && !classes.some((name) => name.startsWith('hljs-'))) {
            continue;
          }
          if (parsed.color || parsed.fontStyle) {
            rules.push({ classes, ...parsed });
          }
        }
      }
    }
  } finally {
    style?.remove();
  }

  if (rules.length > 0) return rules;

  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of cleaned.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const parsed = styleFromDeclarations(match[2]);
    if (!parsed.color && !parsed.fontStyle) continue;
    for (const selector of match[1].split(',')) {
      const classes = classesOf(selector.trim());
      if (classes.some((name) => name.startsWith('hljs'))) {
        rules.push({ classes, ...parsed });
      }
    }
  }
  return rules;
}

function scopesForRule(rule: LegacyRule): string[] {
  const classes = new Set(rule.classes);
  if (classes.has('hljs-title') && classes.has('function_')) {
    return ['entity.name.function'];
  }
  if (classes.has('hljs-title') && classes.has('class_')) {
    return ['entity.name.type'];
  }
  const scopes: string[] = [];
  for (const [name, targets] of CLASS_SCOPES) {
    if (classes.has(name)) scopes.push(...targets);
  }
  return [...new Set(scopes)];
}

export function convertHljsCssToShikiTheme(
  input: LegacyCssThemeInput,
): ThemeRegistration {
  const rules = rulesFromCss(input.css);
  const tokenColors = rules
    .map((rule) => ({
      scope: scopesForRule(rule),
      settings: {
        ...(rule.color ? { foreground: rule.color } : {}),
        ...(rule.fontStyle ? { fontStyle: rule.fontStyle } : {}),
      },
    }))
    .filter((rule) => rule.scope.length > 0);

  return {
    name: input.name,
    type: isDark(input.background) ? 'dark' : 'light',
    colors: {
      'editor.background': input.background,
      'editor.foreground': input.foreground,
    },
    tokenColors,
  };
}

function isDark(color: string): boolean {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return true;
  const value = Number.parseInt(hex, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}
