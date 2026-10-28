import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceSession } from '../lib/session';
import { useSessionPersistence } from './useSessionPersistence';

function session(): WorkspaceSession {
  return {
    version: 1,
    tabs: [],
    activePath: null,
    previewPath: null,
    viewMode: 'source',
    expandedPaths: [],
    activeView: 'explorer',
    sidebarVisible: true,
    savedAt: 0,
  };
}

function setup(
  options: {
    enabled?: () => boolean;
    hydrating?: () => boolean;
    build?: () => WorkspaceSession | null;
  } = {},
) {
  let now = 0;
  const write = vi.fn();
  const persistence = useSessionPersistence({
    enabled: options.enabled ?? (() => true),
    isHydrating: options.hydrating ?? (() => false),
    build: options.build ?? (() => session()),
    write,
    debounceMs: 400,
    maxIntervalMs: 5000,
    now: () => now,
  });

  return {
    persistence,
    write,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useSessionPersistence', () => {
  it('debounces session writes', async () => {
    vi.useFakeTimers();
    const { persistence, write } = setup();

    persistence.persistNow();
    persistence.schedule();
    expect(write).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(400);

    expect(write).toHaveBeenCalledTimes(2);
  });

  it('writes immediately after the maximum interval', () => {
    vi.useFakeTimers();
    const { persistence, write, advance } = setup();

    persistence.persistNow();
    advance(5000);
    persistence.schedule();

    expect(write).toHaveBeenCalledTimes(2);
  });

  it('skips writes while hydrating or disabled', () => {
    vi.useFakeTimers();
    let hydrating = true;
    let enabled = true;
    const { persistence, write } = setup({
      hydrating: () => hydrating,
      enabled: () => enabled,
    });

    persistence.persistNow();
    expect(write).not.toHaveBeenCalled();

    hydrating = false;
    enabled = false;
    persistence.schedule();
    expect(write).not.toHaveBeenCalled();
  });

  it('skips writes when no session can be built', () => {
    vi.useFakeTimers();
    const { persistence, write } = setup({ build: () => null });

    persistence.persistNow();

    expect(write).not.toHaveBeenCalled();
  });

  it('clears a pending write', async () => {
    vi.useFakeTimers();
    const { persistence, write } = setup();

    persistence.persistNow();
    persistence.schedule();
    persistence.clearTimer();
    await vi.advanceTimersByTimeAsync(400);

    expect(write).toHaveBeenCalledTimes(1);
  });
});
