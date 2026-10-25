import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import {
  MINIMAP_GLYPH_HEIGHT,
  MINIMAP_GLYPH_WIDTH,
  MINIMAP_MAX_COLUMN,
  MINIMAP_ROW_PITCH,
  minimapScrollTop,
  minimapViewportMetrics,
  minimapWidthPx,
} from './minimap';
import { wheelDeltaPixels } from './wheelScroll';

const HEADING_NODE = /^(?:ATX|Setext)Heading[1-6]$/;
const MINIMAP_PADDING = 6;
const MIN_THUMB_HEIGHT = 24;
const TILE_HEIGHT = 128;
const MAX_TILE_CACHE = 64;
const SAMPLED_CHAR_WIDTH = 10;
const SAMPLED_CHAR_HEIGHT = 16;
const SAMPLED_CHAR_COUNT = 95;
const GLYPH_FONT_SIZE = 16;
const GLYPH_SOFTEN = 0.84;
const BASE_ALPHA = 0.78;
const TOKEN_ALPHA = 0.9;
const HEADING_ALPHA = 0.95;
const MAX_VISUAL_ROWS = 2000;

interface MinimapSegment {
  from: number;
  to: number;
  color: string;
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
  chunks: MinimapChunk[];
  segments: MinimapSegment[];
}

interface NodePaint {
  color: string;
  alpha: number;
}

interface MinimapPalette {
  base: string;
  heading: string;
  code: string;
  link: string;
  quote: string;
  tag: string;
  marker: string;
  strong: string;
  emphasis: string;
  type: string;
  selection: string;
}

export interface EditorMinimapOptions {
  view: EditorView;
  host: HTMLElement;
  baseCanvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  slider: HTMLElement;
  scrollbar: HTMLElement;
  scrollbarThumb: HTMLElement;
}

type DragKind = 'minimap' | 'scrollbar' | null;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function cssColor(
  styles: CSSStyleDeclaration,
  name: string,
  fallback: string,
): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

