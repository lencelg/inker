import { describe, expect, it } from 'vitest';
import {
  minimapLineAtRatio,
  minimapViewportMetrics,
} from './minimap';

describe('minimap geometry', () => {
  it('maps a vertical ratio to a document line', () => {
    expect(minimapLineAtRatio(0, 100)).toBe(1);
    expect(minimapLineAtRatio(0.5, 100)).toBe(51);
    expect(minimapLineAtRatio(0.999, 100)).toBe(100);
    expect(minimapLineAtRatio(2, 100)).toBe(100);
    expect(minimapLineAtRatio(-1, 100)).toBe(1);
  });

  it('positions the viewport slider without exceeding the minimap', () => {
    const top = minimapViewportMetrics(0, 400, 1400, 400, 18);
    expect(top.top).toBe(0);
    expect(top.height).toBeCloseTo((400 * 400) / 1400);
    expect(top.ratio).toBe(0);

    const middle = minimapViewportMetrics(500, 400, 1400, 400, 18);
    expect(middle.top).toBeCloseTo(
      (400 - (400 * 400) / 1400) * 0.5,
    );
    expect(middle.height).toBeCloseTo((400 * 400) / 1400);
    expect(middle.ratio).toBe(0.5);
  });

  it('uses the full height when the document does not scroll', () => {
    expect(minimapViewportMetrics(0, 400, 400, 400, 18)).toEqual({
      top: 0,
      height: 400,
      ratio: 0,
    });
  });

  it('honors the minimum viewport height', () => {
    const metrics = minimapViewportMetrics(0, 10, 100000, 300, 18);
    expect(metrics.height).toBe(18);
    expect(metrics.top).toBe(0);
  });
});
