import { afterEach, describe, expect, it, vi } from 'vitest';
import { useExternalChangeSync } from './useExternalChangeSync';

type Refresh = (
  paths: string[],
  fullRefresh: boolean,
  defer: (paths: string[], fullRefresh: boolean) => void,
) => Promise<void>;

function setup(
  options: {
    canRefresh?: () => boolean;
    onRefresh?: Refresh;
  } = {},
) {
  let canRefresh = true;
  const onRefresh = vi.fn<Refresh>(
    options.onRefresh ?? (async () => undefined),
  );
  const onError = vi.fn();
  const sync = useExternalChangeSync({
    canRefresh: () => canRefresh && (options.canRefresh?.() ?? true),
    onRefresh,
    onError,
    debounceMs: 300,
  });

  return {
    sync,
    onRefresh,
    onError,
    block: () => {
      canRefresh = false;
    },
    unblock: () => {
      canRefresh = true;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useExternalChangeSync', () => {
  it('debounces and batches changed paths', async () => {
    vi.useFakeTimers();
    const { sync, onRefresh } = setup();

    sync.handlePayload({ kind: 'modify', paths: ['a.md'] });
    sync.handlePayload({ kind: 'modify', paths: ['b.md', 'a.md'] });
    await vi.advanceTimersByTimeAsync(300);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onRefresh.mock.calls[0][0]).toEqual(['a.md', 'b.md']);
    expect(onRefresh.mock.calls[0][1]).toBe(false);
  });

  it('requests a full refresh for creates and unknown payloads', async () => {
    vi.useFakeTimers();
    const { sync, onRefresh } = setup();

    sync.handlePayload({ kind: 'create', paths: ['new.md'] });
    await vi.advanceTimersByTimeAsync(300);
    expect(onRefresh.mock.calls[0][1]).toBe(true);

    sync.handlePayload(undefined);
    await vi.advanceTimersByTimeAsync(300);
    expect(onRefresh.mock.calls[1][0]).toEqual([]);
    expect(onRefresh.mock.calls[1][1]).toBe(true);
  });

  it('waits for blockers and resumes', async () => {
    vi.useFakeTimers();
    const { sync, onRefresh, block, unblock } = setup();
    block();

    sync.handlePayload({ kind: 'modify', paths: ['a.md'] });
    await vi.advanceTimersByTimeAsync(300);
    expect(onRefresh).not.toHaveBeenCalled();

    unblock();
    sync.resume();
    await vi.advanceTimersByTimeAsync(300);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('retries paths deferred by the refresh callback', async () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn<Refresh>(async (_paths, _full, defer) => {
      defer(['b.md'], false);
    });
    const { sync } = setup({ onRefresh });

    sync.handlePayload({ kind: 'modify', paths: ['a.md'] });
    await vi.advanceTimersByTimeAsync(300);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(300);
    expect(onRefresh).toHaveBeenCalledTimes(2);
    expect(onRefresh.mock.calls[1][0]).toEqual(['b.md']);
  });

  it('reports errors and stops after disposal', async () => {
    vi.useFakeTimers();
    const { sync, onRefresh, onError } = setup({
      onRefresh: async () => {
        throw new Error('refresh failed');
      },
    });

    sync.handlePayload({ kind: 'modify', paths: ['a.md'] });
    await vi.advanceTimersByTimeAsync(300);
    expect(onError).toHaveBeenCalledTimes(1);

    sync.dispose();
    sync.handlePayload({ kind: 'modify', paths: ['b.md'] });
    await vi.advanceTimersByTimeAsync(300);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
