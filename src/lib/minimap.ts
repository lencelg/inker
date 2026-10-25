export const MINIMAP_MAX_COLUMN = 120;
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

export function minimapWidthPx(
  maxColumn = MINIMAP_MAX_COLUMN,
): number {
  const columns = Math.max(1, maxColumn);
  return Math.round(Math.min(180, Math.max(72, columns * 0.9 + 12)));
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
