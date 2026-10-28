export interface AutoSaveTab {
  path: string;
  content: string;
  savedContent: string;
}

export interface AutoSaveOptions {
  enabled: () => boolean;
  delay: () => number;
  getTab: (path: string) => AutoSaveTab | undefined;
  isImage: (path: string) => boolean;
  isBlocked: () => boolean;
  save: (path: string) => Promise<boolean>;
}

export function useAutoSave(options: AutoSaveOptions) {
  const timers = new Map<string, number>();

  function cancel(path: string): void {
    const timer = timers.get(path);
    if (timer === undefined) return;
    window.clearTimeout(timer);
    timers.delete(path);
  }

  function cancelAll(): void {
    for (const timer of timers.values()) {
      window.clearTimeout(timer);
    }
    timers.clear();
  }

  async function run(path: string): Promise<void> {
    if (!options.enabled()) return;
    const tab = options.getTab(path);
    if (
      !tab ||
      options.isImage(path) ||
      tab.content === tab.savedContent
    ) {
      return;
    }
    if (options.isBlocked()) {
      schedule(path);
      return;
    }

    const saved = await options.save(path);
    const latest = options.getTab(path);
    if (
      saved &&
      latest &&
      latest.content !== latest.savedContent &&
      options.enabled()
    ) {
      schedule(path);
    }
  }

  function schedule(path: string): void {
    if (!options.enabled()) return;
    cancel(path);
    timers.set(
      path,
      window.setTimeout(() => {
        timers.delete(path);
        void run(path);
      }, options.delay()),
    );
  }

  function scheduleDirty(paths: Iterable<string>): void {
    if (!options.enabled()) return;
    for (const path of paths) {
      schedule(path);
    }
  }

  return { schedule, scheduleDirty, cancel, cancelAll };
}
