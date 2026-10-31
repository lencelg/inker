import { syntaxTree } from '@codemirror/language';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import {
  MINIMAP_CHAR_COUNT,
  MINIMAP_DEFAULT_MAX_COLUMN,
  MINIMAP_DEFAULT_SCALE,
  MINIMAP_GUTTER_WIDTH,
  clampMinimapMaxColumn,
  clampMinimapScale,
  minimapCharAdvance,
  minimapCharIndex,
  minimapCharMetrics,
  minimapScrollTop,
  minimapViewportMetrics,
  minimapWidthPx,
  type MinimapCharMetrics,
} from './minimap';
import { wheelDeltaPixels } from './wheelScroll';

const HEADING_NODE = /^(?:ATX|Setext)Heading[1-6]$/;
const MIN_THUMB_HEIGHT = 24;
const TILE_HEIGHT = 128;
const MAX_TILE_CACHE = 64;
const SAMPLED_CHAR_WIDTH = 10;
const SAMPLED_CHAR_HEIGHT = 16;
const GLYPH_FONT_SIZE = 16;
const DARK_GLYPH_SOFTEN = 12 / 15;
const LIGHT_GLYPH_SOFTEN = 50 / 60;
const BASE_ALPHA = 1;
const TOKEN_ALPHA = 1;
const HEADING_ALPHA = 1;
const MAX_VISUAL_ROWS = 2000;
const MAX_DEVICE_PIXEL_RATIO = 3;
const TAB_SIZE = 4;

interface RGBColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface MinimapSegment {
  from: number;
  to: number;
  color: RGBColor;
  alpha: number;
}

interface MinimapChunk {
  start: number;
  end: number;
}

interface LineInfo {
  number: number;
  text: string;
  rowStart: number;
  visualRows: number;
  top: number;
}

interface NodePaint {
  color: RGBColor;
  alpha: number;
}

interface MinimapPalette {
  base: RGBColor;
  heading: RGBColor;
  code: RGBColor;
  link: RGBColor;
  quote: RGBColor;
  tag: RGBColor;
  marker: RGBColor;
  strong: RGBColor;
  emphasis: RGBColor;
  type: RGBColor;
  selection: string;
  backgroundIsLight: boolean;
}

export interface EditorMinimapOptions {
  view: EditorView;
  host: HTMLElement;
  baseCanvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  slider: HTMLElement;
  scrollbar: HTMLElement;
  scrollbarThumb: HTMLElement;
  enabled?: boolean;
  scale?: number;
  maxColumn?: number;
}

export interface EditorMinimapSettings {
  enabled?: boolean;
  scale?: number;
  maxColumn?: number;
}

type DragKind = 'minimap' | 'scrollbar' | null;

const HEX_COLOR = /^#([0-9a-f]{3,8})$/i;
const FUNCTIONAL_COLOR = /^rgba?\(\s*([^)]*)\)$/i;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampPixelRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, value));
}

function cssColor(
  styles: CSSStyleDeclaration,
  name: string,
  fallback: string,
): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

function parseAlpha(token: string | undefined): number {
  if (!token) return 1;
  if (token.endsWith('%')) {
    const percent = Number.parseFloat(token);
    return Number.isFinite(percent) ? clamp(percent / 100, 0, 1) : 1;
  }
  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? clamp(value, 0, 1) : 1;
}

function parseChannel(token: string): number {
  if (token.endsWith('%')) {
    const percent = Number.parseFloat(token);
    return Number.isFinite(percent) ? (percent / 100) * 255 : 0;
  }
  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? value : 0;
}

function parseCssColor(value: string, fallback: RGBColor): RGBColor {
  const hex = HEX_COLOR.exec(value);
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      return {
        r: Number.parseInt(digits[0] + digits[0], 16),
        g: Number.parseInt(digits[1] + digits[1], 16),
        b: Number.parseInt(digits[2] + digits[2], 16),
        a:
          digits.length === 4
            ? Number.parseInt(digits[3] + digits[3], 16) / 255
            : 1,
      };
    }
    if (digits.length === 6 || digits.length === 8) {
      return {
        r: Number.parseInt(digits.slice(0, 2), 16),
        g: Number.parseInt(digits.slice(2, 4), 16),
        b: Number.parseInt(digits.slice(4, 6), 16),
        a:
          digits.length === 8
            ? Number.parseInt(digits.slice(6, 8), 16) / 255
            : 1,
      };
    }
  }

  const functional = FUNCTIONAL_COLOR.exec(value);
  if (functional) {
    const parts = functional[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 3) {
      return {
        r: parseChannel(parts[0]),
        g: parseChannel(parts[1]),
        b: parseChannel(parts[2]),
        a: parseAlpha(parts[3]),
      };
    }
  }

  return fallback;
}

function relativeLuminance(color: RGBColor): number {
  const channel = (value: number): number => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(color.r) +
    0.7152 * channel(color.g) +
    0.0722 * channel(color.b)
  );
}

