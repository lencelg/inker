export interface MinimapViewportMetrics {
  top: number;
  height: number;
  ratio: number;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function minimapLineAtRatio(
  ratio: number,
  lineCount: number,
): number {
  const count = Math.max(1, Math.floor(lineCount));
  return Math.min(count, Math.floor(clampRatio(ratio) * count) + 1);
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
