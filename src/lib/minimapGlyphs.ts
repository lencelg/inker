import { MINIMAP_CHAR_COUNT } from './minimap';

export const DARK_GLYPH_SOFTEN = 12 / 15;
export const LIGHT_GLYPH_SOFTEN = 50 / 60;

const SAMPLED_CHAR_WIDTH = 10;
const SAMPLED_CHAR_HEIGHT = 16;
const GLYPH_FONT_SIZE = 16;
const UNKNOWN_CHAR_CODE = 0xfffd;

/**
 * Samples a 16px bold font and downsamples each glyph to the minimap's
 * device-pixel grid, mirroring VS Code's MinimapCharRendererFactory.
 */
export function sampleMinimapGlyphs(
  deviceScale: number,
  soften: number,
  fontFamily: string,
): Uint8ClampedArray[] {
  const width = deviceScale;
  const height = deviceScale * 2;
  const maskSize = width * height;
  const sourceWidth = MINIMAP_CHAR_COUNT * SAMPLED_CHAR_WIDTH;
  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = SAMPLED_CHAR_HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [];

  context.fillStyle = '#fff';
  context.font = `bold ${GLYPH_FONT_SIZE}px ${fontFamily}`;
  context.textBaseline = 'middle';
  for (let index = 0; index < MINIMAP_CHAR_COUNT; index += 1) {
    const codePoint =
      index < MINIMAP_CHAR_COUNT - 1 ? 32 + index : UNKNOWN_CHAR_CODE;
    context.fillText(
      String.fromCodePoint(codePoint),
      index * SAMPLED_CHAR_WIDTH,
      SAMPLED_CHAR_HEIGHT / 2,
    );
  }
  const pixels = context.getImageData(
    0,
    0,
    sourceWidth,
    SAMPLED_CHAR_HEIGHT,
  ).data;

  const raw: Float32Array[] = [];
  let brightest = 0;
  for (let index = 0; index < MINIMAP_CHAR_COUNT; index += 1) {
    const values = new Float32Array(maskSize);
    for (let y = 0; y < height; y += 1) {
      const sourceY1 = (y / height) * SAMPLED_CHAR_HEIGHT;
      const sourceY2 = ((y + 1) / height) * SAMPLED_CHAR_HEIGHT;
      for (let x = 0; x < width; x += 1) {
        const sourceX1 = (x / width) * SAMPLED_CHAR_WIDTH;
        const sourceX2 = ((x + 1) / width) * SAMPLED_CHAR_WIDTH;
        let value = 0;
        let samples = 0;
        for (let sy = sourceY1; sy < sourceY2; sy += 1) {
          const py = Math.floor(sy);
          const yBalance = 1 - (sy - py);
          for (let sx = sourceX1; sx < sourceX2; sx += 1) {
            const px = Math.floor(sx);
            const xBalance = 1 - (sx - px);
            const alpha =
              pixels[
                (py * sourceWidth + index * SAMPLED_CHAR_WIDTH + px) * 4 +
                  3
              ];
            const weight = xBalance * yBalance;
            samples += weight;
            // White text: VS Code measures coverage as R * A / 255.
            value += alpha * weight;
          }
        }
        const final = samples > 0 ? value / samples : 0;
        values[y * width + x] = final;
        if (final > brightest) brightest = final;
      }
    }
    raw.push(values);
  }

  if (brightest <= 0) return [];
  const adjust = (255 / brightest) * soften;
  return raw.map((values) => {
    const mask = new Uint8ClampedArray(maskSize);
    for (let pixel = 0; pixel < maskSize; pixel += 1) {
      mask[pixel] = Math.round(values[pixel] * adjust);
    }
    return mask;
  });
}