function readPalette(): MinimapPalette {
  const styles = getComputedStyle(document.documentElement);
  const background = parseCssColor(
    cssColor(styles, '--panel', '#ffffff'),
    { r: 255, g: 255, b: 255, a: 1 },
  );
  return {
    base: parseCssColor(cssColor(styles, '--ink', '#1f2933'), {
      r: 31,
      g: 41,
      b: 51,
      a: 1,
    }),
    heading: parseCssColor(
      cssColor(styles, '--syntax-heading', '#1f4e79'),
      { r: 31, g: 78, b: 121, a: 1 },
    ),
    code: parseCssColor(cssColor(styles, '--syntax-string', '#a31515'), {
      r: 163,
      g: 21,
      b: 21,
      a: 1,
    }),
    link: parseCssColor(cssColor(styles, '--syntax-link', '#0066cc'), {
      r: 0,
      g: 102,
      b: 204,
      a: 1,
    }),
    quote: parseCssColor(cssColor(styles, '--syntax-quote', '#6b7280'), {
      r: 107,
      g: 114,
      b: 128,
      a: 1,
    }),
    tag: parseCssColor(cssColor(styles, '--syntax-tag', '#800000'), {
      r: 128,
      g: 0,
      b: 0,
      a: 1,
    }),
    marker: parseCssColor(
      cssColor(styles, '--syntax-operator', '#383a42'),
      { r: 56, g: 58, b: 66, a: 1 },
    ),
    strong: parseCssColor(cssColor(styles, '--ink', '#1f2933'), {
      r: 31,
      g: 41,
      b: 51,
      a: 1,
    }),
    emphasis: parseCssColor(cssColor(styles, '--muted', '#6b7280'), {
      r: 107,
      g: 114,
      b: 128,
      a: 1,
    }),
    type: parseCssColor(cssColor(styles, '--syntax-type', '#267f99'), {
      r: 38,
      g: 127,
      b: 153,
      a: 1,
    }),
    selection: cssColor(
      styles,
      '--editor-selection',
      'rgba(37, 99, 235, 0.18)',
    ),
    backgroundIsLight: relativeLuminance(background) > 0.55,
  };
}

function nodeStyle(
  name: string,
  palette: MinimapPalette,
): NodePaint | null {
  if (HEADING_NODE.test(name)) {
    return { color: palette.heading, alpha: HEADING_ALPHA };
  }
  switch (name) {
    case 'InlineCode':
    case 'CodeText':
      return { color: palette.code, alpha: TOKEN_ALPHA };
    case 'CodeInfo':
      return { color: palette.type, alpha: TOKEN_ALPHA };
    case 'Link':
    case 'Image':
    case 'URL':
      return { color: palette.link, alpha: TOKEN_ALPHA };
    case 'HTMLBlock':
    case 'HTMLTag':
      return { color: palette.tag, alpha: TOKEN_ALPHA };
    case 'StrongEmphasis':
      return { color: palette.strong, alpha: 1 };
    case 'Emphasis':
      return { color: palette.emphasis, alpha: 1 };
    case 'QuoteMark':
      return { color: palette.quote, alpha: 1 };
    case 'ListMark':
      return { color: palette.marker, alpha: 1 };
    default:
      return null;
  }
}

function splitChunks(text: string, visualRows: number): MinimapChunk[] {
  if (visualRows <= 1) {
    return [{ start: 0, end: text.length }];
  }
  const chunks: MinimapChunk[] = [];
  let offset = 0;
  for (let row = 0; row < visualRows - 1; row += 1) {
    if (offset >= text.length) break;
    const remainingRows = visualRows - row;
    let end =
      offset +
      Math.max(
        1,
        Math.ceil((text.length - offset) / remainingRows),
      );
    end = Math.min(text.length, end);
    if (end >= text.length) break;
    const minimum = offset + Math.max(1, Math.floor((end - offset) / 2));
    const space = text.lastIndexOf(' ', end);
    if (space >= minimum) end = space + 1;
    chunks.push({ start: offset, end });
    offset = end;
  }
  if (offset < text.length) {
    chunks.push({ start: offset, end: text.length });
  }
  while (chunks.length < visualRows) {
    chunks.push({ start: text.length, end: text.length });
  }
  return chunks.slice(0, visualRows);
}

export class EditorMinimap {
  private readonly view: EditorView;
  private readonly scrollElement: HTMLElement;
  private readonly host: HTMLElement;
  private readonly baseCanvas: HTMLCanvasElement;
  private readonly overlayCanvas: HTMLCanvasElement;
  private readonly slider: HTMLElement;
  private readonly scrollbar: HTMLElement;
  private readonly scrollbarThumb: HTMLElement;

  private enabled = true;
  private scale = MINIMAP_DEFAULT_SCALE;
  private maxColumn = MINIMAP_DEFAULT_MAX_COLUMN;
  private pixelRatio = 1;
  private metrics: MinimapCharMetrics = minimapCharMetrics(
    MINIMAP_DEFAULT_SCALE,
    1,
  );

  private baseContext: CanvasRenderingContext2D | null = null;
  private overlayContext: CanvasRenderingContext2D | null = null;
  private canvasWidthDevice = 0;
  private canvasHeightDevice = 0;
  private widthCss = 0;
  private heightCss = 0;
  private requestedWidth = 0;
  private virtualHeight = 0;
  private sliceOffset = 0;
  private viewportHeightVirtual = 0;
  private drawDirty = false;
  private totalRows = 1;
  private charsPerRow = 80;
  private lines: LineInfo[] = [];
  private tiles = new Map<number, HTMLCanvasElement>();
  private segmentCache = new Map<number, MinimapSegment[]>();
  private glyphMasks: Uint8ClampedArray[] = [];
  private glyphDeviceScale = 0;
  private glyphLight = false;
  private glyphFont = '';
  private prefetchTimer = 0;
  private prefetchFirst = 0;
  private prefetchLast = -1;
  private palette = readPalette();
  private lineCount = 0;
  private contentHeight = 1;
  private hostHeight = 0;
  private hostWidth = 0;
  private sliderTop = 0;
  private sliderHeight = 0;
  private thumbTop = 0;
  private thumbHeight = MIN_THUMB_HEIGHT;
  private dragKind: DragKind = null;
  private dragOffset = 0;
  private dragStartY = 0;
  private dragStartScrollTop = 0;
  private dragScrollPerPx = 1;
  private pendingLines = new Set<number>();
  private selectionDirty = false;
  private layoutDirty = false;
  private frame = 0;
  private resizeFrame = 0;
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;
  private pixelRatioMedia: MediaQueryList | null = null;
  private fontLoadingHandler: (() => void) | null = null;
  private destroyed = false;

