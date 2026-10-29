import type { ThemeRegistrationAny } from '@shikijs/types';
import type { SemanticKind } from './semanticTokens';

export interface SyntaxPalette {
  type: 'light' | 'dark';
  foreground: string;
  background: string;
  colors: Record<SemanticKind, string>;
}

type PaletteKind = Exclude<SemanticKind, 'plain'>;

interface RawRule {
  scope?: string | string[];
  settings?: {
    foreground?: string;
    fontStyle?: string;
  };
}

interface RawThemeLike {
  type?: string;
  fg?: string;
  bg?: string;
  colors?: Record<string, string>;
  tokenColors?: RawRule[];
  settings?: RawRule[];
}

const CATEGORY_SCOPES: Record<PaletteKind, readonly string[]> = {
  keyword: ['keyword', 'storage.type', 'storage.modifier'],
  string: ['string'],
  comment: ['comment'],
  number: ['constant.numeric'],
  type: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class'],
  function: ['entity.name.function', 'support.function', 'meta.function-call'],
  variable: ['variable'],
  constant: [
    'constant.language',
    'constant.character.escape',
    'support.constant',
    'variable.other.constant',
  ],
  parameter: ['variable.parameter'],
  property: [
    'variable.other.property',
    'support.type.property-name',
    'meta.object-literal.key',
  ],
  operator: ['keyword.operator', 'punctuation.operator'],
  tag: ['entity.name.tag'],
  attribute: ['entity.other.attribute-name'],
  punctuation: ['punctuation'],
};

const FALLBACKS: Partial<Record<PaletteKind, PaletteKind>> = {
  constant: 'number',
  parameter: 'variable',
  property: 'variable',
  attribute: 'variable',
  punctuation: 'operator',
};

const UNSAFE_COLOR = /url\s*\(|@import|expression\s*\(|javascript:|var\s*\(/i;
const COLOR_PATTERN =
  /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([^)]*\)|[a-z]+)$/i;

export function isSafeCssColor(value: string): boolean {
  const candidate = value.trim();
  return (
    candidate.length > 0 &&
    candidate.length <= 80 &&
    !UNSAFE_COLOR.test(candidate) &&
    COLOR_PATTERN.test(candidate)
  );
}

export function normalizeThemeColor(value: unknown): string | null {
  return typeof value === 'string' && isSafeCssColor(value)
    ? value.trim()
    : null;
}

function ruleScopes(rule: RawRule): string[] {
  if (typeof rule.scope === 'string') {
    return rule.scope.split(',').map((scope) => scope.trim()).filter(Boolean);
  }
  if (Array.isArray(rule.scope)) {
    return rule.scope
      .filter((scope): scope is string => typeof scope === 'string')
      .flatMap((scope) => scope.split(',').map((item) => item.trim()))
      .filter(Boolean);
  }
  return [];
}

function ruleMatches(ruleScope: string, targets: readonly string[]): boolean {
  return targets.some(
    (target) =>
      target === ruleScope || target.startsWith(`${ruleScope}.`),
  );
}

function bestColor(
  rules: readonly RawRule[],
  targets: readonly string[],
): string | null {
  let bestScore = -1;
  let best: string | null = null;
  for (const rule of rules) {
    const color = normalizeThemeColor(rule.settings?.foreground);
    if (!color) continue;
    for (const scope of ruleScopes(rule)) {
      if (!ruleMatches(scope, targets)) continue;
      if (scope.length >= bestScore) {
        bestScore = scope.length;
        best = color;
      }
    }
  }
  return best;
}

function themeType(theme: RawThemeLike): 'light' | 'dark' {
  return theme.type === 'light' ? 'light' : 'dark';
}

export function deriveSyntaxPalette(
  theme: ThemeRegistrationAny,
): SyntaxPalette {
  const source = theme as RawThemeLike;
  const type = themeType(source);
  const background =
    normalizeThemeColor(source.colors?.['editor.background']) ??
    normalizeThemeColor(source.bg) ??
    (type === 'light' ? '#ffffff' : '#1e1e1e');
  const foreground =
    normalizeThemeColor(source.colors?.['editor.foreground']) ??
    normalizeThemeColor(source.fg) ??
    (type === 'light' ? '#1f2328' : '#d4d4d4');
  const rules = [
    ...(source.tokenColors ?? []),
    ...(source.settings ?? []),
  ];

  const colors = {} as Record<SemanticKind, string>;
  colors.plain = foreground;
  for (const kind of Object.keys(CATEGORY_SCOPES) as PaletteKind[]) {
    const direct = bestColor(rules, CATEGORY_SCOPES[kind]);
    const fallback = FALLBACKS[kind];
    colors[kind] =
      direct ??
      (fallback ? colors[fallback] : undefined) ??
      foreground;
  }

  return { type, background, foreground, colors };
}
