export interface ClosePreparationOptions {
  getDirtyCount: () => number;
  autoSaveEnabled: () => boolean;
  confirmUnsaved: (count: number) => Promise<boolean>;
  saveAllDirtyTabs: () => Promise<boolean>;
  hasAnyDialog: () => boolean;
  confirmSaveFailed: () => Promise<boolean>;
  discardDrafts: () => void;
}

export function useClosePreparation(
  options: ClosePreparationOptions,
) {
  async function prepare(): Promise<boolean> {
    const dirtyCount = options.getDirtyCount();
    if (dirtyCount === 0) return true;

    const shouldSave =
      options.autoSaveEnabled() ||
      (await options.confirmUnsaved(dirtyCount));
    if (!shouldSave) return false;

    if (await options.saveAllDirtyTabs()) return true;
    if (await options.saveAllDirtyTabs()) return true;
    if (options.hasAnyDialog()) return false;

    const closeAnyway = await options.confirmSaveFailed();
    if (closeAnyway) {
      options.discardDrafts();
    }
    return closeAnyway;
  }

  return { prepare };
}
