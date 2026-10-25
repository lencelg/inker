export const SCROLL_WHEEL_FACTOR = 0.7;

export function wheelDeltaPixels(
  event: WheelEvent,
  viewportHeight: number,
  factor = SCROLL_WHEEL_FACTOR,
): number {
  const base =
    event.deltaMode === 1
      ? event.deltaY * 16
      : event.deltaMode === 2
        ? event.deltaY * viewportHeight
        : event.deltaY;
  return base * factor;
}

function findScrollable(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  let node: HTMLElement | null =
    target instanceof HTMLElement ? target : target.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    if (
      /(auto|scroll|overlay)/.test(style.overflowY) &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function applySlowWheel(
  event: WheelEvent,
  factor = SCROLL_WHEEL_FACTOR,
): boolean {
  if (
    event.defaultPrevented ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    event.deltaY === 0 ||
    Math.abs(event.deltaX) > Math.abs(event.deltaY)
  ) {
    return false;
  }
  const target = event.target;
  if (!(target instanceof Element) || !target.closest('.workspace')) {
    return false;
  }
  const scrollable = findScrollable(target);
  if (!scrollable) return false;

  const maximum = scrollable.scrollHeight - scrollable.clientHeight;
  if (maximum <= 0) return false;

  const delta = wheelDeltaPixels(
    event,
    scrollable.clientHeight,
    factor,
  );
  if (delta === 0) return false;

  const next = scrollable.scrollTop + delta;
  if (
    (delta < 0 && scrollable.scrollTop <= 0) ||
    (delta > 0 && scrollable.scrollTop >= maximum - 0.5)
  ) {
    return false;
  }

  event.preventDefault();
  scrollable.scrollTop = Math.min(maximum, Math.max(0, next));
  return true;
}
