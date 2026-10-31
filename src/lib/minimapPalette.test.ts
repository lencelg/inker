import { describe, expect, it } from 'vitest';
import {
  minimapNodeColor,
  parseCssColor,
  readMinimapPalette,
  relativeLuminance,
  type RGBColor,
} from './minimapPalette';

const fallback: RGBColor = { r: 1, g: 2, b: 3, a: 1 };

describe('minimap palette', () => {
  it('parses hex colors with 3, 4, 6 and 8 digits', () => {
    expect(parseCssColor('#abc', fallback)).toEqual({
      r: 170,
      g: 187,
      b: 204,
      a: 1,
    });
    expect(parseCssColor('#abcd', fallback).a).toBeCloseTo(221 / 255);
    expect(parseCssColor('#112233', fallback)).toEqual({
      r: 17,
      g: 34,
      b: 51,
      a: 1,
    });
    expect(parseCssColor('#11223344', fallback).a).toBeCloseTo(68 / 255);
  });

  it('parses functional colors and percentage channels', () => {
    expect(parseCssColor('rgb(10, 20, 30)', fallback)).toEqual({
      r: 10,
      g: 20,
      b: 30,
      a: 1,
    });
    expect(parseCssColor('rgba(10, 20, 30, 0.25)', fallback)).toEqual({
      r: 10,
      g: 20,
      b: 30,
      a: 0.25,
    });
    expect(
      parseCssColor('rgb(10% 20% 30% / 40%)', fallback),
    ).toEqual({
      r: 25.5,
      g: 51,
      b: 76.5,
      a: 0.4,
    });
  });

  it('falls back for unsupported colors', () => {
    expect(parseCssColor('color-mix(in srgb, red, blue)', fallback)).toBe(
      fallback,
    );
  });

  it('computes relative luminance for light and dark colors', () => {
    expect(
      relativeLuminance({ r: 255, g: 255, b: 255, a: 1 }),
    ).toBeCloseTo(1);
    expect(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBe(0);
    expect(
      relativeLuminance({ r: 128, g: 128, b: 128, a: 1 }),
    ).toBeGreaterThan(0.2);
  });

  it('maps syntax nodes to palette colors', () => {
    const palette = readMinimapPalette();
    expect(palette.backgroundIsLight).toBe(true);
    expect(minimapNodeColor('ATXHeading2', palette)).toBe(palette.heading);
    expect(minimapNodeColor('SetextHeading1', palette)).toBe(
      palette.heading,
    );
    expect(minimapNodeColor('CodeText', palette)).toBe(palette.code);
    expect(minimapNodeColor('CodeInfo', palette)).toBe(palette.type);
    expect(minimapNodeColor('Link', palette)).toBe(palette.link);
    expect(minimapNodeColor('HTMLTag', palette)).toBe(palette.tag);
    expect(minimapNodeColor('ListMark', palette)).toBe(palette.marker);
    expect(minimapNodeColor('Paragraph', palette)).toBeNull();
  });
});
