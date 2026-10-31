import { describe, expect, it } from 'vitest';
import { splitMinimapChunks } from './minimapLines';

describe('minimap line chunks', () => {
  it('keeps single visual rows as one chunk', () => {
    expect(splitMinimapChunks('hello world', 1)).toEqual([
      { start: 0, end: 11 },
    ]);
  });

  it('splits wrapped rows evenly', () => {
    expect(splitMinimapChunks('abcdef', 2)).toEqual([
      { start: 0, end: 3 },
      { start: 3, end: 6 },
    ]);
  });

  it('prefers breaking at a space in the second half', () => {
    expect(splitMinimapChunks('aaaa bbbb cccc', 2)).toEqual([
      { start: 0, end: 5 },
      { start: 5, end: 14 },
    ]);
  });

  it('pads short content with empty chunks', () => {
    expect(splitMinimapChunks('ab', 3)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 2 },
    ]);
    expect(splitMinimapChunks('', 2)).toEqual([
      { start: 0, end: 0 },
      { start: 0, end: 0 },
    ]);
  });
});
