import { describe, expect, it } from 'vitest';
import { extractMarkdownHeadings } from './markdown';
import {
  buildTableOfContents,
  escapeTocLabel,
  type MarkdownHeading,
} from './toc';

function heading(
  level: number,
  text: string,
  id: string,
): MarkdownHeading {
  return { level, text, id };
}

describe('extractMarkdownHeadings', () => {
  it('extracts ATX headings, strips inline markup, and skips code fences', () => {
    const source = [
      '# Title',
      '## Sub *em*',
      '### `code`',
      '## [Link](https://example.com)',
      '## ![Alt](a.png)',
      '```md',
      '# Not heading',
      '```',
      '## 中文标题',
      '## A',
      '## A',
      '<h2>HTML heading</h2>',
    ].join('\n');

    const headings = extractMarkdownHeadings(source);

    expect(headings.map((item) => [item.level, item.text])).toEqual([
      [1, 'Title'],
      [2, 'Sub em'],
      [3, 'code'],
      [2, 'Link'],
      [2, 'Alt'],
      [2, '中文标题'],
      [2, 'A'],
      [2, 'A'],
    ]);
    expect(headings.map((item) => item.id)).toEqual([
      'title',
      'sub-em',
      'code',
      'link',
      'alt',
      '中文标题',
      'a',
      'a-1',
    ]);
  });

  it('extracts setext headings', () => {
    expect(
      extractMarkdownHeadings(['Title', '=====', 'Sub', '---'].join('\n')),
    ).toEqual([
      { level: 1, text: 'Title', id: 'title' },
      { level: 2, text: 'Sub', id: 'sub' },
    ]);
  });
});

describe('buildTableOfContents', () => {
  it('builds nested lists from heading levels', () => {
    expect(
      buildTableOfContents([
        heading(1, 'A', 'a'),
        heading(2, 'B', 'b'),
        heading(3, 'C', 'c'),
        heading(2, 'D', 'd'),
        heading(1, 'E', 'e'),
      ]),
    ).toBe(
      [
        '- [A](#a)',
        '  - [B](#b)',
        '    - [C](#c)',
        '  - [D](#d)',
        '- [E](#e)',
      ].join('\n'),
    );
  });

  it('collapses skipped levels into one deeper indent', () => {
    expect(
      buildTableOfContents([
        heading(1, 'A', 'a'),
        heading(3, 'C', 'c'),
        heading(2, 'B', 'b'),
      ]),
    ).toBe(
      ['- [A](#a)', '  - [C](#c)', '  - [B](#b)'].join('\n'),
    );
  });

  it('honors level limits', () => {
    expect(
      buildTableOfContents(
        [
          heading(1, 'A', 'a'),
          heading(2, 'B', 'b'),
          heading(4, 'D', 'd'),
        ],
        { minLevel: 2, maxLevel: 3 },
      ),
    ).toBe('- [B](#b)');
  });

  it('escapes link text and skips empty ids', () => {
    expect(
      buildTableOfContents([
        heading(1, 'A [one] \\ two', 'a'),
        heading(2, '', 'b'),
        heading(2, 'no id', ''),
      ]),
    ).toBe(
      [
        '- [A \\[one\\] \\\\ two](#a)',
        '  - [Section](#b)',
      ].join('\n'),
    );
  });

  it('returns an empty string when there are no headings', () => {
    expect(buildTableOfContents([])).toBe('');
  });
});

describe('escapeTocLabel', () => {
  it('escapes brackets and backslashes', () => {
    expect(escapeTocLabel('[a] \\ b')).toBe('\\[a\\] \\\\ b');
  });
});