  constructor(options: EditorMinimapOptions) {
    this.view = options.view;
    this.scrollElement = options.view.scrollDOM;
    this.host = options.host;
    this.baseCanvas = options.baseCanvas;
    this.overlayCanvas = options.overlayCanvas;
    this.slider = options.slider;
    this.scrollbar = options.scrollbar;
    this.scrollbarThumb = options.scrollbarThumb;
    this.enabled = options.enabled !== false;
    this.scale = clampMinimapScale(options.scale);
    this.maxColumn = clampMinimapMaxColumn(options.maxColumn);
    this.pixelRatio = clampPixelRatio(
      typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    );
    this.metrics = minimapCharMetrics(this.scale, this.pixelRatio);

    this.requestedWidth = minimapWidthPx(this.maxColumn, this.scale);
    this.host.style.width = `${this.requestedWidth}px`;
    this.host.style.display = this.enabled ? '' : 'none';
    this.prepareGlyphs();
    this.scrollElement.addEventListener('scroll', this.onScroll, {
      passive: true,
    });
    this.host.addEventListener('pointerdown', this.onMinimapPointerDown);
    this.host.addEventListener('pointermove', this.onMinimapPointerMove);
    this.host.addEventListener('pointerup', this.onPointerUp);
    this.host.addEventListener('pointercancel', this.onPointerUp);
    this.host.addEventListener('wheel', this.onWheel, { passive: false });
    this.scrollbar.addEventListener(
      'pointerdown',
      this.onScrollbarPointerDown,
    );
    this.scrollbar.addEventListener('pointermove', this.onScrollbarPointerMove);
    this.scrollbar.addEventListener('pointerup', this.onPointerUp);
    this.scrollbar.addEventListener('pointercancel', this.onPointerUp);
    this.scrollbar.addEventListener('wheel', this.onWheel, {
      passive: false,
    });
    this.scrollbar.addEventListener('keydown', this.onScrollbarKeyDown);
    this.scrollbar.addEventListener('focus', this.onScrollbarFocus);
    this.scrollbar.addEventListener('blur', this.onScrollbarBlur);

    this.updateWidth();

    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeFrame) return;
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = 0;
        this.schedule(true);
      });
    });
    this.resizeObserver.observe(this.host);
    this.resizeObserver.observe(this.scrollElement);

    this.themeObserver = new MutationObserver(() => this.schedule(true));
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        'data-theme',
        'data-custom-theme',
        'data-font',
        'style',
      ],
    });

    this.watchPixelRatio();
    this.watchFontLoading();
    this.layoutAll();
    this.updateViewport();
    this.drawAll();
    this.schedule(true);
  }

  setOptions(next: EditorMinimapSettings): void {
    const enabled = next.enabled ?? this.enabled;
    const scale = clampMinimapScale(next.scale ?? this.scale);
    const maxColumn = clampMinimapMaxColumn(
      next.maxColumn ?? this.maxColumn,
    );
    const enabledChanged = enabled !== this.enabled;
    const scaleChanged = scale !== this.scale;
    const columnChanged = maxColumn !== this.maxColumn;
    this.enabled = enabled;
    this.scale = scale;
    this.maxColumn = maxColumn;

    if (enabledChanged) {
      this.host.style.display = enabled ? '' : 'none';
      if (!enabled && this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
    }
    if (scaleChanged) {
      this.metrics = minimapCharMetrics(this.scale, this.pixelRatio);
      this.glyphMasks = [];
      this.prepareGlyphs();
    }
    this.updateWidth();
    if (enabled && (enabledChanged || scaleChanged || columnChanged)) {
      this.tiles.clear();
      this.segmentCache.clear();
      this.schedule(true);
    }
  }

  private prepareGlyphs(): void {
    const deviceScale = this.metrics.deviceScale;
    const light = this.palette.backgroundIsLight;
    const fontFamily =
      getComputedStyle(this.view.contentDOM).fontFamily ||
      '"JetBrains Mono", "Fira Code", monospace';
    if (
      this.glyphMasks.length > 0 &&
      this.glyphDeviceScale === deviceScale &&
      this.glyphLight === light &&
      this.glyphFont === fontFamily
    ) {
      return;
    }
    this.glyphDeviceScale = deviceScale;
    this.glyphLight = light;
    this.glyphFont = fontFamily;
    this.glyphMasks = this.sampleGlyphs(
      deviceScale,
      light ? LIGHT_GLYPH_SOFTEN : DARK_GLYPH_SOFTEN,
      fontFamily,
    );
  }

  private watchFontLoading(): void {
    const fonts = document.fonts;
    if (!fonts) return;
    const resample = (): void => {
      if (this.destroyed) return;
      this.glyphFont = '';
      this.prepareGlyphs();
      this.schedule(true);
    };
    this.fontLoadingHandler = resample;
    void fonts.ready.then(resample);
    fonts.addEventListener('loadingdone', resample);
  }

  /**
   * Samples a 16px bold font and downsamples each glyph to the minimap's
   * device-pixel grid, mirroring VS Code's MinimapCharRendererFactory.
   */
  private sampleGlyphs(
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
        index < MINIMAP_CHAR_COUNT - 1 ? 32 + index : 0xfffd;
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

  handleUpdate(update: ViewUpdate): void {
    if (update.docChanged) {
      let layoutShift = false;
      update.changes.iterChangedRanges(
        (fromA, toA, fromB, toB) => {
          const document = update.state.doc;
          const previous = update.startState.doc;
          const safeFrom = Math.min(fromB, document.length);
          const safeTo = Math.min(
            Math.max(fromB, toB - 1),
            document.length,
          );
          const start = document.lineAt(safeFrom).number;
          const end = document.lineAt(safeTo).number;
          const oldStart = previous.lineAt(
            Math.min(fromA, previous.length),
          ).number;
          const oldEnd = previous.lineAt(
            Math.min(Math.max(fromA, toA - 1), previous.length),
          ).number;
          if (end - start !== oldEnd - oldStart) layoutShift = true;
          for (let line = start; line <= end; line += 1) {
            this.pendingLines.add(line);
          }
        },
      );
      this.segmentCache.clear();
      if (layoutShift) this.layoutDirty = true;
      this.selectionDirty = true;
      this.schedule();
      return;
    }
    if (update.selectionSet) {
      this.selectionDirty = true;
      this.schedule();
    }
  }

  refresh(): void {
    this.schedule(true);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    if (this.prefetchTimer) window.clearTimeout(this.prefetchTimer);
    this.frame = 0;
    this.resizeFrame = 0;
    this.prefetchTimer = 0;
    this.tiles.clear();
    this.segmentCache.clear();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    this.pixelRatioMedia?.removeEventListener('change', this.onPixelRatioChange);
    this.pixelRatioMedia = null;
    if (this.fontLoadingHandler) {
      document.fonts?.removeEventListener(
        'loadingdone',
        this.fontLoadingHandler,
      );
      this.fontLoadingHandler = null;
    }
    this.scrollElement.removeEventListener('scroll', this.onScroll);
    this.host.removeEventListener('pointerdown', this.onMinimapPointerDown);
    this.host.removeEventListener('pointermove', this.onMinimapPointerMove);
    this.host.removeEventListener('pointerup', this.onPointerUp);
    this.host.removeEventListener('pointercancel', this.onPointerUp);
    this.host.removeEventListener('wheel', this.onWheel);
    this.scrollbar.removeEventListener(
      'pointerdown',
      this.onScrollbarPointerDown,
    );
    this.scrollbar.removeEventListener(
      'pointermove',
      this.onScrollbarPointerMove,
    );
    this.scrollbar.removeEventListener('pointerup', this.onPointerUp);
    this.scrollbar.removeEventListener('pointercancel', this.onPointerUp);
    this.scrollbar.removeEventListener('wheel', this.onWheel);
    this.scrollbar.removeEventListener('keydown', this.onScrollbarKeyDown);
    this.scrollbar.removeEventListener('focus', this.onScrollbarFocus);
    this.scrollbar.removeEventListener('blur', this.onScrollbarBlur);
  }

  private watchPixelRatio(): void {
    if (typeof window.matchMedia !== 'function') return;
    this.pixelRatioMedia?.removeEventListener('change', this.onPixelRatioChange);
    try {
      this.pixelRatioMedia = window.matchMedia(
        `(resolution: ${this.pixelRatio}dppx)`,
      );
      this.pixelRatioMedia.addEventListener(
        'change',
        this.onPixelRatioChange,
      );
    } catch {
      this.pixelRatioMedia = null;
    }
  }

  private onPixelRatioChange = (): void => {
    const next = clampPixelRatio(window.devicePixelRatio);
    this.watchPixelRatio();
    if (next === this.pixelRatio) return;
    this.pixelRatio = next;
    this.metrics = minimapCharMetrics(this.scale, this.pixelRatio);
    this.glyphMasks = [];
    this.updateWidth();
    this.schedule(true);
  };

  private onScroll = (): void => {
    if (this.updateViewport()) this.scheduleDraw();
  };

  private scheduleDraw(): void {
    this.drawDirty = true;
    this.schedule();
  }

  private updateWidth(): void {
    const parentWidth = this.host.parentElement?.clientWidth ?? 0;
    const availableWidth =
      parentWidth > 0
        ? parentWidth
        : this.scrollElement.clientWidth + this.host.clientWidth;
    const measured = this.view.defaultCharacterWidth;
    const fontSize = Number.parseFloat(
      getComputedStyle(this.scrollElement).fontSize,
    );
    const characterWidth =
      measured > 0
        ? measured
        : Number.isFinite(fontSize) && fontSize > 0
          ? fontSize * 0.6
          : 9;
    const width = minimapWidthPx(this.maxColumn, this.scale, {
      availableWidth,
      characterWidth,
      scrollbarWidth: this.scrollbar.offsetWidth,
      pixelRatio: this.pixelRatio,
    });
    if (width === this.requestedWidth) return;
    this.requestedWidth = width;
    this.host.style.width = `${width}px`;
  }

  private schedule(forceLayout = false): void {
    if (!this.enabled || this.destroyed) return;
    if (forceLayout) this.layoutDirty = true;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.flush();
    });
  }

  private flush(): void {
    if (!this.enabled) return;
    const lineCount = this.view.state.doc.lines;
    this.updateWidth();
    const contentHeight = Math.max(1, this.view.contentHeight);
    const hostHeight = this.host.clientHeight;
    const hostWidth = this.host.clientWidth;
    const charsPerRow = this.measureCharsPerRow();
    const layoutChanged =
      this.layoutDirty ||
      lineCount !== this.lineCount ||
      contentHeight !== this.contentHeight ||
      hostHeight !== this.hostHeight ||
      hostWidth !== this.hostWidth ||
      charsPerRow !== this.charsPerRow;

    if (layoutChanged) {
      this.layoutAll();
      this.updateViewport();
      this.drawAll();
      this.pendingLines.clear();
      this.layoutDirty = false;
      this.drawDirty = false;
      this.selectionDirty = false;
      return;
    }

    if (this.pendingLines.size > 0) {
      if (!this.redrawLines(this.pendingLines)) {
        this.layoutAll();
        this.updateViewport();
        this.drawAll();
        this.pendingLines.clear();
        this.layoutDirty = false;
        this.drawDirty = false;
        this.selectionDirty = false;
        return;
      }
      this.selectionDirty = false;
    }
    this.pendingLines.clear();
    this.layoutDirty = false;

    if (this.drawDirty) {
      this.drawAll();
      this.drawDirty = false;
      this.selectionDirty = false;
    }
    if (this.selectionDirty) {
      this.drawOverlay();
      this.selectionDirty = false;
    }
  }

  private layoutAll(): void {
    const state = this.view.state;
    this.palette = readPalette();
    this.metrics = minimapCharMetrics(this.scale, this.pixelRatio);
    this.prepareGlyphs();
    this.contentHeight = Math.max(1, this.view.contentHeight);
    this.hostHeight = this.host.clientHeight;
    this.hostWidth = this.host.clientWidth;
    this.lineCount = state.doc.lines;
    this.charsPerRow = this.measureCharsPerRow();

    const rowCounts: number[] = [];
    let totalRows = 0;
    for (let number = 1; number <= state.doc.lines; number += 1) {
      const visualRows = this.measureVisualRows(
        state.doc.line(number).from,
      );
      rowCounts.push(visualRows);
      totalRows += visualRows;
    }
    this.totalRows = Math.max(1, totalRows);
    this.virtualHeight = this.totalRows * this.metrics.rowPitchCss;
    this.tiles.clear();
    this.segmentCache.clear();

    const lines: LineInfo[] = [];
    let rowStart = 0;
    for (let number = 1; number <= state.doc.lines; number += 1) {
      const visualRows = rowCounts[number - 1];
      lines.push({
        number,
        text: state.doc.line(number).text,
        rowStart,
        visualRows,
        top: rowStart * this.metrics.rowPitchCss,
      });
      rowStart += visualRows;
    }
    this.lines = lines;
  }

  private measureVisualRows(from: number): number {
    const block = this.view.lineBlockAt(from);
    const lineHeight = Math.max(1, this.view.defaultLineHeight);
    return Math.max(
      1,
      Math.min(
        MAX_VISUAL_ROWS,
        Math.round(block.height / lineHeight),
      ),
    );
  }

  private measureCharsPerRow(): number {
    const styles = getComputedStyle(this.view.contentDOM);
    const padding =
      (Number.parseFloat(styles.paddingLeft) || 0) +
      (Number.parseFloat(styles.paddingRight) || 0);
    const width = this.view.contentDOM.clientWidth - padding;
    const characterWidth = this.view.defaultCharacterWidth;
    if (!(width > 0) || !(characterWidth > 0)) {
      return Math.max(1, this.maxColumn);
    }
    return Math.max(1, Math.floor(width / characterWidth));
  }

  private firstVisibleLineIndex(start: number): number {
    let low = 0;
    let high = this.lines.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const line = this.lines[middle];
      const bottom =
        line.top + line.visualRows * this.metrics.rowPitchCss;
      if (bottom < start) low = middle + 1;
      else high = middle;
    }
    return Math.max(0, low - 1);
  }

  private ensureCanvases(): boolean {
    const widthCss = this.host.clientWidth;
    const heightCss = this.host.clientHeight;
    if (widthCss < 2 || heightCss < 2) return false;
    const pixelWidth = Math.max(1, Math.round(widthCss * this.pixelRatio));
    const pixelHeight = Math.max(
      1,
      Math.round(heightCss * this.pixelRatio),
    );
    const changed =
      this.canvasWidthDevice !== pixelWidth ||
      this.canvasHeightDevice !== pixelHeight;

    for (const canvas of [this.baseCanvas, this.overlayCanvas]) {
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
    }

    const base = this.baseCanvas.getContext('2d');
    const overlay = this.overlayCanvas.getContext('2d');
    if (!base || !overlay) return false;
    base.setTransform(1, 0, 0, 1, 0, 0);
    base.imageSmoothingEnabled = false;
    overlay.setTransform(1, 0, 0, 1, 0, 0);
    overlay.imageSmoothingEnabled = false;
    this.baseContext = base;
    this.overlayContext = overlay;
    this.canvasWidthDevice = pixelWidth;
    this.canvasHeightDevice = pixelHeight;
    this.widthCss = widthCss;
    this.heightCss = heightCss;
    if (changed) this.tiles.clear();
    return true;
  }

  private ensureSegments(firstLine: number, lastLine: number): void {
    const start = Math.max(1, Math.min(firstLine, lastLine));
    const end = Math.min(
      this.view.state.doc.lines,
      Math.max(firstLine, lastLine),
    );
    const missing: number[] = [];
    for (let number = start; number <= end; number += 1) {
      if (!this.segmentCache.has(number)) missing.push(number);
    }
    if (!missing.length) return;

    const state = this.view.state;
    const targets = new Set(missing);
    syntaxTree(state).iterate({
      from: state.doc.line(missing[0]).from,
      to: state.doc.line(missing[missing.length - 1]).to,
      enter: (node) => {
        const paint = nodeStyle(node.name, this.palette);
        if (!paint) return undefined;
        let line = state.doc.lineAt(node.from);
        while (true) {
          if (targets.has(line.number)) {
            const from = Math.max(node.from, line.from) - line.from;
            const to = Math.min(node.to, line.to) - line.from;
            if (to > from) {
              const list = this.segmentCache.get(line.number) ?? [];
              list.push({
                from,
                to,
                color: paint.color,
                alpha: paint.alpha,
              });
              this.segmentCache.set(line.number, list);
            }
          }
          if (line.to >= node.to || line.number >= state.doc.lines) break;
          line = state.doc.line(line.number + 1);
        }
        return false;
      },
    });

    for (const number of missing) {
      const list = this.segmentCache.get(number);
      if (list) {
        list.sort(
          (left, right) => left.from - right.from || left.to - right.to,
        );
      } else {
        this.segmentCache.set(number, []);
      }
    }
  }

  private ensureTile(index: number): HTMLCanvasElement | null {
    const startCss = index * TILE_HEIGHT;
    if (
      index < 0 ||
      startCss >= this.virtualHeight ||
      this.canvasWidthDevice < 2
    ) {
      return null;
    }
    const cached = this.tiles.get(index);
    if (cached) return cached;

    const endCss = Math.min(startCss + TILE_HEIGHT, this.virtualHeight);
    const startDevice = Math.round(startCss * this.pixelRatio);
    const endDevice = Math.max(
      startDevice + 1,
      Math.round(endCss * this.pixelRatio),
    );
    const heightDevice = endDevice - startDevice;
    const canvas = document.createElement('canvas');
    canvas.width = this.canvasWidthDevice;
    canvas.height = heightDevice;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const image = context.createImageData(canvas.width, canvas.height);

    const first = this.firstVisibleLineIndex(
      startCss - this.metrics.rowPitchCss,
    );
    let last = first;
    while (last < this.lines.length) {
      if (this.lines[last].top > endCss) break;
      last += 1;
    }
    if (first < last) {
      this.ensureSegments(
        this.lines[first].number,
        this.lines[last - 1].number,
      );
      for (let lineIndex = first; lineIndex < last; lineIndex += 1) {
        this.paintLine(
          image.data,
          image.width,
          image.height,
          this.lines[lineIndex],
          startCss,
        );
      }
    }
    context.putImageData(image, 0, 0);

    this.tiles.set(index, canvas);
    while (this.tiles.size > MAX_TILE_CACHE) {
      const oldest = this.tiles.keys().next().value;
      if (oldest === undefined) break;
      this.tiles.delete(oldest);
    }
    return canvas;
  }

  private invalidateTiles(top: number, bottom: number): void {
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) return;
    const first = Math.max(0, Math.floor(top / TILE_HEIGHT));
    const last = Math.floor(Math.max(0, bottom - 1) / TILE_HEIGHT);
    for (let index = first; index <= last; index += 1) {
      this.tiles.delete(index);
    }
  }

  private prefetchTiles(first: number, last: number): void {
    this.prefetchFirst = first;
    this.prefetchLast = last;
    if (this.prefetchTimer) return;
    this.prefetchTimer = window.setTimeout(() => {
      this.prefetchTimer = 0;
      for (const index of [
        this.prefetchFirst - 1,
        this.prefetchLast + 1,
      ]) {
        if (index >= 0 && !this.tiles.has(index)) {
          this.ensureTile(index);
        }
      }
    }, 0);
  }

  private drawAll(): void {
    if (!this.enabled) return;
    if (!this.ensureCanvases() || !this.baseContext) return;
    const width = this.canvasWidthDevice;
    const height = this.canvasHeightDevice;
    this.baseContext.clearRect(0, 0, width, height);
    this.baseContext.imageSmoothingEnabled = false;
    const startCss = clamp(this.sliceOffset, 0, this.virtualHeight);
    const endCss = Math.min(this.virtualHeight, startCss + this.heightCss);
    if (endCss <= startCss) {
      this.drawOverlay();
      return;
    }

    const firstTile = Math.floor(startCss / TILE_HEIGHT);
    const lastTile = Math.floor(
      Math.max(startCss, endCss - 0.001) / TILE_HEIGHT,
    );
    for (let index = firstTile; index <= lastTile; index += 1) {
      const tile = this.ensureTile(index);
      if (!tile) continue;
      const tileStartCss = index * TILE_HEIGHT;
      const tileStartDevice = Math.round(
        tileStartCss * this.pixelRatio,
      );
      const sourceTopCss = Math.max(startCss, tileStartCss);
      const sourceBottomCss = Math.min(
        endCss,
        tileStartCss + TILE_HEIGHT,
      );
      if (sourceBottomCss <= sourceTopCss) continue;
      const sourceTopDevice = clamp(
        Math.round(sourceTopCss * this.pixelRatio) - tileStartDevice,
        0,
        tile.height,
      );
      const sourceBottomDevice = clamp(
        Math.round(sourceBottomCss * this.pixelRatio) - tileStartDevice,
        sourceTopDevice,
        tile.height,
      );
      const sourceHeight = sourceBottomDevice - sourceTopDevice;
      if (sourceHeight <= 0) continue;
      const destinationTop = Math.round(
        (sourceTopCss - startCss) * this.pixelRatio,
      );
      this.baseContext.drawImage(
        tile,
        0,
        sourceTopDevice,
        tile.width,
        sourceHeight,
        0,
        destinationTop,
        tile.width,
        sourceHeight,
      );
    }
    this.drawOverlay();
    this.prefetchTiles(firstTile, lastTile);
  }

  private redrawLines(changed: Set<number>): boolean {
    if (!this.ensureCanvases()) return true;
    const state = this.view.state;
    for (const number of changed) {
      if (number < 1 || number > this.lines.length) continue;
      const visualRows = this.measureVisualRows(
        state.doc.line(number).from,
      );
      if (visualRows !== this.lines[number - 1].visualRows) {
        return false;
      }
    }

    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    for (const number of changed) {
      if (number < 1 || number > this.lines.length) continue;
      const previous = this.lines[number - 1];
      const next: LineInfo = {
        number,
        text: state.doc.line(number).text,
        rowStart: previous.rowStart,
        visualRows: previous.visualRows,
        top: previous.top,
      };
      this.lines[number - 1] = next;
      top = Math.min(top, previous.top, next.top);
      bottom = Math.max(
        bottom,
        previous.top + previous.visualRows * this.metrics.rowPitchCss,
        next.top + next.visualRows * this.metrics.rowPitchCss,
      );
    }
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
      return false;
    }

    this.invalidateTiles(top, bottom);
    this.drawAll();
    return true;
  }

  private paintLine(
    data: Uint8ClampedArray,
    widthDevice: number,
    heightDevice: number,
    line: LineInfo,
    tileStartCss: number,
  ): void {
    if (!line.text) return;
    const charWidthDevice = this.metrics.charWidthDevice;
    const charHeightDevice = this.metrics.charHeightDevice;
    const gutterDevice = Math.round(
      MINIMAP_GUTTER_WIDTH * this.pixelRatio,
    );
    const rightLimit = widthDevice - charWidthDevice;
    const segments = this.segmentCache.get(line.number) ?? [];
    const chunks = splitChunks(line.text, line.visualRows);
    let segmentIndex = 0;

    for (let row = 0; row < chunks.length; row += 1) {
      const chunk = chunks[row];
      const y = Math.round(
        (line.top + row * this.metrics.rowPitchCss - tileStartCss) *
          this.pixelRatio,
      );
      if (y >= heightDevice || y + charHeightDevice <= 0) continue;
      const limit = Math.min(chunk.end, chunk.start + this.maxColumn);
      let displayColumn = 0;
      for (let column = chunk.start; column < limit; ) {
        const codePoint = line.text.codePointAt(column) ?? 32;
        const advance = minimapCharAdvance(
          codePoint,
          displayColumn,
          TAB_SIZE,
        );
        const x = gutterDevice + displayColumn * charWidthDevice;
        if (advance.paint && x < rightLimit) {
          while (
            segmentIndex < segments.length &&
            segments[segmentIndex].to <= column
          ) {
            segmentIndex += 1;
          }
          const segment = segments[segmentIndex];
          const painted =
            segment && column >= segment.from && column < segment.to;
          const color = painted ? segment.color : this.palette.base;
          const alpha = painted ? segment.alpha : BASE_ALPHA;
          const mask =
            this.glyphMasks[
              minimapCharIndex(codePoint, this.metrics.deviceScale)
            ];
          if (mask && x + charWidthDevice <= rightLimit) {
            this.blendGlyph(
              data,
              widthDevice,
              heightDevice,
              mask,
              x,
              y,
              color,
              alpha,
            );
          }
        }
        displayColumn += advance.columns;
        column += codePoint > 0xffff ? 2 : 1;
      }
    }
  }

  private blendGlyph(
    data: Uint8ClampedArray,
    widthDevice: number,
    heightDevice: number,
    mask: Uint8ClampedArray,
    x: number,
    y: number,
    color: RGBColor,
    alpha: number,
  ): void {
    const charWidthDevice = this.metrics.charWidthDevice;
    const charHeightDevice = this.metrics.charHeightDevice;
    if (
      x < 0 ||
      y < 0 ||
      x + charWidthDevice > widthDevice ||
      y + charHeightDevice > heightDevice
    ) {
      return;
    }
    const alphaByte = clamp(alpha * color.a * 255, 0, 255);
    if (alphaByte <= 0) return;
    for (let row = 0; row < charHeightDevice; row += 1) {
      for (let column = 0; column < charWidthDevice; column += 1) {
        const intensity = mask[row * charWidthDevice + column];
        if (!intensity) continue;
        const outAlpha = (intensity * alphaByte) / 255;
        if (outAlpha <= 0) continue;
        const offset = ((y + row) * widthDevice + (x + column)) * 4;
        const currentAlpha = data[offset + 3];
        if (outAlpha > currentAlpha) {
          data[offset] = color.r;
          data[offset + 1] = color.g;
          data[offset + 2] = color.b;
          data[offset + 3] = outAlpha;
        }
      }
    }
  }

  private drawOverlay(): void {
    if (!this.overlayContext) return;
    this.overlayContext.clearRect(
      0,
      0,
      this.canvasWidthDevice,
      this.canvasHeightDevice,
    );
    if (!this.lines.length) return;

    const state = this.view.state;
    const renderOffset = this.sliceOffset;
    const ratio = this.pixelRatio;
    this.overlayContext.globalAlpha = 0.5;
    this.overlayContext.fillStyle = this.palette.selection;
    for (const range of state.selection.ranges) {
      if (range.empty) continue;
      const start = this.lines[
        state.doc.lineAt(range.from).number - 1
      ];
      const end = this.lines[
        state.doc.lineAt(range.to).number - 1
      ];
      if (!start || !end) continue;
      const top = Math.max(0, start.top - renderOffset);
      const bottom = Math.min(
        this.heightCss,
        end.top +
          end.visualRows * this.metrics.rowPitchCss -
          renderOffset,
      );
      if (bottom <= top) continue;
      this.overlayContext.fillRect(
        Math.round(ratio),
        Math.round(top * ratio),
        Math.max(1, Math.round((this.widthCss - 2) * ratio)),
        Math.max(1, Math.round((bottom - top) * ratio)),
      );
    }
    this.overlayContext.globalAlpha = 1;
  }

  private updateViewport(): boolean {
    const previousOffset = this.sliceOffset;
    const clientHeight = this.scrollElement.clientHeight;
    const scrollHeight = this.scrollElement.scrollHeight;
    const hostHeight = this.host.clientHeight;
    const maximum = Math.max(0, scrollHeight - clientHeight);
    const ratio =
      maximum > 0 ? this.scrollElement.scrollTop / maximum : 0;
    const virtualHeight = Math.max(1, this.virtualHeight);

    if (hostHeight <= 0) {
      this.sliceOffset = 0;
      this.sliderTop = 0;
      this.sliderHeight = 0;
      this.slider.style.height = '0px';
      this.slider.style.transform = 'translateY(0px)';
      return false;
    }

    let sliderTop = 0;
    let sliderHeight = 0;
    let offset = 0;

    if (virtualHeight > hostHeight) {
      const viewportVirtual = Math.min(
        virtualHeight,
        Math.max(
          18,
          virtualHeight *
            (clientHeight / Math.max(1, scrollHeight)),
        ),
      );
      const virtualMaximum = Math.max(
        0,
        virtualHeight - viewportVirtual,
      );
      const virtualTop = clamp(ratio, 0, 1) * virtualMaximum;
      this.viewportHeightVirtual = viewportVirtual;
      sliderHeight = Math.min(
        hostHeight,
        Math.max(18, viewportVirtual),
      );
      const sliderTravel = Math.max(0, hostHeight - sliderHeight);
      sliderTop = clamp(ratio, 0, 1) * sliderTravel;
      offset = clamp(
        virtualTop - sliderTop,
        0,
        virtualHeight - hostHeight,
      );
    } else {
      const metrics = minimapViewportMetrics(
        this.scrollElement.scrollTop,
        clientHeight,
        scrollHeight,
        virtualHeight,
        18,
      );
      this.viewportHeightVirtual = metrics.height;
      sliderTop = metrics.top;
      sliderHeight = metrics.height;
    }

    this.sliceOffset = offset;
    this.sliderTop = sliderTop;
    this.sliderHeight = sliderHeight;
    this.slider.style.height = `${sliderHeight}px`;
    this.slider.style.transform = `translateY(${sliderTop}px)`;

    const trackHeight = this.scrollbar.clientHeight;
    if (trackHeight > 0) {
      this.thumbHeight = Math.max(
        MIN_THUMB_HEIGHT,
        Math.min(
          trackHeight,
          trackHeight * (clientHeight / Math.max(1, scrollHeight)),
        ),
      );
      this.thumbTop =
        (trackHeight - this.thumbHeight) * clamp(ratio, 0, 1);
      this.scrollbarThumb.style.height = `${this.thumbHeight}px`;
      this.scrollbarThumb.style.transform = `translateY(${this.thumbTop}px)`;
    }
    this.scrollbar.setAttribute(
      'aria-valuenow',
      String(Math.round(clamp(ratio, 0, 1) * 100)),
    );
    return offset !== previousOffset;
  }

  private scrollToRatio(ratio: number): void {
    this.scrollElement.scrollTop = minimapScrollTop(
      ratio,
      this.scrollElement.scrollHeight,
      this.scrollElement.clientHeight,
    );
    this.updateViewport();
  }

  private onMinimapPointerDown = (event: PointerEvent): void => {
    if (!this.enabled || event.button !== 0) return;
    const rect = this.host.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const visibleHeight =
      this.virtualHeight > rect.height
        ? rect.height
        : this.virtualHeight;
    if (y < 0 || y > visibleHeight) return;
    const insideSlider =
      y >= this.sliderTop &&
      y <= this.sliderTop + this.sliderHeight;

    if (!insideSlider) {
      event.preventDefault();
      if (this.virtualHeight > rect.height) {
        const virtualY = this.sliceOffset + y;
        const maximum = Math.max(
          1,
          this.virtualHeight - this.viewportHeightVirtual,
        );
        this.scrollToRatio(
          (virtualY - this.viewportHeightVirtual / 2) / maximum,
        );
      } else {
        const track = Math.max(
          1,
          this.virtualHeight - this.sliderHeight,
        );
        this.scrollToRatio(y / track);
      }
      return;
    }

    event.preventDefault();
    const travel = Math.max(1, rect.height - this.sliderHeight);
    const maximum = Math.max(
      0,
      this.scrollElement.scrollHeight - this.scrollElement.clientHeight,
    );
    this.dragKind = 'minimap';
    this.dragStartY = event.clientY;
    this.dragStartScrollTop = this.scrollElement.scrollTop;
    this.dragScrollPerPx = maximum / travel;
    this.host.setPointerCapture(event.pointerId);
    this.host.classList.add('is-dragging');
  };

  private onMinimapPointerMove = (event: PointerEvent): void => {
    if (this.dragKind !== 'minimap') return;
    event.preventDefault();
    const maximum = Math.max(
      0,
      this.scrollElement.scrollHeight - this.scrollElement.clientHeight,
    );
    this.scrollElement.scrollTop = clamp(
      this.dragStartScrollTop +
        (event.clientY - this.dragStartY) * this.dragScrollPerPx,
      0,
      maximum,
    );
    if (this.updateViewport()) this.scheduleDraw();
  };

  private onScrollbarPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = this.scrollbar.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const insideThumb =
      y >= this.thumbTop && y <= this.thumbTop + this.thumbHeight;
    this.dragKind = 'scrollbar';
    this.dragOffset = insideThumb
      ? y - this.thumbTop
      : this.thumbHeight / 2;
    this.scrollbar.setPointerCapture(event.pointerId);
    this.scrollbar.classList.add('is-dragging');
    this.moveScrollbar(event.clientY);
  };

  private onScrollbarPointerMove = (event: PointerEvent): void => {
    if (this.dragKind !== 'scrollbar') return;
    event.preventDefault();
    this.moveScrollbar(event.clientY);
  };

  private moveScrollbar(clientY: number): void {
    const rect = this.scrollbar.getBoundingClientRect();
    const track = Math.max(1, rect.height - this.thumbHeight);
    const y = clientY - rect.top - this.dragOffset;
    this.scrollToRatio(y / track);
  }

  private onPointerUp = (event: PointerEvent): void => {
    const wasMinimap = this.dragKind === 'minimap';
    if (this.dragKind === 'minimap') {
      this.host.classList.remove('is-dragging');
      if (this.host.hasPointerCapture(event.pointerId)) {
        this.host.releasePointerCapture(event.pointerId);
      }
    } else if (this.dragKind === 'scrollbar') {
      this.scrollbar.classList.remove('is-dragging');
      if (this.scrollbar.hasPointerCapture(event.pointerId)) {
        this.scrollbar.releasePointerCapture(event.pointerId);
      }
    }
    this.dragKind = null;
    if (wasMinimap && this.updateViewport()) {
      this.scheduleDraw();
    }
  };

  private onWheel = (event: WheelEvent): void => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      event.deltaY === 0 ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
    ) {
      return;
    }
    const maximum =
      this.scrollElement.scrollHeight - this.scrollElement.clientHeight;
    if (maximum <= 0) return;
    event.preventDefault();
    this.scrollElement.scrollTop = clamp(
      this.scrollElement.scrollTop +
        wheelDeltaPixels(event, this.scrollElement.clientHeight),
      0,
      maximum,
    );
    this.updateViewport();
  };

  private onScrollbarKeyDown = (event: KeyboardEvent): void => {
    const maximum =
      this.scrollElement.scrollHeight - this.scrollElement.clientHeight;
    if (maximum <= 0) return;
    let delta: number | null = null;
    switch (event.key) {
      case 'ArrowUp':
        delta = -48;
        break;
      case 'ArrowDown':
        delta = 48;
        break;
      case 'PageUp':
        delta = -this.scrollElement.clientHeight * 0.85;
        break;
      case 'PageDown':
        delta = this.scrollElement.clientHeight * 0.85;
        break;
      case 'Home':
        delta = -this.scrollElement.scrollTop;
        break;
      case 'End':
        delta = maximum - this.scrollElement.scrollTop;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.scrollElement.scrollTop = clamp(
      this.scrollElement.scrollTop + delta,
      0,
      maximum,
    );
    this.updateViewport();
  };

  private onScrollbarFocus = (): void => {
    this.host.classList.add('is-focused');
  };

  private onScrollbarBlur = (): void => {
    this.host.classList.remove('is-focused');
  };
}
