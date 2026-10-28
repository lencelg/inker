export interface ExternalChangePayload {
  kind?: string;
  paths?: string[];
}

export type ExternalChangeDefer = (
  paths: string[],
  fullRefresh: boolean,
) => void;

export interface ExternalChangeSyncOptions {
  canRefresh: () => boolean;
  onRefresh: (
    paths: string[],
    fullRefresh: boolean,
    defer: ExternalChangeDefer,
  ) => Promise<void>;
  onError?: (error: unknown) => void;
  debounceMs?: number;
}

export function useExternalChangeSync(
  options: ExternalChangeSyncOptions,
) {
  const debounceMs = options.debounceMs ?? 300;
  let timer = 0;
  let running = false;
  let pending = false;
  let disposed = false;
  let changedPaths = new Set<string>();
  let needsFullRefresh = false;

  function hasData(): boolean {
    return changedPaths.size > 0 || needsFullRefresh;
  }

  function clearTimer(): void {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
  }

  function defer(
    paths: string[],
    fullRefresh: boolean,
  ): void {
    for (const path of paths) {
      if (path) changedPaths.add(path);
    }
    if (fullRefresh) needsFullRefresh = true;
    pending = true;
  }

  function handlePayload(
    payload:
      | ExternalChangePayload
      | string[]
      | null
      | undefined,
  ): void {
    if (disposed) return;

    if (Array.isArray(payload)) {
      needsFullRefresh = true;
      for (const path of payload) {
        if (typeof path === 'string' && path) {
          changedPaths.add(path);
        }
      }
    } else if (
      !payload ||
      !Array.isArray(payload.paths) ||
      payload.paths.length === 0
    ) {
      needsFullRefresh = true;
    } else {
      for (const path of payload.paths) {
        if (typeof path === 'string' && path) {
          changedPaths.add(path);
        }
      }
      if (payload.kind !== 'modify') {
        needsFullRefresh = true;
      }
    }

    schedule();
  }

  function schedule(): void {
    if (disposed) return;
    if (running) {
      pending = true;
      return;
    }
    clearTimer();
    timer = window.setTimeout(() => {
      timer = 0;
      void flush();
    }, debounceMs);
  }

  function resume(): void {
    if (disposed || running || !hasData()) return;
    schedule();
  }

  async function flush(): Promise<void> {
    if (disposed) return;
    if (running) {
      pending = true;
      return;
    }
    if (!hasData()) return;
    if (!options.canRefresh()) {
      pending = true;
      return;
    }

    const batchPaths = [...changedPaths];
    const batchFullRefresh = needsFullRefresh;
    changedPaths = new Set();
    needsFullRefresh = false;
    pending = false;
    running = true;

    try {
      await options.onRefresh(
        batchPaths,
        batchFullRefresh,
        defer,
      );
    } catch (error) {
      options.onError?.(error);
    } finally {
      running = false;
      if (pending && !disposed) {
        pending = false;
        schedule();
      }
    }
  }

  function dispose(): void {
    disposed = true;
    clearTimer();
    changedPaths = new Set();
    needsFullRefresh = false;
    pending = false;
  }

  return { handlePayload, schedule, resume, dispose };
}
