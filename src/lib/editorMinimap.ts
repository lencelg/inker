import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import {
  MINIMAP_MAX_COLUMN,
  minimapScrollTop,
  minimapViewportMetrics,
  minimapWidthPx,
} from './minimap';
import { wheelDeltaPixels } from './wheelScroll';

const HEADING_NODE = /^(?:ATX|Setext)Heading[1-6]$/;
const MINIMAP_PADDING = 6;
const MIN_THUMB_HEIGHT = 24;

interface MinimapSegment {
  from: number;
  to: number;
  color: string;
}

interface LineInfo {
  number: number;
  text: string;
  indent: number;
  end: number;
  top: number;
  blockHeight: number;
  visualRows: number;
  segments: MinimapSegment[];
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
): string | null {
  if (HEADING_NODE.test(name)) return palette.heading;
  switch (name) {
    case 'InlineCode':
    case 'CodeText':
      return palette.code;
    case 'CodeInfo':
      return palette.type;
    case 'Link':
    case 'Image':
    case 'URL':
      return palette.link;
    case 'StrongEmphasis':
      return palette.strong;
    case 'Emphasis':
      return palette.emphasis;
    case 'HTMLBlock':
    case 'HTMLTag':
      return palette.tag;
    case 'QuoteMark':
      return palette.quote;
    case 'ListMark':
      return palette.marker;
    default:
      return null;
  }
}

