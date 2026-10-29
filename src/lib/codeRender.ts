import type { ThemedToken } from '@shikijs/types';
import {
  semanticClass,
  type SemanticKind,
} from './semanticTokens';
import { normalizeThemeColor } from './themePalette';

export interface CodeToken {
  content: string;
  offset: number;
  color?: string;
  fontStyle?: number;
  semantic: SemanticKind;
}

export type CodeTokenLines = CodeToken[][];

export interface TokenRange {
  from: number;
  to: number;
  className: string;
  style: string;
  semantic: SemanticKind;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function styleForToken(
  token: CodeToken,
  foreground: string,
): string {
  const parts: string[] = [];
  const color = normalizeThemeColor(token.color);
  if (color && color.toLowerCase() !== foreground.toLowerCase()) {
    parts.push(`color: ${color}`);
  }
  const fontStyle = token.fontStyle ?? 0;
  if (fontStyle & 1) parts.push('font-style: italic');
  if (fontStyle & 2) parts.push('font-weight: 700');
  if (fontStyle & 4) parts.push('text-decoration: underline');
  return parts.join('; ');
}

export function renderTokensToHtml(
  lines: CodeTokenLines,
  foreground: string,
): string {
  return lines
    .map((line) =>
      line
        .map((token) => {
          const content = escapeHtml(token.content);
          if (!content) return '';
          const style = styleForToken(token, foreground);
          if (!style) return content;
          return `<span class="${semanticClass(token.semantic)}" style="${style}">${content}</span>`;
        })
        .join(''),
    )
    .join('\n');
}

export function tokenLinesToRanges(
  lines: CodeTokenLines,
): TokenRange[] {
  const ranges: TokenRange[] = [];
  for (const line of lines) {
    for (const token of line) {
      if (!token.content.trim()) continue;
      ranges.push({
        from: token.offset,
        to: token.offset + token.content.length,
        className: semanticClass(token.semantic),
        style: styleForToken(token, ''),
        semantic: token.semantic,
      });
    }
  }
  return ranges;
}

export function tokensFromShiki(
  lines: ThemedToken[][],
  classify: (token: ThemedToken) => SemanticKind,
): CodeTokenLines {
  return lines.map((line) =>
    line.map((token) => ({
      content: token.content,
      offset: token.offset,
      color: token.color,
      fontStyle: token.fontStyle,
      semantic: classify(token),
    })),
  );
}
