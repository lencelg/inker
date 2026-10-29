import type { ThemedToken } from '@shikijs/types';

/**
 * Coarse TextMate scope categories. These are grammar heuristics, not LSP
 * semantic tokens; the source editor uses them to align its Lezer colors.
 */
export type SemanticKind =
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'type'
  | 'function'
  | 'variable'
  | 'constant'
  | 'parameter'
  | 'property'
  | 'operator'
  | 'tag'
  | 'attribute'
  | 'punctuation'
  | 'plain';

const RULES: ReadonlyArray<readonly [RegExp, SemanticKind]> = [
  [/^comment/, 'comment'],
  [/^string/, 'string'],
  [/^constant\.numeric/, 'number'],
  [/^constant\./, 'constant'],
  [/^keyword\.operator/, 'operator'],
  [/^keyword/, 'keyword'],
  [/^storage\.(type|modifier)/, 'keyword'],
  [/^entity\.name\.function/, 'function'],
  [/^support\.function/, 'function'],
  [/^meta\.function-call/, 'function'],
  [/^variable\.parameter/, 'parameter'],
  [/^variable\.other\.property/, 'property'],
  [/^support\.type\.property-name/, 'property'],
  [/^meta\.object-literal\.key/, 'property'],
  [/^entity\.name\.(type|class)/, 'type'],
  [/^support\.(type|class)/, 'type'],
  [/^entity\.name\.tag/, 'tag'],
  [/^entity\.other\.attribute-name/, 'attribute'],
  [/^variable/, 'variable'],
  [/^punctuation/, 'punctuation'],
  [/^keyword\.other/, 'keyword'],
];

export function classifyScopes(scopes: readonly string[]): SemanticKind {
  for (const [pattern, kind] of RULES) {
    if (scopes.some((scope) => pattern.test(scope))) return kind;
  }
  return 'plain';
}

export function classifyToken(token: ThemedToken): SemanticKind {
  const scopes =
    token.explanation?.flatMap((explanation) =>
      explanation.scopes.map((scope) => scope.scopeName),
    ) ?? [];
  if (scopes.length > 0) return classifyScopes(scopes);

  if (token.type === 1) return 'comment';
  if (token.type === 2) return 'string';
  if (token.type === 3) return 'string';
  return 'plain';
}

export function semanticClass(kind: SemanticKind): string {
  return `tk tk-${kind}`;
}
