import { afterEach, describe, expect, it, vi } from 'vitest';
import { sampleMinimapGlyphs } from './minimapGlyphs';
import { MINIMAP_CHAR_COUNT } from './minimap';

function stubCanvas(alpha: number): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function () {
      return {
        fillStyle: '#fff',
        font: '',
        textBaseline: 'middle',
        fillText: () => {},
        getImageData: (
          _x: number,
          _y: number,
          width: number,
          height: number,
        ) => {
          const data = new Uint8ClampedArray(width * height * 4);
          for (let index = 3; index < data.length; index += 4) {
            data[index] = alpha;
          }
          return { data, width, height };
        },
      } as unknown as CanvasRenderingContext2D;
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('minimap glyph sampling', () => {
  it('samples one mask per character at the device scale', () => {
    stubCanvas(255);
    const masks = sampleMinimapGlyphs(2, 0.8, 'monospace');
    expect(masks).toHaveLength(MINIMAP_CHAR_COUNT);
    expect(masks[0]).toHaveLength(8);
    expect(masks[0][0]).toBe(204);
  });

  it('uses linear coverage like VS Code', () => {
    stubCanvas(128);
    const masks = sampleMinimapGlyphs(1, 0.8, 'monospace');
    expect(masks[0]).toHaveLength(2);
    expect(masks[0][0]).toBe(204);
  });

  it('returns no masks when canvas is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      null,
    );
    expect(sampleMinimapGlyphs(2, 0.8, 'monospace')).toEqual([]);
  });
});
