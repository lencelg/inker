import { describe, expect, it } from 'vitest';
import { buildHeadingPaletteItems } from './paletteHeadings';

describe('buildHeadingPaletteItems', () => {
  it('maps headings to palette items with level and position', () => {
    const items = buildHeadingPaletteItems(
      ['# Title', '', '## Intro', '', '### Details'].join('\n'),
    );

    expect(items).toEqual([
      {
        id: expect.stringContaining('title'),
        label: 'Title',
        detail: 'H1',
        keywords: ['Title'],
        kind: 'heading',
        line: 1,
        column: 1,
      },
      expect.objectContaining({
        label: 'Intro',
        detail: 'H2',
        line: 3,
      }),
      expect.objectContaining({
        label: 'Details',
        detail: 'H3',
        line: 5,
      }),
    ]);
  });

  it('returns an empty list when there are no headings', () => {
    expect(buildHeadingPaletteItems('plain text')).toEqual([]);
  });
});
