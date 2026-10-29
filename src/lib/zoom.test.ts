import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ZOOM_LEVEL,
  MAX_ZOOM_LEVEL,
  MIN_ZOOM_LEVEL,
  ZOOM_STORAGE_KEY,
  clampZoomLevel,
  nextZoomLevel,
  readStoredZoomLevel,
  storeZoomLevel,
  zoomActionFromEvent,
  zoomScale,
} from './zoom';

function keydown(
  init: KeyboardEventInit & { key: string },
): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('zoomActionFromEvent', () => {
  it('maps the VS Code zoom shortcuts', () => {
    expect(
      zoomActionFromEvent(keydown({ key: '=', ctrlKey: true })),
    ).toBe('in');
    expect(
      zoomActionFromEvent(keydown({ key: '+', ctrlKey: true })),
    ).toBe('in');
    expect(
      zoomActionFromEvent(keydown({ key: '-', ctrlKey: true })),
    ).toBe('out');
    expect(
      zoomActionFromEvent(keydown({ key: '0', ctrlKey: true })),
    ).toBe('reset');
  });

  it('supports numpad keys', () => {
    expect(
      zoomActionFromEvent(
        keydown({ key: '+', code: 'NumpadAdd', ctrlKey: true }),
      ),
    ).toBe('in');
    expect(
      zoomActionFromEvent(
        keydown({ key: '-', code: 'NumpadSubtract', ctrlKey: true }),
      ),
    ).toBe('out');
    expect(
      zoomActionFromEvent(
        keydown({ key: '0', code: 'Numpad0', ctrlKey: true }),
      ),
    ).toBe('reset');
  });

  it('ignores shortcuts without the primary modifier', () => {
    expect(zoomActionFromEvent(keydown({ key: '=' }))).toBeNull();
    expect(
      zoomActionFromEvent(keydown({ key: '=', ctrlKey: true, altKey: true })),
    ).toBeNull();
  });
});

describe('zoom levels', () => {
  it('steps by 20 percent and resets to the default', () => {
    expect(nextZoomLevel(0, 'in')).toBe(1);
    expect(nextZoomLevel(1, 'out')).toBe(0);
    expect(nextZoomLevel(3, 'reset')).toBe(DEFAULT_ZOOM_LEVEL);
    expect(zoomScale(1)).toBeCloseTo(1.2);
    expect(zoomScale(-1)).toBeCloseTo(1 / 1.2);
  });

  it('clamps the level to the supported range', () => {
    expect(nextZoomLevel(MAX_ZOOM_LEVEL, 'in')).toBe(MAX_ZOOM_LEVEL);
    expect(nextZoomLevel(MIN_ZOOM_LEVEL, 'out')).toBe(MIN_ZOOM_LEVEL);
    expect(clampZoomLevel(100)).toBe(MAX_ZOOM_LEVEL);
    expect(clampZoomLevel(Number.NaN)).toBe(DEFAULT_ZOOM_LEVEL);
  });

  it('persists and reads the zoom level', () => {
    storeZoomLevel(2);
    expect(window.localStorage.getItem(ZOOM_STORAGE_KEY)).toBe('2');
    expect(readStoredZoomLevel()).toBe(2);
  });
});
