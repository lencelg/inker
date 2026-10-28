import { describe, expect, it, vi } from 'vitest';
import { useWindowClose } from './useWindowClose';

function setup(
  overrides: {
    blocked?: () => boolean;
    anyDialog?: () => boolean;
    imagePaste?: () => boolean;
    prepareClose?: () => Promise<boolean>;
    closeWindow?: () => Promise<void>;
  } = {},
) {
  const callbacks = {
    isBlocked: vi.fn(overrides.blocked ?? (() => false)),
    hasAnyDialog: vi.fn(overrides.anyDialog ?? (() => false)),
    isImagePasteOpen: vi.fn(overrides.imagePaste ?? (() => false)),
    cancelImagePaste: vi.fn(),
    captureActiveState: vi.fn(),
    persistSession: vi.fn(),
    cancelAutoSaveTimers: vi.fn(),
    waitForPendingSaves: vi.fn(
      async (): Promise<void> => undefined,
    ),
    prepareClose: vi.fn(
      overrides.prepareClose ?? (async () => true),
    ),
    scheduleAutoSaveForDirty: vi.fn(),
    flushDrafts: vi.fn(),
    setSuppressDrafts: vi.fn(),
    closeWindow: vi.fn(
      overrides.closeWindow ?? (async () => undefined),
    ),
    setError: vi.fn(),
  };
  const close = useWindowClose(callbacks);
  return { close, callbacks };
}

function event() {
  return { preventDefault: vi.fn() };
}

describe('useWindowClose', () => {
  it('prevents the close and runs the shutdown sequence', async () => {
    const { close, callbacks } = setup();
    const current = event();

    await close.handleCloseRequested(current);

    expect(current.preventDefault).toHaveBeenCalledTimes(1);
    expect(callbacks.captureActiveState).toHaveBeenCalledTimes(1);
    expect(callbacks.persistSession).toHaveBeenCalledTimes(1);
    expect(callbacks.cancelAutoSaveTimers).toHaveBeenCalledTimes(1);
    expect(callbacks.waitForPendingSaves).toHaveBeenCalledTimes(1);
    expect(callbacks.prepareClose).toHaveBeenCalledTimes(1);
    expect(callbacks.closeWindow).toHaveBeenCalledTimes(1);
    expect(close.isApproved()).toBe(true);
    expect(close.isInProgress()).toBe(false);
  });

  it('ignores subsequent close requests after approval', async () => {
    const { close, callbacks } = setup();
    await close.handleCloseRequested(event());
    const current = event();

    await close.handleCloseRequested(current);

    expect(current.preventDefault).not.toHaveBeenCalled();
    expect(callbacks.closeWindow).toHaveBeenCalledTimes(1);
  });

  it('does nothing while blocked or already closing', async () => {
    const blocked = setup({ blocked: () => true });
    const first = event();
    await blocked.close.handleCloseRequested(first);
    expect(first.preventDefault).toHaveBeenCalledTimes(1);
    expect(blocked.callbacks.closeWindow).not.toHaveBeenCalled();

    let resolveSaves: () => void = () => undefined;
    const closing = setup();
    closing.callbacks.waitForPendingSaves.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSaves = resolve;
        }),
    );
    const running = closing.close.handleCloseRequested(event());
    await Promise.resolve();
    const second = event();
    await closing.close.handleCloseRequested(second);
    expect(second.preventDefault).toHaveBeenCalledTimes(1);
    expect(closing.callbacks.closeWindow).not.toHaveBeenCalled();
    resolveSaves();
    await running;
    expect(closing.callbacks.closeWindow).toHaveBeenCalledTimes(1);
  });

  it('cancels an open image paste dialog', async () => {
    const { close, callbacks } = setup({
      imagePaste: () => true,
    });

    await close.handleCloseRequested(event());

    expect(callbacks.cancelImagePaste).toHaveBeenCalledTimes(1);
  });

  it('stays open when preparation is cancelled', async () => {
    const { close, callbacks } = setup({
      prepareClose: async () => false,
    });

    await close.handleCloseRequested(event());

    expect(callbacks.closeWindow).not.toHaveBeenCalled();
    expect(callbacks.flushDrafts).toHaveBeenCalledTimes(1);
    expect(callbacks.scheduleAutoSaveForDirty).toHaveBeenCalledTimes(1);
    expect(close.isApproved()).toBe(false);
  });

  it('stops if a dialog appears while pending saves finish', async () => {
    let hasDialog = false;
    const { close, callbacks } = setup({
      anyDialog: () => hasDialog,
    });
    callbacks.waitForPendingSaves.mockImplementation(async () => {
      hasDialog = true;
    });

    await close.handleCloseRequested(event());

    expect(callbacks.prepareClose).not.toHaveBeenCalled();
    expect(callbacks.closeWindow).not.toHaveBeenCalled();
    expect(callbacks.scheduleAutoSaveForDirty).toHaveBeenCalledTimes(1);
  });

  it('reports close errors and restores auto-save', async () => {
    const { close, callbacks } = setup({
      closeWindow: async () => {
        throw new Error('close failed');
      },
    });

    await close.handleCloseRequested(event());

    expect(callbacks.setError).toHaveBeenCalledTimes(1);
    expect(callbacks.setSuppressDrafts).toHaveBeenCalledWith(false);
    expect(callbacks.scheduleAutoSaveForDirty).toHaveBeenCalledTimes(1);
    expect(close.isApproved()).toBe(false);
    expect(close.isInProgress()).toBe(false);
  });

  it('closes directly for the custom close button', async () => {
    const { close, callbacks } = setup();

    await close.close();

    expect(callbacks.closeWindow).toHaveBeenCalledTimes(1);
  });
});
