import { syntaxTree } from '@codemirror/language';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import {
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
import {
  DARK_GLYPH_SOFTEN,
  LIGHT_GLYPH_SOFTEN,
  sampleMinimapGlyphs,
} from './minimapGlyphs';
import { splitMinimapChunks } from './minimapLines';
import {
  minimapNodeColor,
  readMinimapPalette,
  type MinimapPalette,
  type RGBColor,
} from './minimapPalette';
import { wheelDeltaPixels } from './wheelScroll';

const MIN_THUMB_HEIGHT = 24;
const TILE_HEIGHT = 128;
const MAX_TILE_POOL = 8;
const MIN_TILE_CACHE = 12;
const MAX_TILE_CACHE = 48;
const MAX_VISUAL_ROWS = 2000;
const MAX_DEVICE_PIXEL_RATIO = 3;
const TAB_SIZE = 4;

interface MinimapSegment {
  from: number;
  to: number;
  color: RGBColor;
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampPixelRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, value));
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
  private lineTops = new Float64Array(0);
  private lineRows = new Uint16Array(0);
  private tileCacheLimit = 24;
  private tiles = new Map<number, HTMLCanvasElement>();
  private tilePool: HTMLCanvasElement[] = [];
  private segmentCache = new Map<number, MinimapSegment[]>();
  private glyphMasks: Uint8ClampedArray[] = [];
  private glyphDeviceScale = 0;
  private glyphLight = false;
  private glyphFont = '';
  private characterWidth = 9;
  private fontFamily = '';
  private prefetchTimer = 0;
  private prefetchFirst = 0;
  private prefetchLast = -1;
  private palette = readMinimapPalette();
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
    this.refreshFontMetrics();
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
        this.updateWidth();
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
      if (!enabled) {
        this.clearTiles();
        this.segmentCache.clear();
        if (this.frame) {
          cancelAnimationFrame(this.frame);
          this.frame = 0;
        }
      }
    }
    if (scaleChanged) {
      this.metrics = minimapCharMetrics(this.scale, this.pixelRatio);
      this.glyphMasks = [];
      this.prepareGlyphs();
    }
    this.updateWidth();
    if (enabled && (enabledChanged || scaleChanged || columnChanged)) {
      this.clearTiles();
      this.segmentCache.clear();
      this.schedule(true);
    }
  }

  private prepareGlyphs(): void {
    const deviceScale = this.metrics.deviceScale;
    const light = this.palette.backgroundIsLight;
    if (
      this.glyphMasks.length > 0 &&
      this.glyphDeviceScale === deviceScale &&
      this.glyphLight === light &&
      this.glyphFont === this.fontFamily
    ) {
      return;
    }
    this.glyphDeviceScale = deviceScale;
    this.glyphLight = light;
    this.glyphFont = this.fontFamily;
    this.glyphMasks = sampleMinimapGlyphs(
      deviceScale,
      light ? LIGHT_GLYPH_SOFTEN : DARK_GLYPH_SOFTEN,
      this.fontFamily,
    );
  }

  private refreshFontMetrics(): boolean {
    const styles = getComputedStyle(this.view.contentDOM);
    const fontSize = Number.parseFloat(styles.fontSize);
    this.fontFamily =
      styles.fontFamily || '"JetBrains Mono", "Fira Code", monospace';
    const measured = this.view.defaultCharacterWidth;
    const characterWidth =
      measured > 0
        ? measured
        : Number.isFinite(fontSize) && fontSize > 0
          ? fontSize * 0.6
          : 9;
    if (characterWidth === this.characterWidth) return false;
    this.characterWidth = characterWidth;
    return true;
  }

  private watchFontLoading(): void {
    const fonts = document.fonts;
    if (!fonts) return;
    const resample = (): void => {
      if (this.destroyed) return;
      this.glyphFont = '';
      this.prepareGlyphs();
      this.clearTiles();
      this.schedule(true);
    };
    this.fontLoadingHandler = resample;
    void fonts.ready.then(resample);
    fonts.addEventListener('loadingdone', resample);
  }

  private clearTiles(): void {
    this.tiles.clear();
    this.tilePool.length = 0;
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
    this.clearTiles();
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
    const width = minimapWidthPx(this.maxColumn, this.scale, {
      availableWidth,
      characterWidth: this.characterWidth,
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
    const contentHeight = Math.max(1, this.view.contentHeight);
    const hostHeight = this.host.clientHeight;
    const hostWidth = this.host.clientWidth;
    const layoutChanged =
      this.layoutDirty ||
      lineCount !== this.lineCount ||
      contentHeight !== this.contentHeight ||
      hostHeight !== this.hostHeight ||
      hostWidth !== this.hostWidth;

    if (layoutChanged) {
      this.rebuildAll();
      return;
    }

    if (this.pendingLines.size > 0) {
      if (!this.redrawLines(this.pendingLines)) {
        this.rebuildAll();
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

  private rebuildAll(): void {
    this.layoutAll();
    this.updateViewport();
    this.drawAll();
    this.pendingLines.clear();
    this.layoutDirty = false;
    this.drawDirty = false;
    this.selectionDirty = false;
  }

  private layoutAll(): void {
    const state = this.view.state;
    this.palette = readMinimapPalette();
    const fontChanged = this.refreshFontMetrics();
    if (fontChanged) this.updateWidth();
    this.metrics = minimapCharMetrics(this.scale, this.pixelRatio);
    this.prepareGlyphs();
    this.contentHeight = Math.max(1, this.view.contentHeight);
    this.hostHeight = this.host.clientHeight;
    this.hostWidth = this.host.clientWidth;
    this.lineCount = state.doc.lines;

    const lineCount = state.doc.lines;
    const tops = new Float64Array(lineCount);
    const rows = new Uint16Array(lineCount);
    const rowPitch = this.metrics.rowPitchCss;
    let totalRows = 0;
    for (let number = 1; number <= lineCount; number += 1) {
      const visualRows = this.measureVisualRows(
        state.doc.line(number).from,
      );
      tops[number - 1] = totalRows * rowPitch;
      rows[number - 1] = visualRows;
      totalRows += visualRows;
    }
    this.virtualHeight = Math.max(1, totalRows) * rowPitch;
    this.tileCacheLimit = Math.min(
      MAX_TILE_CACHE,
      Math.max(
        MIN_TILE_CACHE,
        Math.ceil(this.hostHeight / TILE_HEIGHT) * 3 + 4,
      ),
    );
    this.clearTiles();
    this.segmentCache.clear();
    this.lineTops = tops;
    this.lineRows = rows;
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

  private firstVisibleLineIndex(start: number): number {
    let low = 0;
    let high = this.lineTops.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const bottom =
        this.lineTops[middle] +
        this.lineRows[middle] * this.metrics.rowPitchCss;
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

    if (changed) {
      for (const canvas of [this.baseCanvas, this.overlayCanvas]) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
    }

    if (!this.baseContext) {
      this.baseContext = this.baseCanvas.getContext('2d');
      this.overlayContext = this.overlayCanvas.getContext('2d');
    }
    const base = this.baseContext;
    const overlay = this.overlayContext;
    if (!base || !overlay) return false;
    if (changed) {
      base.setTransform(1, 0, 0, 1, 0, 0);
      base.imageSmoothingEnabled = false;
      overlay.setTransform(1, 0, 0, 1, 0, 0);
      overlay.imageSmoothingEnabled = false;
      this.clearTiles();
    }
    this.canvasWidthDevice = pixelWidth;
    this.canvasHeightDevice = pixelHeight;
    this.widthCss = widthCss;
    this.heightCss = heightCss;
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
        const color = minimapNodeColor(node.name, this.palette);
        if (!color) return undefined;
        let line = state.doc.lineAt(node.from);
        while (true) {
          if (targets.has(line.number)) {
            const from = Math.max(node.from, line.from) - line.from;
            const to = Math.min(node.to, line.to) - line.from;
            if (to > from) {
              const list = this.segmentCache.get(line.number) ?? [];
              list.push({ from, to, color });
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
    const canvas =
      this.tilePool.pop() ?? document.createElement('canvas');
    canvas.width = this.canvasWidthDevice;
    canvas.height = heightDevice;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const image = context.createImageData(canvas.width, canvas.height);

    const first = this.firstVisibleLineIndex(
      startCss - this.metrics.rowPitchCss,
    );
    let last = first;
    while (last < this.lineTops.length) {
      if (this.lineTops[last] > endCss) break;
      last += 1;
    }
    if (first < last) {
      this.ensureSegments(first + 1, last);
      for (let lineIndex = first; lineIndex < last; lineIndex += 1) {
        this.paintLine(
          image.data,
          image.width,
          image.height,
          lineIndex,
          startCss,
        );
      }
    }
    context.putImageData(image, 0, 0);

    this.tiles.set(index, canvas);
    while (this.tiles.size > this.tileCacheLimit) {
      const oldest = this.tiles.keys().next().value;
      if (oldest === undefined) break;
      const evicted = this.tiles.get(oldest);
      this.tiles.delete(oldest);
      if (evicted && this.tilePool.length < MAX_TILE_POOL) {
        this.tilePool.push(evicted);
      }
    }
    return canvas;
  }

  private invalidateTiles(top: number, bottom: number): void {
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) return;
    const first = Math.max(0, Math.floor(top / TILE_HEIGHT));
    const last = Math.floor(Math.max(0, bottom - 1) / TILE_HEIGHT);
    for (let index = first; index <= last; index += 1) {
      const tile = this.tiles.get(index);
      this.tiles.delete(index);
      if (tile && this.tilePool.length < MAX_TILE_POOL) {
        this.tilePool.push(tile);
      }
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
      if (number < 1 || number > this.lineRows.length) continue;
      const visualRows = this.measureVisualRows(
        state.doc.line(number).from,
      );
      if (visualRows !== this.lineRows[number - 1]) {
        return false;
      }
    }

    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    for (const number of changed) {
      if (number < 1 || number > this.lineRows.length) continue;
      const index = number - 1;
      top = Math.min(top, this.lineTops[index]);
      bottom = Math.max(
        bottom,
        this.lineTops[index] +
          this.lineRows[index] * this.metrics.rowPitchCss,
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
    lineIndex: number,
    tileStartCss: number,
  ): void {
    const lineNumber = lineIndex + 1;
    const text = this.view.state.doc.line(lineNumber).text;
    if (!text) return;
    const lineTop = this.lineTops[lineIndex];
    const charWidthDevice = this.metrics.charWidthDevice;
    const charHeightDevice = this.metrics.charHeightDevice;
    const gutterDevice = Math.round(
      MINIMAP_GUTTER_WIDTH * this.pixelRatio,
    );
    const rightLimit = widthDevice - charWidthDevice;
    const segments = this.segmentCache.get(lineNumber) ?? [];
    const chunks = splitMinimapChunks(text, this.lineRows[lineIndex]);
    let segmentIndex = 0;

    for (let row = 0; row < chunks.length; row += 1) {
      const chunk = chunks[row];
      const y = Math.round(
        (lineTop + row * this.metrics.rowPitchCss - tileStartCss) *
          this.pixelRatio,
      );
      if (y >= heightDevice || y + charHeightDevice <= 0) continue;
      const limit = Math.min(chunk.end, chunk.start + this.maxColumn);
      let displayColumn = 0;
      for (let column = chunk.start; column < limit; ) {
        const codePoint = text.codePointAt(column) ?? 32;
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
          const mask =
            this.glyphMasks[minimapCharIndex(codePoint)];
          if (mask && x + charWidthDevice <= rightLimit) {
            this.blendGlyph(
              data,
              widthDevice,
              heightDevice,
              mask,
              x,
              y,
              color,
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
    const alphaByte = clamp(color.a * 255, 0, 255);
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
    if (!this.lineTops.length) return;

    const state = this.view.state;
    const renderOffset = this.sliceOffset;
    const ratio = this.pixelRatio;
    this.overlayContext.globalAlpha = 0.5;
    this.overlayContext.fillStyle = this.palette.selection;
    for (const range of state.selection.ranges) {
      if (range.empty) continue;
      const startIndex = state.doc.lineAt(range.from).number - 1;
      const endIndex = state.doc.lineAt(range.to).number - 1;
      if (
        startIndex < 0 ||
        startIndex >= this.lineTops.length ||
        endIndex < 0 ||
        endIndex >= this.lineTops.length
      ) {
        continue;
      }
      const top = Math.max(0, this.lineTops[startIndex] - renderOffset);
      const bottom = Math.min(
        this.heightCss,
        this.lineTops[endIndex] +
          this.lineRows[endIndex] * this.metrics.rowPitchCss -
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
