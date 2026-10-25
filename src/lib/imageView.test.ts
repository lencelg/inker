import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_ZOOM,
  MIN_IMAGE_ZOOM,
  clampImagePosition,
  clampImageZoom,
  zoomImageAroundPoint,
} from './imageView';

const viewport = { width: 1000, height: 800 };

describe('image viewer math', () => {
  it('clamps zoom to the supported range', () => {
    expect(clampImageZoom(0.01)).toBe(MIN_IMAGE_ZOOM);
    expect(clampImageZoom(20)).toBe(MAX_IMAGE_ZOOM);
    expect(clampImageZoom(Number.NaN)).toBe(1);
  });

  it('keeps the point under the cursor stable while zooming', () => {
    const point = { x: 750, y: 200 };
    const previous = { scale: 1, x: 0, y: 0 };
    const next = zoomImageAroundPoint(previous, 2, point, viewport);

    const beforeX = (point.x - viewport.width / 2) / previous.scale;
    const beforeY = (point.y - viewport.height / 2) / previous.scale;
    const afterX =
      (point.x - viewport.width / 2 - next.x) / next.scale;
    const afterY =
      (point.y - viewport.height / 2 - next.y) / next.scale;

    expect(next.scale).toBe(2);
    expect(afterX).toBeCloseTo(beforeX);
    expect(afterY).toBeCloseTo(beforeY);
  });

  it('limits panning to the scaled image overflow', () => {
    const image = { width: 600, height: 400 };
    const clamped = clampImagePosition(
      { scale: 2, x: 1000, y: -1000 },
      image,
      viewport,
    );

    expect(clamped.x).toBe(100);
    expect(clamped.y).toBe(0);
  });

  it('centers the image when it fits inside the viewport', () => {
    const clamped = clampImagePosition(
      { scale: 0.5, x: 20, y: -20 },
      { width: 400, height: 300 },
      viewport,
    );

    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
  });
});
