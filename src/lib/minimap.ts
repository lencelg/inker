export const MINIMAP_MAX_COLUMN = 120;
export const MINIMAP_COLUMN_WIDTH = 1;
export const MINIMAP_GUTTER_WIDTH = 8;
export const MINIMAP_SCALE = 2;
export const MINIMAP_GLYPH_WIDTH = MINIMAP_SCALE;
export const MINIMAP_GLYPH_HEIGHT = MINIMAP_SCALE * 2;
export const MINIMAP_ROW_PITCH = MINIMAP_GLYPH_HEIGHT;

export interface MinimapViewportMetrics {
  top: number;
  height: number;
  ratio: number;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export interface MinimapWidthOptions {
  availableWidth: number;
  characterWidth: number;
  scrollbarWidth?: number;
  pixelRatio?: number;
}

/**
 * Mirrors VS Code's minimap layout: one CSS pixel per column, an 8px gutter,
 * and a width that shrinks with the available editor width. At the default
 * 120 columns this caps at 120px on a wide pane.
 */
export function minimapWidthPx(
  maxColumn = MINIMAP_MAX_COLUMN,
  options?: MinimapWidthOptions,
): number {
  const columns = Math.max(1, maxColumn);
  if (!options) return Math.floor(columns * MINIMAP_COLUMN_WIDTH);

  const {
    availableWidth,
    characterWidth,
    scrollbarWidth = 0,
    pixelRatio = 1,
  } = options;
  // VS Code keeps one minimap column at one CSS pixel on 1x and 2x displays
  // and at fractional widths on scaled displays (1.25x, 1.5x, ...).
  const ratio = Math.max(1, pixelRatio);
  const columnWidth = (ratio >= 2 ? 2 : 1) / ratio;
  const maxWidth = Math.floor(columns * columnWidth);
  if (!(availableWidth > 0) || !(characterWidth > 0)) return maxWidth;

  const contentWidth = Math.floor(
    ((availableWidth - scrollbarWidth - 2) * columnWidth) /
      (characterWidth + columnWidth),
  );
  return Math.min(
    maxWidth,
    Math.max(0, contentWidth) + MINIMAP_GUTTER_WIDTH,
  );
}

export function minimapScrollTop(
  ratio: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const maximum = Math.max(0, scrollHeight - clientHeight);
  return clampRatio(ratio) * maximum;
}

export function minimapViewportMetrics(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  minimapHeight: number,
  minViewportHeight = 0,
): MinimapViewportMetrics {
  const height = Math.max(1, minimapHeight);
  const maximum = Math.max(0, scrollHeight - clientHeight);
  const ratio = maximum > 0 ? clampRatio(scrollTop / maximum) : 0;
  const viewport = Math.min(
    height,
    Math.max(
      Math.max(0, minViewportHeight),
      height * (clientHeight / Math.max(1, scrollHeight)),
    ),
  );
  return {
    top: (height - viewport) * ratio,
    height: viewport,
    ratio,
  };
}
