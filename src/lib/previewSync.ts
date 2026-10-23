export interface SourceAnchor {
  start: number;
  end: number;
  top: number;
  bottom: number;
  height: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function sourceLineAtOffset(
  anchors: SourceAnchor[],
  offset: number,
): number | null {
  if (anchors.length === 0) return null;

  let containing: SourceAnchor | null = null;
  for (const anchor of anchors) {
    if (offset < anchor.top || offset > anchor.bottom) continue;
    if (!containing || anchor.height < containing.height) {
      containing = anchor;
    }
  }

  if (containing) {
    const progress =
      containing.height > 0
        ? (offset - containing.top) / containing.height
        : 0;
    return Math.round(
      containing.start + (containing.end - containing.start) * progress,
    );
  }

  let previous: SourceAnchor | null = null;
  let next: SourceAnchor | null = null;
  for (const anchor of anchors) {
    if (anchor.bottom <= offset) {
      previous = anchor;
    } else if (anchor.top >= offset) {
      next = anchor;
      break;
    }
  }

  if (!previous) return next?.start ?? null;
  if (!next) return previous.end;

  const progress = clamp(
    (offset - previous.bottom) / Math.max(1, next.top - previous.bottom),
    0,
    1,
  );
  return Math.round(
    previous.end + (Math.max(previous.end, next.start) - previous.end) * progress,
  );
}

export function previewScrollTop(
  anchors: SourceAnchor[],
  focusLine: number,
  scrollRatio: number,
  maximum: number,
  viewportHeight: number,
): number {
  if (maximum <= 0) return 0;

  if (anchors.length === 0) {
    return clamp(scrollRatio, 0, 1) * maximum;
  }

  const targetLine = Math.max(1, Math.round(focusLine));
  let containing: SourceAnchor | null = null;
  for (const anchor of anchors) {
    if (targetLine < anchor.start || targetLine > anchor.end) continue;
    if (
      !containing ||
      anchor.end - anchor.start < containing.end - containing.start ||
      (anchor.end - anchor.start === containing.end - containing.start &&
        anchor.height < containing.height)
    ) {
      containing = anchor;
    }
  }

  let top: number;
  if (containing) {
    const range = containing.end - containing.start;
    const progress =
      range > 0 ? (targetLine - containing.start) / range : 0;
    top = containing.top + containing.height * progress;
  } else {
    let previous: SourceAnchor | null = null;
    let next: SourceAnchor | null = null;
    for (const anchor of anchors) {
      if (anchor.start <= targetLine) {
        previous = anchor;
      } else {
        next = anchor;
        break;
      }
    }

    if (!previous) {
      top = 0;
    } else if (!next) {
      top = previous.bottom;
    } else {
      const gapStart = previous.end;
      const gap = Math.max(1, next.start - gapStart);
      const progress = clamp((targetLine - gapStart) / gap, 0, 1);
      top = previous.bottom + (next.top - previous.bottom) * progress;
    }
  }

  return clamp(top - viewportHeight / 2, 0, maximum);
}
