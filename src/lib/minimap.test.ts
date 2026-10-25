import { describe, expect, it } from 'vitest';
import {
  MINIMAP_MAX_COLUMN,
  minimapScrollTop,
  minimapViewportMetrics,
  minimapWidthPx,
} from './minimap';

describe('minimap geometry', () => {
  it('derives the minimap width from maxColumn', () => {
    expect(MINIMAP_MAX_COLUMN).toBe(120);
    expect(minimapWidthPx(40)).toBe(56);
    expect(minimapWidthPx(120)).toBe(86);
    expect(minimapWidthPx(400)).toBe(150);
  });

  it('maps scroll percentages to editor scrollTop', () => {
    expect(minimapScrollTop(0, 1400, 400)).toBe(0);
    expect(minimapScrollTop(0.5, 1400, 400)).toBe(500);
    expect(minimapScrollTop(1, 1400, 400)).toBe(1000);
    expect(minimapScrollTop(2, 1400, 400)).toBe(1000);
    expect(minimapScrollTop(0.5, 400, 400)).toBe(0);
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