function leadingIndent(text: string): number {
  let indent = 0;
  for (const character of text) {
    if (character === ' ') indent += 1;
    else if (character === '\t') indent += 4;
    else break;
    if (indent >= MINIMAP_MAX_COLUMN) break;
  }
  return Math.min(indent, MINIMAP_MAX_COLUMN);
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
  private width = 0;
  private height = 0;
  private scale = 1;
  private lines: LineInfo[] = [];
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
    this.drawAll();
    this.updateViewport();
    this.schedule(true);
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
    this.frame = 0;
    this.resizeFrame = 0;
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
    this.updateViewport();
  };

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
    const layoutChanged =
      this.layoutDirty ||
      lineCount !== this.lineCount ||
      contentHeight !== this.contentHeight ||
      hostHeight !== this.hostHeight ||
      hostWidth !== this.hostWidth;

    if (layoutChanged) {
      this.layoutAll();
      this.drawAll();
      this.selectionDirty = false;
    } else if (this.pendingLines.size > 0) {
      this.redrawLines(this.pendingLines);
    }

    this.pendingLines.clear();
    this.layoutDirty = false;
    if (this.selectionDirty) {
      this.drawOverlay();
      this.selectionDirty = false;
    }
    this.updateViewport();
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
    this.scale =
      hostHeight > 0 ? hostHeight / contentHeight : 1;
    this.palette = readPalette();

    const segmentMap = this.collectSegments(state, this.palette);
    const lines: LineInfo[] = [];
    for (let number = 1; number <= state.doc.lines; number += 1) {
      lines.push(
        this.buildLineInfo(
          state,
          number,
          segmentMap.get(number) ?? [],
        ),
      );
    }
    this.lines = lines;
  }

  private buildLineInfo(
    state: EditorState,
    number: number,
    segments: MinimapSegment[],
  ): LineInfo {
    const line = state.doc.line(number);
    const block = this.view.lineBlockAt(line.from);
    const text = line.text;
    const end = Math.min(
      text.trimEnd().length,
      this.maxColumn,
    );
    const blockHeight = Math.max(1, block.height * this.scale);
    const lineHeight = Math.max(
      1,
      this.view.defaultLineHeight * this.scale,
    );
    return {
      number,
      text,
      indent: Math.min(leadingIndent(text), end),
      end,
      top: block.top * this.scale,
      blockHeight,
      visualRows: Math.min(
        200,
        Math.max(1, Math.round(blockHeight / lineHeight)),
      ),
      segments,
    };
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
        const color = nodeStyle(node.name, palette);
        if (!color) return undefined;
        let line = state.doc.lineAt(node.from);
        while (true) {
          if (!targets || targets.has(line.number)) {
            const start = Math.max(node.from, line.from) - line.from;
            const end = Math.min(node.to, line.to) - line.from;
            if (end > start) {
              const list = segments.get(line.number) ?? [];
              list.push({ from: start, to: end, color });
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
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

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
    overlay.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.baseContext = base;
    this.overlayContext = overlay;
    this.width = width;
    this.height = height;
    return true;
  }

  private drawAll(): void {
    if (!this.ensureCanvases() || !this.baseContext) return;
    this.baseContext.clearRect(0, 0, this.width, this.height);
    if (this.overlayContext) {
      this.overlayContext.clearRect(0, 0, this.width, this.height);
    }
    for (const line of this.lines) {
      this.drawLine(this.baseContext, line);
    }
    this.drawOverlay();
  }

  private redrawLines(changed: Set<number>): void {
    if (!this.ensureCanvases() || !this.baseContext) return;
    const state = this.view.state;
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
        segmentMap.get(number) ?? [],
      );
      this.lines[number - 1] = next;
      top = Math.min(top, previous.top, next.top);
      bottom = Math.max(
        bottom,
        previous.top + previous.blockHeight,
        next.top + next.blockHeight,
      );
    }
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
      this.drawAll();
      return;
    }

    const clearTop = Math.max(0, top - 2);
    const clearBottom = Math.min(this.height, bottom + 3);
    this.baseContext.clearRect(
      0,
      clearTop,
      this.width,
      clearBottom - clearTop,
    );
    for (const line of this.lines) {
      if (
        line.top <= clearBottom + 2 &&
        line.top + line.blockHeight >= clearTop - 2
      ) {
        this.drawLine(this.baseContext, line);
      }
    }
    this.drawOverlay();
  }

  private drawLine(
    context: CanvasRenderingContext2D,
    line: LineInfo,
  ): void {
    if (line.end <= line.indent) return;
    const step = line.blockHeight / line.visualRows;
    const height = Math.max(
      1,
      Math.min(2, Math.round(step * 0.7)),
    );
    const charWidth =
      (this.width - MINIMAP_PADDING * 2) / this.maxColumn;
    let segmentIndex = 0;
    let runStart = -1;
    let runEnd = -1;
    let runColor = '';

    const flush = (y: number): void => {
      if (runStart < 0) return;
      context.fillStyle = runColor;
      context.fillRect(
        MINIMAP_PADDING + runStart * charWidth,
        y,
        Math.max(0.6, (runEnd - runStart) * charWidth),
        height,
      );
      runStart = -1;
      runEnd = -1;
      runColor = '';
    };

    for (let row = 0; row < line.visualRows; row += 1) {
      const y = Math.round(line.top + row * step);
      if (y < -2 || y > this.height + 2) continue;
      segmentIndex = 0;
      runStart = -1;
      runEnd = -1;
      runColor = '';
      for (let column = line.indent; column < line.end; column += 1) {
        const character = line.text[column];
        if (!character || /\s/.test(character)) {
          flush(y);
          continue;
        }
        while (
          segmentIndex < line.segments.length &&
          line.segments[segmentIndex].to <= column
        ) {
          segmentIndex += 1;
        }
        const segment = line.segments[segmentIndex];
        const color =
          segment && column >= segment.from && column < segment.to
            ? segment.color
            : this.palette.base;
        if (color !== runColor) {
          flush(y);
          runColor = color;
          runStart = column;
        }
        runEnd = column + 1;
      }
      flush(y);
    }
  }

  private drawOverlay(): void {
    if (!this.overlayContext) return;
    this.overlayContext.clearRect(0, 0, this.width, this.height);
    if (!this.lines.length) return;

    const state = this.view.state;
    this.overlayContext.globalAlpha = 0.72;
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
      const top = start.top;
      const bottom = Math.min(
        this.height,
        end.top + end.blockHeight,
      );
      this.overlayContext.fillRect(
        1,
        top,
        Math.max(0, this.width - 2),
        Math.max(1, bottom - top),
      );
    }
    this.overlayContext.globalAlpha = 1;
  }

  private updateViewport(): void {
    const clientHeight = this.scrollElement.clientHeight;
    const scrollHeight = this.scrollElement.scrollHeight;
    const maximum = Math.max(0, scrollHeight - clientHeight);
    const ratio =
      maximum > 0 ? this.scrollElement.scrollTop / maximum : 0;
    const metrics = minimapViewportMetrics(
      this.scrollElement.scrollTop,
      clientHeight,
      scrollHeight,
      this.host.clientHeight,
      18,
    );
    this.sliderHeight = metrics.height;
    this.sliderTop = metrics.top;
    this.slider.style.height = `${metrics.height}px`;
    this.slider.style.transform = `translateY(${metrics.top}px)`;

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
    event.preventDefault();
    const rect = this.host.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const insideSlider =
      y >= this.sliderTop &&
      y <= this.sliderTop + this.sliderHeight;
    this.dragKind = 'minimap';
    this.dragOffset = insideSlider
      ? y - this.sliderTop
      : this.sliderHeight / 2;
    this.host.setPointerCapture(event.pointerId);
    this.host.classList.add('is-dragging');
    this.moveMinimap(event.clientY);
  };

  private onMinimapPointerMove = (event: PointerEvent): void => {
    if (this.dragKind !== 'minimap') return;
    event.preventDefault();
    this.moveMinimap(event.clientY);
  };

  private moveMinimap(clientY: number): void {
    const rect = this.host.getBoundingClientRect();
    const track = Math.max(
      1,
      rect.height - this.sliderHeight,
    );
    const y = clientY - rect.top - this.dragOffset;
    this.scrollToRatio(y / track);
  }

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