function readPalette(): MinimapPalette {
  const styles = getComputedStyle(document.documentElement);
  return {
    base: cssColor(styles, '--faint', '#9aa3ad'),
    heading: cssColor(styles, '--syntax-heading', '#1f4e79'),
    code: cssColor(styles, '--syntax-string', '#a31515'),
    link: cssColor(styles, '--syntax-link', '#0066cc'),
    quote: cssColor(styles, '--syntax-quote', '#6b7280'),
    tag: cssColor(styles, '--syntax-tag', '#800000'),
    marker: cssColor(styles, '--syntax-operator', '#383a42'),
    strong: cssColor(styles, '--ink', '#1f2933'),
    emphasis: cssColor(styles, '--muted', '#6b7280'),
    type: cssColor(styles, '--syntax-type', '#267f99'),
    selection: cssColor(styles, '--editor-selection', 'rgba(37, 99, 235, 0.18)'),
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
      return { color: palette.strong, alpha: 0.58 };
    case 'Emphasis':
      return { color: palette.emphasis, alpha: 0.52 };
    case 'QuoteMark':
      return { color: palette.quote, alpha: 0.5 };
    case 'ListMark':
      return { color: palette.marker, alpha: 0.5 };
    default:
      return null;
  }
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
  private readonly maxColumn = MINIMAP_MAX_COLUMN;

  private baseContext: CanvasRenderingContext2D | null = null;
  private overlayContext: CanvasRenderingContext2D | null = null;
  private dpr = 1;
  private width = 0;
  private height = 0;
  private rowPitch = MINIMAP_ROW_PITCH;
  private virtualHeight = 0;
  private sliceOffset = 0;
  private viewportHeightVirtual = 0;
  private drawDirty = false;
  private totalRows = 1;
  private charsPerRow = 80;
  private lines: LineInfo[] = [];
  private tiles = new Map<number, HTMLCanvasElement>();
  private glyphMasks = new Map<string, Uint8ClampedArray>();
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

  constructor(options: EditorMinimapOptions) {
    this.view = options.view;
    this.scrollElement = options.view.scrollDOM;
    this.host = options.host;
    this.baseCanvas = options.baseCanvas;
    this.overlayCanvas = options.overlayCanvas;
    this.slider = options.slider;
    this.scrollbar = options.scrollbar;
    this.scrollbarThumb = options.scrollbarThumb;

    this.host.style.width = `${minimapWidthPx(this.maxColumn)}px`;
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

    this.layoutAll();
    this.updateViewport();
    this.drawAll();
    this.schedule(true);
  }

  private prepareGlyphs(): void {
    const cw = MINIMAP_GLYPH_WIDTH;
    const ch = MINIMAP_GLYPH_HEIGHT;
    const maskSize = cw * ch;
    const sourceWidth = SAMPLED_CHAR_COUNT * SAMPLED_CHAR_WIDTH;
    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = SAMPLED_CHAR_HEIGHT;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    context.fillStyle = '#fff';
    context.font = `bold ${GLYPH_FONT_SIZE}px "JetBrains Mono", "Fira Code", monospace`;
    context.textBaseline = 'middle';
    for (let index = 0; index < SAMPLED_CHAR_COUNT; index += 1) {
      context.fillText(
        String.fromCharCode(32 + index),
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
    for (let index = 0; index < SAMPLED_CHAR_COUNT; index += 1) {
      const values = new Float32Array(maskSize);
      for (let y = 0; y < ch; y += 1) {
        const sourceY1 = (y / ch) * SAMPLED_CHAR_HEIGHT;
        const sourceY2 = ((y + 1) / ch) * SAMPLED_CHAR_HEIGHT;
        for (let x = 0; x < cw; x += 1) {
          const sourceX1 = (x / cw) * SAMPLED_CHAR_WIDTH;
          const sourceX2 = ((x + 1) / cw) * SAMPLED_CHAR_WIDTH;
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
              value += ((alpha * alpha) / 255) * weight;
            }
          }
          const final = samples > 0 ? value / samples : 0;
          values[y * cw + x] = final;
          if (final > brightest) brightest = final;
        }
      }
      raw.push(values);
    }

    if (brightest <= 0) return;
    const adjust = (255 / brightest) * GLYPH_SOFTEN;
    for (let index = 0; index < SAMPLED_CHAR_COUNT; index += 1) {
      const mask = new Uint8ClampedArray(maskSize);
      const values = raw[index];
      for (let pixel = 0; pixel < maskSize; pixel += 1) {
        mask[pixel] = Math.round(values[pixel] * adjust);
      }
      this.glyphMasks.set(String.fromCharCode(32 + index), mask);
    }
  }

  private glyphMask(character: string): Uint8ClampedArray {
    const size = MINIMAP_GLYPH_WIDTH * MINIMAP_GLYPH_HEIGHT;
    if (character === ' ' || character === '\t' || character === '\n') {
      return new Uint8ClampedArray(size);
    }
    const cached = this.glyphMasks.get(character);
    if (cached) return cached;
    const code = character.codePointAt(0) ?? 32;
    const fallback = String.fromCharCode(32 + (code % SAMPLED_CHAR_COUNT));
    const mask =
      this.glyphMasks.get(fallback) ?? new Uint8ClampedArray(size);
    if (fallback !== character) this.glyphMasks.set(character, mask);
    return mask;
  }

  handleUpdate(update: ViewUpdate): void {
    if (update.docChanged) {
      update.changes.iterChangedRanges(
        (_fromA, _toA, fromB, toB) => {
          const document = update.state.doc;
          const safeFrom = Math.min(fromB, document.length);
          const safeTo = Math.min(
            Math.max(fromB, toB - 1),
            document.length,
          );
          const start = document.lineAt(safeFrom).number;
          const end = document.lineAt(safeTo).number;
          for (let line = start; line <= end; line += 1) {
            this.pendingLines.add(line);
          }
        },
      );
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
    if (this.frame) cancelAnimationFrame(this.frame);
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    if (this.prefetchTimer) window.clearTimeout(this.prefetchTimer);
    this.frame = 0;
    this.resizeFrame = 0;
    this.prefetchTimer = 0;
    this.tiles.clear();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.themeObserver?.disconnect();
    this.themeObserver = null;
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

  private onScroll = (): void => {
    if (this.updateViewport()) this.scheduleDraw();
  };

  private scheduleDraw(): void {
    this.drawDirty = true;
    this.schedule();
  }

  private schedule(forceLayout = false): void {
    if (forceLayout) this.layoutDirty = true;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.flush();
    });
  }

  private flush(): void {
    const lineCount = this.view.state.doc.lines;
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
    const contentHeight = Math.max(1, this.view.contentHeight);
    const hostHeight = this.host.clientHeight;
    const hostWidth = this.host.clientWidth;
    this.contentHeight = contentHeight;
    this.hostHeight = hostHeight;
    this.hostWidth = hostWidth;
    this.lineCount = state.doc.lines;
    this.palette = readPalette();
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
    this.rowPitch = MINIMAP_ROW_PITCH;
    this.virtualHeight = this.totalRows * this.rowPitch;
    this.tiles.clear();

    const segmentMap = this.collectSegments(state, this.palette);
    const lines: LineInfo[] = [];
    let rowStart = 0;
    for (let number = 1; number <= state.doc.lines; number += 1) {
      const visualRows = rowCounts[number - 1];
      lines.push(
        this.buildLineInfo(
          state,
          number,
          rowStart,
          visualRows,
          segmentMap.get(number) ?? [],
        ),
      );
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

  private buildLineInfo(
    state: EditorState,
    number: number,
    rowStart: number,
    visualRows: number,
    segments: MinimapSegment[],
  ): LineInfo {
    const line = state.doc.line(number);
    return {
      number,
      text: line.text,
      rowStart,
      visualRows,
      top: rowStart * this.rowPitch,
      chunks: this.splitChunks(line.text, visualRows),
      segments,
    };
  }

  private splitChunks(
    text: string,
    visualRows: number,
  ): MinimapChunk[] {
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

  private collectSegments(
    state: EditorState,
    palette: MinimapPalette,
    targets?: Set<number>,
  ): Map<number, MinimapSegment[]> {
    const segments = new Map<number, MinimapSegment[]>();
    let from: number | undefined;
    let to: number | undefined;
    if (targets && targets.size > 0) {
      let first = state.doc.lines;
      let last = 1;
      for (const line of targets) {
        first = Math.min(first, line);
        last = Math.max(last, line);
      }
      from = state.doc.line(Math.max(1, first)).from;
      to = state.doc.line(Math.min(state.doc.lines, last)).to;
    }
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const paint = nodeStyle(node.name, palette);
        if (!paint) return undefined;
        let line = state.doc.lineAt(node.from);
        while (true) {
          if (!targets || targets.has(line.number)) {
            const start = Math.max(node.from, line.from) - line.from;
            const end = Math.min(node.to, line.to) - line.from;
            if (end > start) {
              const list = segments.get(line.number) ?? [];
              list.push({
                from: start,
                to: end,
                color: paint.color,
                alpha: paint.alpha,
              });
              segments.set(line.number, list);
            }
          }
          if (line.to >= node.to || line.number >= state.doc.lines) break;
          line = state.doc.line(line.number + 1);
        }
        return false;
      },
    });
    return segments;
  }

  private ensureCanvases(): boolean {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (width < 2 || height < 2) return false;
    const dpr = Math.max(
      1,
      Math.min(2, Math.round(window.devicePixelRatio || 1)),
    );
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    const changed = this.width !== width || this.dpr !== dpr;

    for (const canvas of [this.baseCanvas, this.overlayCanvas]) {
      if (
        canvas.width !== pixelWidth ||
        canvas.height !== pixelHeight
      ) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
    }

    const base = this.baseCanvas.getContext('2d');
    const overlay = this.overlayCanvas.getContext('2d');
    if (!base || !overlay) return false;
    base.setTransform(dpr, 0, 0, dpr, 0, 0);
    base.imageSmoothingEnabled = false;
    overlay.setTransform(dpr, 0, 0, dpr, 0, 0);
    overlay.imageSmoothingEnabled = false;
    this.baseContext = base;
    this.overlayContext = overlay;
    this.dpr = dpr;
    this.width = width;
    this.height = height;
    if (changed) this.tiles.clear();
    return true;
  }

  private firstVisibleLineIndex(start: number): number {
    let low = 0;
    let high = this.lines.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const line = this.lines[middle];
      const bottom = line.top + line.visualRows * this.rowPitch;
      if (bottom < start) low = middle + 1;
      else high = middle;
    }
    return Math.max(0, low - 1);
  }

  private ensureTile(index: number): HTMLCanvasElement | null {
    const start = index * TILE_HEIGHT;
    if (index < 0 || start >= this.virtualHeight) return null;
    const cached = this.tiles.get(index);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(
      1,
      Math.round(this.width * this.dpr),
    );
    canvas.height = Math.max(
      1,
      Math.round(TILE_HEIGHT * this.dpr),
    );
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.imageSmoothingEnabled = false;

    const end = Math.min(
      start + TILE_HEIGHT,
      this.virtualHeight,
    );
    const first = this.firstVisibleLineIndex(start - this.rowPitch);
    for (let lineIndex = first; lineIndex < this.lines.length; lineIndex += 1) {
      const line = this.lines[lineIndex];
      if (line.top > end) break;
      this.drawLine(context, line, start, TILE_HEIGHT);
    }

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
    const last = Math.floor(
      Math.max(0, bottom - 1) / TILE_HEIGHT,
    );
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
    if (!this.ensureCanvases() || !this.baseContext) return;
    this.baseContext.clearRect(0, 0, this.width, this.height);
    this.baseContext.imageSmoothingEnabled = false;
    const start = Math.round(
      clamp(this.sliceOffset, 0, this.virtualHeight),
    );
    const end = Math.min(
      this.virtualHeight,
      start + Math.round(this.height),
    );
    if (end <= start) {
      this.drawOverlay();
      return;
    }

    const firstTile = Math.floor(start / TILE_HEIGHT);
    const lastTile = Math.floor((end - 1) / TILE_HEIGHT);
    for (let index = firstTile; index <= lastTile; index += 1) {
      const tile = this.ensureTile(index);
      if (!tile) continue;
      const tileStart = index * TILE_HEIGHT;
      const sourceTop = Math.max(start, tileStart);
      const sourceBottom = Math.min(
        end,
        tileStart + TILE_HEIGHT,
      );
      const sourceHeight = sourceBottom - sourceTop;
      if (sourceHeight <= 0) continue;
      const sourceY = (sourceTop - tileStart) * this.dpr;
      const destinationY = sourceTop - start;
      this.baseContext.drawImage(
        tile,
        0,
        sourceY,
        tile.width,
        sourceHeight * this.dpr,
        0,
        destinationY,
        this.width,
        sourceHeight,
      );
    }
    this.drawOverlay();
    this.prefetchTiles(firstTile, lastTile);
  }

  private redrawLines(changed: Set<number>): boolean {
    if (!this.ensureCanvases() || !this.baseContext) return true;
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

    const segmentMap = this.collectSegments(
      state,
      this.palette,
      changed,
    );
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    for (const number of changed) {
      if (number < 1 || number > this.lines.length) continue;
      const previous = this.lines[number - 1];
      const next = this.buildLineInfo(
        state,
        number,
        previous.rowStart,
        previous.visualRows,
        segmentMap.get(number) ?? [],
      );
      this.lines[number - 1] = next;
      top = Math.min(top, previous.top, next.top);
      bottom = Math.max(
        bottom,
        previous.top + previous.visualRows * this.rowPitch,
        next.top + next.visualRows * this.rowPitch,
      );
    }
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
      return false;
    }

    this.invalidateTiles(top, bottom);
    this.drawAll();
    return true;
  }

  private drawGlyph(
    context: CanvasRenderingContext2D,
    character: string,
    x: number,
    y: number,
    alpha: number,
  ): void {
    const width = MINIMAP_GLYPH_WIDTH;
    const height = MINIMAP_GLYPH_HEIGHT;
    const mask = this.glyphMask(character);
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const intensity = mask[row * width + column] / 255;
        if (intensity <= 0) continue;
        context.globalAlpha = alpha * intensity;
        context.fillRect(x + column, y + row, 1, 1);
      }
    }
  }

  private drawLine(
    context: CanvasRenderingContext2D,
    line: LineInfo,
    offset: number,
    limitHeight: number,
  ): void {
    const glyphWidth = MINIMAP_GLYPH_WIDTH;
    const glyphHeight = MINIMAP_GLYPH_HEIGHT;
    let currentColor = '';

    for (let row = 0; row < line.chunks.length; row += 1) {
      const chunk = line.chunks[row];
      if (chunk.end <= chunk.start) continue;
      const y = Math.round(
        line.top + row * this.rowPitch - offset,
      );
      if (y < -glyphHeight || y > limitHeight + 1) continue;
      const end = Math.min(chunk.end, chunk.start + this.maxColumn);
      let segmentIndex = 0;
      while (
        segmentIndex < line.segments.length &&
        line.segments[segmentIndex].to <= chunk.start
      ) {
        segmentIndex += 1;
      }

      for (let column = chunk.start; column < end; column += 1) {
        const character = line.text[column];
        if (!character || /\s/.test(character)) continue;
        while (
          segmentIndex < line.segments.length &&
          line.segments[segmentIndex].to <= column
        ) {
          segmentIndex += 1;
        }
        const segment = line.segments[segmentIndex];
        const painted =
          segment && column >= segment.from && column < segment.to;
        const color = painted ? segment.color : this.palette.base;
        const alpha = painted ? segment.alpha : BASE_ALPHA;
        if (color !== currentColor) {
          context.fillStyle = color;
          currentColor = color;
        }
        const x =
          MINIMAP_PADDING +
          (column - (row === 0 ? 0 : chunk.start)) * glyphWidth;
        if (x + glyphWidth > this.width - MINIMAP_PADDING) break;
        this.drawGlyph(context, character, x, y, alpha);
      }
    }
    context.globalAlpha = 1;
  }

  private drawOverlay(): void {
    if (!this.overlayContext) return;
    this.overlayContext.clearRect(0, 0, this.width, this.height);
    if (!this.lines.length) return;

    const state = this.view.state;
    const renderOffset = Math.round(this.sliceOffset);
    this.overlayContext.globalAlpha = 0.62;
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
        this.height,
        end.top +
          end.visualRows * this.rowPitch -
          renderOffset,
      );
      if (bottom <= top) continue;
      this.overlayContext.fillRect(
        1,
        top,
        Math.max(0, this.width - 2),
        Math.max(1, bottom - top),
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
    if (event.button !== 0) return;
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
