export const MIN_IMAGE_ZOOM = 0.2;
export const MAX_IMAGE_ZOOM = 8;

export interface ImageViewState {
  scale: number;
  x: number;
  y: number;
}

export interface ImageViewport {
  width: number;
  height: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  const result = Math.min(max, Math.max(min, value));
  return result === 0 ? 0 : result;
}

export function clampImageZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return clamp(value, MIN_IMAGE_ZOOM, MAX_IMAGE_ZOOM);
}

export function zoomImageAroundPoint(
  state: ImageViewState,
  nextZoom: number,
  point: { x: number; y: number },
  viewport: ImageViewport,
): ImageViewState {
  const scale = clampImageZoom(nextZoom);
  if (scale === state.scale) return state;

  const ratio = scale / state.scale;
  const originX = point.x - viewport.width / 2;
  const originY = point.y - viewport.height / 2;

  return {
    scale,
    x: state.x + (originX - state.x) * (1 - ratio),
    y: state.y + (originY - state.y) * (1 - ratio),
  };
}

export function clampImagePosition(
  state: ImageViewState,
  image: ImageSize,
  viewport: ImageViewport,
): ImageViewState {
  const maxX = Math.max(
    0,
    (image.width * state.scale - viewport.width) / 2,
  );
  const maxY = Math.max(
    0,
    (image.height * state.scale - viewport.height) / 2,
  );

  return {
    scale: state.scale,
    x: clamp(state.x, -maxX, maxX),
    y: clamp(state.y, -maxY, maxY),
  };
}
