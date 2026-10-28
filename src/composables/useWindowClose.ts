export interface CloseRequestEvent {
  preventDefault(): void;
}

export interface WindowCloseOptions {
  isBlocked: () => boolean;
  hasAnyDialog: () => boolean;
  isImagePasteOpen: () => boolean;
  cancelImagePaste: () => void;
  captureActiveState: () => void;
  persistSession: () => void;
  cancelAutoSaveTimers: () => void;
  waitForPendingSaves: () => Promise<void>;
  prepareClose: () => Promise<boolean>;
  scheduleAutoSaveForDirty: () => void;
  flushDrafts: () => void;
  setSuppressDrafts: (value: boolean) => void;
  closeWindow: () => Promise<void>;
  setError: (error: unknown) => void;
}

export function useWindowClose(options: WindowCloseOptions) {
  let approved = false;
  let inProgress = false;

  async function handleCloseRequested(
    event: CloseRequestEvent,
  ): Promise<void> {
    if (approved) return;
    event.preventDefault();
    if (inProgress || options.isBlocked()) {
      return;
    }
    if (options.isImagePasteOpen()) {
      options.cancelImagePaste();
    }

    inProgress = true;
    try {
      options.captureActiveState();
      options.persistSession();
      options.cancelAutoSaveTimers();
      await options.waitForPendingSaves();

      if (options.hasAnyDialog()) {
        approved = false;
        options.scheduleAutoSaveForDirty();
        return;
      }

      if (!(await options.prepareClose())) {
        approved = false;
        options.flushDrafts();
        options.scheduleAutoSaveForDirty();
        return;
      }

      approved = true;
      await options.closeWindow();
    } catch (error) {
      approved = false;
      options.setSuppressDrafts(false);
      options.scheduleAutoSaveForDirty();
      options.setError(error);
    } finally {
      inProgress = false;
    }
  }

  async function close(): Promise<void> {
    try {
      await options.closeWindow();
    } catch (error) {
      options.setError(error);
    }
  }

  return {
    handleCloseRequested,
    close,
    isApproved: () => approved,
    isInProgress: () => inProgress,
  };
}
