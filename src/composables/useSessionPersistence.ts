import type { WorkspaceSession } from '../lib/session';

export interface SessionPersistenceOptions {
  enabled: () => boolean;
  isHydrating: () => boolean;
  build: () => WorkspaceSession | null;
  write: (session: WorkspaceSession) => void;
  debounceMs?: number;
  maxIntervalMs?: number;
  now?: () => number;
}

export function useSessionPersistence(
  options: SessionPersistenceOptions,
) {
  const debounceMs = options.debounceMs ?? 400;
  const maxIntervalMs = options.maxIntervalMs ?? 5000;
  const now = options.now ?? Date.now;
  let timer = 0;
  let lastPersistedAt = 0;

  function clearTimer(): void {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
  }

  function persistNow(): void {
    clearTimer();
    if (options.isHydrating()) return;
    const session = options.build();
    if (!session) return;
    options.write(session);
    lastPersistedAt = now();
  }

  function schedule(): void {
    if (!options.enabled() || options.isHydrating()) return;
    if (now() - lastPersistedAt >= maxIntervalMs) {
      persistNow();
      return;
    }
    clearTimer();
    timer = window.setTimeout(() => {
      timer = 0;
      persistNow();
    }, debounceMs);
  }

  return { persistNow, schedule, clearTimer };
}
