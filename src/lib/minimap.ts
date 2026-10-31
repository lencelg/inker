export const MINIMAP_GUTTER_WIDTH = 8;
export const MINIMAP_DEFAULT_SCALE = 1;
export const MINIMAP_MIN_SCALE = 1;
export const MINIMAP_MAX_SCALE = 3;
export const MINIMAP_DEFAULT_MAX_COLUMN = 120;
export const MINIMAP_MIN_MAX_COLUMN = 20;
export const MINIMAP_MAX_MAX_COLUMN = 200;

export const MINIMAP_CHAR_COUNT = 96;
/**
 * Row pitch in CSS px per scale step: at 1x a 1000px minimap shows 400 lines
 * (2.5px per row). Kept independent of DPR so the page density stays stable.
 */
export const MINIMAP_ROW_PITCH_PER_SCALE = 2.5;
const FIRST_CHAR_CODE = 32;
const LAST_CHAR_CODE = 126;

export interface MinimapCharMetrics {
  pixelRatio: number;
  /** Glyph scale in device pixels, mirroring VS Code's minimapScale. */
  deviceScale: number;
  charWidthDevice: number;
  charHeightDevice: number;
  rowPitchDevice: number;
  charWidthCss: number;
  rowPitchCss: number;
}

export interface MinimapViewportMetrics {
  top: number;
  height: number;
  ratio: number;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function clampMinimapScale(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MINIMAP_DEFAULT_SCALE;
  return Math.min(
    MINIMAP_MAX_SCALE,
    Math.max(MINIMAP_MIN_SCALE, Math.round(numeric)),
  );
}

export function clampMinimapMaxColumn(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MINIMAP_DEFAULT_MAX_COLUMN;
  return Math.min(
    MINIMAP_MAX_MAX_COLUMN,
    Math.max(MINIMAP_MIN_MAX_COLUMN, Math.round(numeric)),
  );
}

/**
 * Mirrors VS Code's minimap scaling: below 2x the configured scale is measured
 * in device pixels; at 2x and above each column uses 2x/3x device pixels. The
 * CSS column width is therefore stable at `scale` on 1x and 2x displays.
 */
export function minimapCharMetrics(
  scale: number,
  pixelRatio = 1,
): MinimapCharMetrics {
  const ratio =
    Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const normalizedScale = clampMinimapScale(scale);
  const deviceScale =
    ratio >= 2 ? normalizedScale * 2 : normalizedScale;
  const charWidthDevice = deviceScale;
  const charHeightDevice = deviceScale * 2;
  const rowPitchCss = MINIMAP_ROW_PITCH_PER_SCALE * normalizedScale;
  return {
    pixelRatio: ratio,
    deviceScale,
    charWidthDevice,
    charHeightDevice,
    rowPitchDevice: rowPitchCss * ratio,
    charWidthCss: charWidthDevice / ratio,
    rowPitchCss,
  };
}

export interface MinimapWidthOptions {
  availableWidth: number;
  characterWidth: number;
  scrollbarWidth?: number;
  pixelRatio?: number;
}

/**
 * Mirrors VS Code's proportional minimap layout: one column per `scale` CSS
 * pixels, an 8px gutter, and a width that shrinks with the available editor
 * width. `maxColumn` is clamped to the supported setting range.
 */
export function minimapWidthPx(
  maxColumn = MINIMAP_DEFAULT_MAX_COLUMN,
  scale = MINIMAP_DEFAULT_SCALE,
  options?: MinimapWidthOptions,
): number {
  const columns = Math.max(
    1,
    Math.round(
      Number.isFinite(maxColumn) ? maxColumn : MINIMAP_DEFAULT_MAX_COLUMN,
    ),
  );
  const metrics = minimapCharMetrics(scale, options?.pixelRatio);
  const maxWidth = Math.floor(columns * metrics.charWidthCss);
  if (!options) return maxWidth;

  const { availableWidth, characterWidth } = options;
  if (!(availableWidth > 0) || !(characterWidth > 0)) return maxWidth;

  const scrollbarWidth = options.scrollbarWidth ?? 0;
  const contentWidth = Math.floor(
    ((availableWidth - scrollbarWidth - 2) * metrics.charWidthCss) /
      (characterWidth + metrics.charWidthCss),
  );
  return Math.min(
    maxWidth,
    Math.max(0, contentWidth) + MINIMAP_GUTTER_WIDTH,
  );
}

export interface MinimapCharAdvance {
  paint: boolean;
  columns: number;
}

/**
 * Returns how many minimap columns a character occupies. Tabs follow the
 * editor's tab stops; East Asian wide characters occupy two columns like in
 * VS Code.
 */
export function minimapCharAdvance(
  codePoint: number,
  displayColumn: number,
  tabSize = 4,
): MinimapCharAdvance {
  if (codePoint === 9) {
    const size = Math.max(1, Math.floor(tabSize));
    const column =
      Number.isFinite(displayColumn) && displayColumn > 0
        ? Math.floor(displayColumn)
        : 0;
    return { paint: false, columns: size - (column % size) };
  }
  if (codePoint <= 32 || codePoint === 0xa0) {
    return { paint: false, columns: 1 };
  }
  if (
    codePoint === 0x3000 ||
    (codePoint >= 0x2000 && codePoint <= 0x200a) ||
    codePoint === 0x2028 ||
    codePoint === 0x2029 ||
    codePoint === 0x202f ||
    codePoint === 0x205f
  ) {
    return { paint: false, columns: isFullWidthCodePoint(codePoint) ? 2 : 1 };
  }
  return {
    paint: true,
    columns: isFullWidthCodePoint(codePoint) ? 2 : 1,
  };
}

export function isFullWidthCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0x303e) ||
    (codePoint >= 0x3041 && codePoint <= 0x33ff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xa000 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1f64f) ||
    (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

/**
 * Maps a code point to a sampled glyph. Non-ASCII text reuses ASCII glyphs
 * so CJK notes stay legible instead of turning into placeholder boxes.
 */
export function minimapCharIndex(codePoint: number): number {
  const offset = codePoint - FIRST_CHAR_CODE;
  if (offset < 0 || offset > LAST_CHAR_CODE - FIRST_CHAR_CODE) {
    return (
      ((offset % MINIMAP_CHAR_COUNT) + MINIMAP_CHAR_COUNT) %
      MINIMAP_CHAR_COUNT
    );
  }
  return offset;
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
