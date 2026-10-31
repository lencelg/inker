import { describe, expect, it } from 'vitest';
import {
  SCROLL_WHEEL_FACTOR,
  applySlowWheel,
  wheelDeltaPixels,
} from './wheelScroll';

function wheelEvent(deltaY: number, deltaMode = 0): WheelEvent {
  return new WheelEvent('wheel', {
    deltaY,
    deltaMode,
    cancelable: true,
    bubbles: true,
  });
}

function scrollable(
  overflowY = 'auto',
  scrollHeight = 1000,
  clientHeight = 400,
): HTMLElement {
  const element = document.createElement('div');
  element.style.overflowY = overflowY;
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  });
  element.scrollTop = 100;
  return element;
}

function dispatchWheel(target: HTMLElement): {
  event: WheelEvent;
  handled: boolean;
} {
  let handled = false;
  target.addEventListener(
    'wheel',
    (event) => {
      handled = applySlowWheel(event);
    },
    { once: true },
  );
  const event = wheelEvent(100);
  target.dispatchEvent(event);
  return { event, handled };
}

describe('wheel scrolling', () => {
  it('scales pixel, line, and page deltas by the configured factor', () => {
    expect(SCROLL_WHEEL_FACTOR).toBe(0.49);
    expect(wheelDeltaPixels(wheelEvent(100), 400)).toBe(49);
    expect(wheelDeltaPixels(wheelEvent(10, 1), 400)).toBeCloseTo(78.4);
    expect(wheelDeltaPixels(wheelEvent(1, 2), 400)).toBeCloseTo(196);
  });

  it('slows scrolling only inside the main workspace', () => {
    const workspace = document.createElement('main');
    workspace.className = 'workspace';
    const content = scrollable();
    workspace.append(content);
    document.body.append(workspace);

    const inside = dispatchWheel(content);
    expect(inside.handled).toBe(true);
    expect(content.scrollTop).toBe(149);
    expect(inside.event.defaultPrevented).toBe(true);

    const outside = scrollable();
    document.body.append(outside);
    const outsideResult = dispatchWheel(outside);
    expect(outsideResult.handled).toBe(false);
    expect(outside.scrollTop).toBe(100);
    expect(outsideResult.event.defaultPrevented).toBe(false);

    document.body.replaceChildren();
  });

  it('leaves non-scrollable main areas untouched', () => {
    const workspace = document.createElement('main');
    workspace.className = 'workspace';
    const content = scrollable('hidden', 1000, 400);
    workspace.append(content);
    document.body.append(workspace);

    const result = dispatchWheel(content);
    expect(result.handled).toBe(false);
    expect(content.scrollTop).toBe(100);
    document.body.replaceChildren();
  });

  it('finds known workspace scrollers without an overflow style walk', () => {
    const workspace = document.createElement('main');
    workspace.className = 'workspace';
    const content = scrollable('visible', 1000, 400);
    content.classList.add('markdown-body');
    workspace.append(content);
    document.body.append(workspace);

    const result = dispatchWheel(content);
    expect(result.handled).toBe(true);
    expect(content.scrollTop).toBe(149);
    expect(result.event.defaultPrevented).toBe(true);
    document.body.replaceChildren();
  });
});
