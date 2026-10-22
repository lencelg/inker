export const DEFAULT_FONT_SIZE = 15;
export const MIN_FONT_SIZE = 11;
export const MAX_FONT_SIZE = 28;
export const FONT_SIZE_STORAGE_KEY = 'markleaf-font-size';

export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FONT_SIZE;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(value)));
}
