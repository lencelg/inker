import { describe, expect, it } from 'vitest';
import {
  addSurroundChanges,
  deleteSurroundChanges,
  findSurroundPair,
  replaceSurroundChanges,
  surroundPair,
} from './vimSurround';

describe('vim surround', () => {
  it('maps surround characters to open and close', () => {
    expect(surroundPair('(')).toEqual({ open: '(', close: ')' });
    expect(surroundPair('[')).toEqual({ open: '[', close: ']' });
    expect(surroundPair('"')).toEqual({ open: '"', close: '"' });
    expect(surroundPair('*')).toEqual({ open: '*', close: '*' });
    expect(surroundPair('x')).toBeNull();
  });

  it('finds the pair around the cursor', () => {
    expect(findSurroundPair('a (b) c', 3, '(')).toEqual({
      open: '(',
      close: ')',
      openPos: 2,
      closePos: 4,
    });
    expect(findSurroundPair('a "b" c', 3, '"')).toEqual({
      open: '"',
      close: '"',
      openPos: 2,
      closePos: 4,
    });
    expect(findSurroundPair('word', 2, '*')).toBeNull();
  });

  it('builds wrap, replace, and delete changes', () => {
    expect(
      addSurroundChanges([{ from: 0, to: 4 }], {
        open: '(',
        close: ')',
      }),
    ).toEqual([
      { from: 0, insert: '(' },
      { from: 4, insert: ')' },
    ]);
    expect(
      addSurroundChanges([{ from: 2, to: 2 }], {
        open: '"',
        close: '"',
      }),
    ).toEqual([{ from: 2, to: 2, insert: '""' }]);

    const pair = { open: '(', close: ')', openPos: 2, closePos: 4 };
    expect(
      replaceSurroundChanges(pair, { open: '[', close: ']' }),
    ).toEqual([
      { from: 4, to: 5, insert: ']' },
      { from: 2, to: 3, insert: '[' },
    ]);
    expect(deleteSurroundChanges(pair)).toEqual([
      { from: 4, to: 5, insert: '' },
      { from: 2, to: 3, insert: '' },
    ]);
  });
});
