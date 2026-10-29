export const ZOOM_STORAGE_KEY = 'inker-zoom-level';
export const DEFAULT_ZOOM_LEVEL = 0;
export const MIN_ZOOM_LEVEL = -5;
export const MAX_ZOOM_LEVEL = 8;

export type ZoomAction = 'in' | 'out' | 'reset';

export function clampZoomLevel(level: number): number {
  if (!Number.isFinite(level)) return DEFAULT_ZOOM_LEVEL;
  return Math.min(
    MAX_ZOOM_LEVEL,
    Math.max(MIN_ZOOM_LEVEL, Math.round(level)),
  );
}

export function zoomScale(level: number): number {
  return 1.2 ** clampZoomLevel(level);
}

export function nextZoomLevel(
  level: number,
  action: ZoomAction,
): number {
  if (action === 'reset') return DEFAULT_ZOOM_LEVEL;
  return clampZoomLevel(level + (action === 'in' ? 1 : -1));
}

export function zoomActionFromEvent(
  event: KeyboardEvent,
): ZoomAction | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;

  if (event.code === 'NumpadAdd') return 'in';
  if (event.code === 'NumpadSubtract') return 'out';
  if (event.code === 'Numpad0') return 'reset';

  switch (event.key) {
    case '=':
    case '+':
      return 'in';
    case '-':
    case '_':
      return 'out';
    case '0':
      return 'reset';
    default:
      return null;
  }
}

export function readStoredZoomLevel(): number {
  try {
    const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);
    if (raw === null) return DEFAULT_ZOOM_LEVEL;
    return clampZoomLevel(Number.parseInt(raw, 10));
  } catch {
    return DEFAULT_ZOOM_LEVEL;
  }
}

export function storeZoomLevel(level: number): void {
  try {
    window.localStorage.setItem(
      ZOOM_STORAGE_KEY,
      String(clampZoomLevel(level)),
    );
  } catch {
    // Ignore unavailable storage.
  }
}
