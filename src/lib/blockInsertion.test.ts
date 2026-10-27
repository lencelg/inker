import { describe, expect, it } from 'vitest';
import { withBlockSpacing } from './blockInsertion';

describe('withBlockSpacing', () => {
  it('inserts into an empty document', () => {
    expect(withBlockSpacing('', 0, 0, '- [A](#a)')).toEqual({
      text: '- [A](#a)',
      cursor: 9,
    });
  });

  it('adds blank lines around a block inserted at the start', () => {
    expect(withBlockSpacing('Hello', 0, 0, 'TOC')).toEqual({
      text: 'TOC\n\n',
      cursor: 5,
    });
  });

  it('keeps a single blank line after an existing newline', () => {
    expect(withBlockSpacing('A\nB', 2, 2, 'TOC')).toEqual({
      text: '\nTOC\n\n',
      cursor: 8,
    });
  });

  it('does not add a leading newline after a blank line', () => {
    expect(withBlockSpacing('A\n\nB', 3, 3, 'TOC')).toEqual({
      text: 'TOC\n\n',
      cursor: 8,
    });
  });

  it('replaces a selection and keeps surrounding spacing', () => {
    expect(withBlockSpacing('A\n\nold\n\nB', 3, 6, 'TOC')).toEqual({
      text: 'TOC',
      cursor: 6,
    });
  });

  it('does not add trailing newlines at the end of the document', () => {
    expect(withBlockSpacing('A', 1, 1, 'TOC')).toEqual({
      text: '\n\nTOC',
      cursor: 6,
    });
  });

  it('trims trailing whitespace from the block', () => {
    expect(withBlockSpacing('', 0, 0, 'TOC\n\n')).toEqual({
      text: 'TOC',
      cursor: 3,
    });
  });

  it('uses CRLF for inserted and surrounding line breaks', () => {
    expect(withBlockSpacing('A\r\nB', 3, 3, 'TOC\nsecond')).toEqual({
      text: '\r\nTOC\r\nsecond\r\n\r\n',
      cursor: 20,
    });
  });

  it('does not add extra CRLF after an existing blank line', () => {
    expect(withBlockSpacing('A\r\n\r\nB', 5, 5, 'TOC')).toEqual({
      text: 'TOC\r\n\r\n',
      cursor: 12,
    });
  });
});
