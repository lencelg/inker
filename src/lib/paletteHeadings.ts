import { extractMarkdownHeadings } from './markdown';
import type { PaletteItem } from './palette';

export function buildHeadingPaletteItems(
  source: string,
): PaletteItem[] {
  return extractMarkdownHeadings(source).map((heading, index) => ({
    id: `heading:${index}:${heading.id}`,
    label: heading.text || `H${heading.level}`,
    detail: `H${heading.level}`,
    keywords: [heading.text],
    kind: 'heading',
    line: heading.line,
    column: heading.column,
  }));
}
