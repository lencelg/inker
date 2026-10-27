import type { MarkdownHeading } from './markdown';

export type { MarkdownHeading } from './markdown';

export interface TocOptions {
  minLevel?: number;
  maxLevel?: number;
}

export function escapeTocLabel(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\r?\n/g, ' ')
    .trim();
}

export function buildTableOfContents(
  headings: readonly MarkdownHeading[],
  options: TocOptions = {},
): string {
  const minLevel = options.minLevel ?? 1;
  const maxLevel = options.maxLevel ?? 6;
  const included = headings.filter(
    (heading) =>
      heading.level >= minLevel &&
      heading.level <= maxLevel &&
      heading.id !== '',
  );
  if (included.length === 0) return '';

  const stack: number[] = [];
  const lines: string[] = [];
  for (const heading of included) {
    while (
      stack.length > 0 &&
      heading.level < stack[stack.length - 1]
    ) {
      stack.pop();
    }
    if (
      stack.length === 0 ||
      heading.level > stack[stack.length - 1]
    ) {
      stack.push(heading.level);
    } else {
      stack[stack.length - 1] = heading.level;
    }

    const depth = stack.length - 1;
    const label = escapeTocLabel(heading.text) || 'Section';
    lines.push(`${'  '.repeat(depth)}- [${label}](#${heading.id})`);
  }
  return lines.join('\n');
}
