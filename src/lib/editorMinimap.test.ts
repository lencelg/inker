import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { EditorMinimap } from './editorMinimap';

interface RecordedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const recorded = new Map<HTMLCanvasElement, RecordedImage>();

function fakeContext(canvas: HTMLCanvasElement): unknown {
  return {
    canvas,
    fillStyle: '#000',
    font: '',
    textBaseline: 'middle',
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    setTransform: () => {},
    clearRect: () => {},
    fillRect: () => {},
    drawImage: () => {},
    fillText: () => {},
    getImageData: (x: number, y: number, width: number, height: number) => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let index = 3; index < data.length; index += 4) {
        data[index] = 255;
      }
      return { data, width, height };
    },
    createImageData: (width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }),
    putImageData: (image: RecordedImage) => {
      recorded.set(canvas, {
        data: new Uint8ClampedArray(image.data),
        width: image.width,
        height: image.height,
      });
    },
  };
}

function sized<T extends HTMLElement>(
  element: T,
  width: number,
  height: number,
): T {
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: height,
  });
  return element;
}

function alphaAt(image: RecordedImage, x: number, y: number): number {
  return image.data[(y * image.width + x) * 4 + 3];
}

function createHarness(
  doc: string,
  options: { scale?: number; maxColumn?: number } = {
    scale: 2,
    maxColumn: 60,
  },
) {
  const parent = sized(document.createElement('div'), 1600, 400);
  const host = sized(document.createElement('div'), 120, 400);
  parent.append(host);
  document.body.append(parent);
  const baseCanvas = document.createElement('canvas');
  const overlayCanvas = document.createElement('canvas');
  const slider = document.createElement('div');
  const scrollbar = sized(document.createElement('div'), 12, 400);
  Object.defineProperty(scrollbar, 'offsetWidth', {
    configurable: true,
    value: 12,
  });
  const thumb = document.createElement('div');
  const scrollElement = sized(document.createElement('div'), 800, 300);
  Object.defineProperty(scrollElement, 'scrollHeight', {
    configurable: true,
    value: 900,
  });
  scrollElement.scrollTop = 0;
  const contentDOM = sized(document.createElement('div'), 800, 300);

  const state = EditorState.create({ doc });
  const view = {
    state,
    scrollDOM: scrollElement,
    contentDOM,
    defaultCharacterWidth: 9,
    defaultLineHeight: 20,
    contentHeight: 60,
    lineBlockAt: () => ({ height: 20 }),
  } as unknown as EditorView;

  const minimap = new EditorMinimap({
    view,
    host,
    baseCanvas,
    overlayCanvas,
    slider,
    scrollbar,
    scrollbarThumb: thumb,
    scale: options.scale,
    maxColumn: options.maxColumn,
  });
  return { minimap, host, parent, recorded };
}

describe('EditorMinimap rendering', () => {
  beforeEach(() => {
    recorded.clear();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement) {
        return fakeContext(this) as unknown as
          | CanvasRenderingContext2D
          | null;
      },
    );
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('paints glyphs at tab-aware and wide-character columns', () => {
    const { minimap, host, parent } = createHarness(
      'A\n\tB\n中文',
    );
    expect(host.style.width).toBe('120px');

    const tile = [...recorded.entries()].find(
      ([canvas]) => canvas.width === 120 && canvas.height === 15,
    );
    expect(tile).toBeTruthy();
    const image = tile![1];
    expect(image.width).toBe(120);

    // Line 1: "A" starts at the 8px gutter.
    expect(alphaAt(image, 8, 0)).toBeGreaterThan(0);
    // Line 2: the tab advances four columns before "B".
    expect(alphaAt(image, 8, 5)).toBe(0);
    expect(alphaAt(image, 16, 5)).toBeGreaterThan(0);
    // Line 3: two full-width characters occupy four columns, but each paints
    // a single glyph so CJK prose keeps visible gaps instead of smearing.
    expect(alphaAt(image, 8, 10)).toBeGreaterThan(0);
    expect(alphaAt(image, 10, 10)).toBe(0);
    expect(alphaAt(image, 12, 10)).toBeGreaterThan(0);
    expect(alphaAt(image, 14, 10)).toBe(0);

    minimap.destroy();
    parent.remove();
  });

  it('matches the 400-lines-per-page default density', () => {
    const { minimap, host, parent } = createHarness('A\nB\nC', {});
    expect(host.style.width).toBe('120px');

    // Three 2.5px rows at 1x: the tile is 8 device pixels tall.
    const tile = [...recorded.entries()].find(
      ([canvas]) => canvas.width === 120 && canvas.height === 8,
    );
    expect(tile).toBeTruthy();
    const image = tile![1];
    expect(alphaAt(image, 8, 0)).toBeGreaterThan(0);
    expect(alphaAt(image, 8, 3)).toBeGreaterThan(0);
    expect(alphaAt(image, 8, 5)).toBeGreaterThan(0);

    minimap.destroy();
    parent.remove();
  });

  it('hides the minimap without destroying the scrollbar', () => {
    const { minimap, host, parent } = createHarness('A');
    minimap.setOptions({ enabled: false });
    expect(host.style.display).toBe('none');
    minimap.setOptions({ enabled: true });
    expect(host.style.display).toBe('');
    minimap.destroy();
    parent.remove();
  });

  it('recomputes width when scale or max column changes', () => {
    const { minimap, host, parent } = createHarness('A');
    expect(host.style.width).toBe('120px');
    minimap.setOptions({ maxColumn: 30 });
    expect(host.style.width).toBe('60px');
    minimap.setOptions({ scale: 1, maxColumn: 60 });
    expect(host.style.width).toBe('60px');
    minimap.destroy();
    parent.remove();
  });
});
