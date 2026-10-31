import { describe, expect, it } from 'vitest';
import {
  MINIMAP_CHAR_COUNT,
  MINIMAP_DEFAULT_MAX_COLUMN,
  MINIMAP_DEFAULT_SCALE,
  MINIMAP_GUTTER_WIDTH,
  clampMinimapMaxColumn,
  clampMinimapScale,
  isFullWidthCodePoint,
  minimapCharAdvance,
  minimapCharIndex,
  minimapCharMetrics,
  minimapScrollTop,
  minimapViewportMetrics,
  minimapWidthPx,
} from './minimap';

describe('minimap geometry', () => {
  it('uses a 1x2 base glyph scaled like VS Code', () => {
    const one = minimapCharMetrics(1, 1);
    expect(one.deviceScale).toBe(1);
    expect(one.charWidthDevice).toBe(1);
    expect(one.charHeightDevice).toBe(2);
    expect(one.charWidthCss).toBe(1);
    expect(one.rowPitchCss).toBe(2.5);
    expect(1000 / one.rowPitchCss).toBe(400);

    const retina = minimapCharMetrics(1, 2);
    expect(retina.deviceScale).toBe(2);
    expect(retina.charWidthDevice).toBe(2);
    expect(retina.charHeightDevice).toBe(4);
    expect(retina.charWidthCss).toBe(1);
    expect(retina.rowPitchCss).toBe(2.5);

    const large = minimapCharMetrics(2, 1);
    expect(large.deviceScale).toBe(2);
    expect(large.charWidthCss).toBe(2);
    expect(large.rowPitchCss).toBe(5);

    const fractional = minimapCharMetrics(1, 1.5);
    expect(fractional.deviceScale).toBe(1);
    expect(fractional.charWidthCss).toBeCloseTo(2 / 3);
    expect(fractional.rowPitchCss).toBe(2.5);

    const fractionalLarge = minimapCharMetrics(2, 1.5);
    expect(fractionalLarge.deviceScale).toBe(2);
    expect(fractionalLarge.charWidthCss).toBeCloseTo(4 / 3);
    expect(fractionalLarge.rowPitchCss).toBe(5);
  });

  it('derives the minimap width from maxColumn and scale', () => {
    expect(MINIMAP_DEFAULT_SCALE).toBe(1);
    expect(MINIMAP_DEFAULT_MAX_COLUMN).toBe(120);
    expect(MINIMAP_GUTTER_WIDTH).toBe(8);
    expect(minimapWidthPx()).toBe(120);
    expect(minimapWidthPx(120, 1)).toBe(120);
    expect(minimapWidthPx(60, 2)).toBe(120);
    expect(minimapWidthPx(120, 2)).toBe(240);
    expect(minimapWidthPx(40, 2)).toBe(80);
    expect(
      minimapWidthPx(120, 1, {
        availableWidth: 0,
        characterWidth: 0,
        pixelRatio: 2,
      }),
    ).toBe(120);
    expect(
      minimapWidthPx(120, 1, {
        availableWidth: 0,
        characterWidth: 0,
        pixelRatio: 1.5,
      }),
    ).toBe(80);
  });

  it('shrinks the minimap like VS Code on narrow panes', () => {
    expect(
      minimapWidthPx(120, 1, {
        availableWidth: 1600,
        characterWidth: 9,
        scrollbarWidth: 12,
      }),
    ).toBe(120);
    expect(
      minimapWidthPx(120, 1, {
        availableWidth: 1000,
        characterWidth: 9,
        scrollbarWidth: 12,
      }),
    ).toBe(106);
    expect(
      minimapWidthPx(120, 1, {
        availableWidth: 700,
        characterWidth: 9,
        scrollbarWidth: 12,
      }),
    ).toBe(76);
    expect(
      minimapWidthPx(40, 1, {
        availableWidth: 1600,
        characterWidth: 9,
        scrollbarWidth: 12,
      }),
    ).toBe(40);
    expect(
      minimapWidthPx(120, 1, {
        availableWidth: 1600,
        characterWidth: 9,
        scrollbarWidth: 12,
        pixelRatio: 2,
      }),
    ).toBe(120);
    expect(
      minimapWidthPx(120, 1, {
        availableWidth: 1600,
        characterWidth: 9,
        scrollbarWidth: 12,
        pixelRatio: 1.5,
      }),
    ).toBe(80);
  });

  it('clamps scale and max column to supported ranges', () => {
    expect(clampMinimapScale(undefined)).toBe(1);
    expect(clampMinimapScale(0)).toBe(1);
    expect(clampMinimapScale(9)).toBe(3);
    expect(clampMinimapScale('2')).toBe(2);
    expect(clampMinimapMaxColumn(undefined)).toBe(120);
    expect(clampMinimapMaxColumn(1)).toBe(20);
    expect(clampMinimapMaxColumn(9999)).toBe(200);
    expect(clampMinimapMaxColumn('80')).toBe(80);
  });

  it('advances tabs, wide characters, and spaces by display columns', () => {
    expect(minimapCharAdvance(9, 0, 4)).toEqual({
      paint: false,
      columns: 4,
    });
    expect(minimapCharAdvance(9, 2, 4)).toEqual({
      paint: false,
      columns: 2,
    });
    expect(minimapCharAdvance(9, 4, 4)).toEqual({
      paint: false,
      columns: 4,
    });
    expect(minimapCharAdvance(32, 0, 4)).toEqual({
      paint: false,
      columns: 1,
    });
    expect(minimapCharAdvance(65, 0, 4)).toEqual({
      paint: true,
      columns: 1,
    });
    expect(minimapCharAdvance(0x4e2d, 0, 4)).toEqual({
      paint: true,
      columns: 2,
    });
    expect(minimapCharAdvance(0x3000, 0, 4)).toEqual({
      paint: false,
      columns: 2,
    });
    expect(minimapCharAdvance(0xa0, 0, 4)).toEqual({
      paint: false,
      columns: 1,
    });
    expect(isFullWidthCodePoint(0x4e2d)).toBe(true);
    expect(isFullWidthCodePoint(0x1f600)).toBe(true);
    expect(isFullWidthCodePoint(0x41)).toBe(false);
  });

  it('maps characters onto sampled glyphs', () => {
    expect(minimapCharIndex(32)).toBe(0);
    expect(minimapCharIndex(65)).toBe(33);
    expect(minimapCharIndex(126)).toBe(94);
    const wide = minimapCharIndex(0x4e2d);
    expect(wide).toBeGreaterThanOrEqual(0);
    expect(wide).toBeLessThan(MINIMAP_CHAR_COUNT);
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
