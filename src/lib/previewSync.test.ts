import { describe, expect, it } from 'vitest';
import {
  previewScrollTop,
  sourceLineAtOffset,
  type SourceAnchor,
} from './previewSync';

const anchors: SourceAnchor[] = [
  { start: 1, end: 1, top: 0, bottom: 30, height: 30 },
  { start: 3, end: 5, top: 50, bottom: 200, height: 150 },
  { start: 7, end: 7, top: 250, bottom: 280, height: 30 },
  { start: 9, end: 10, top: 320, bottom: 420, height: 100 },
];

describe('sourceLineAtOffset', () => {
  it('returns null without anchors', () => {
    expect(sourceLineAtOffset([], 100)).toBeNull();
  });

  it('clamps to the first and last anchor', () => {
    expect(sourceLineAtOffset(anchors, -20)).toBe(1);
    expect(sourceLineAtOffset(anchors, 999)).toBe(10);
  });

  it('interpolates inside a block', () => {
    expect(sourceLineAtOffset(anchors, 125)).toBe(4);
    expect(sourceLineAtOffset(anchors, 200)).toBe(5);
  });

  it('interpolates across gaps', () => {
    expect(sourceLineAtOffset(anchors, 225)).toBe(6);
  });

  it('prefers the smallest containing block', () => {
    const nested: SourceAnchor[] = [
      { start: 1, end: 100, top: 0, bottom: 500, height: 500 },
      { start: 2, end: 10, top: 40, bottom: 70, height: 30 },
    ];
    expect(sourceLineAtOffset(nested, 55)).toBe(6);
  });
});

describe('previewScrollTop', () => {
  it('falls back to the scroll ratio without anchors', () => {
    expect(previewScrollTop([], 3, 0.5, 1000, 200)).toBe(500);
  });

  it('centers the target line', () => {
    expect(previewScrollTop(anchors, 4, 0, 1000, 100)).toBe(75);
    expect(previewScrollTop(anchors, 5, 0, 1000, 100)).toBe(150);
  });

  it('interpolates gap positions', () => {
    expect(previewScrollTop(anchors, 6, 0, 1000, 100)).toBe(175);
    expect(previewScrollTop(anchors, 8, 0, 1000, 100)).toBe(250);
  });

  it('clamps to the scroll range', () => {
    expect(previewScrollTop(anchors, 1, 0, 1000, 100)).toBe(0);
    expect(previewScrollTop(anchors, 9, 0, 200, 100)).toBe(200);
  });
});
