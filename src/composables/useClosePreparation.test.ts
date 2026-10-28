import { describe, expect, it, vi } from 'vitest';
import { useClosePreparation } from './useClosePreparation';

function setup(
  overrides: {
    dirtyCount?: number;
    autoSave?: boolean;
    confirmUnsaved?: boolean;
    hasDialog?: boolean;
    saves?: boolean[];
    closeAnyway?: boolean;
  } = {},
) {
  const dirtyCount = overrides.dirtyCount ?? 0;
  const hasDialog = overrides.hasDialog ?? false;
  const saves = [...(overrides.saves ?? [])];
  const callbacks = {
    getDirtyCount: vi.fn(() => dirtyCount),
    autoSaveEnabled: vi.fn(() => overrides.autoSave ?? false),
    confirmUnsaved: vi.fn(
      async () => overrides.confirmUnsaved ?? true,
    ),
    saveAllDirtyTabs: vi.fn(async () => saves.shift() ?? true),
    hasAnyDialog: vi.fn(() => hasDialog),
    confirmSaveFailed: vi.fn(
      async () => overrides.closeAnyway ?? false,
    ),
    discardDrafts: vi.fn(),
  };
  const preparation = useClosePreparation(callbacks);
  return { preparation, callbacks };
}

describe('useClosePreparation', () => {
  it('closes immediately when no tabs are dirty', async () => {
    const { preparation, callbacks } = setup();

    await expect(preparation.prepare()).resolves.toBe(true);

    expect(callbacks.confirmUnsaved).not.toHaveBeenCalled();
    expect(callbacks.saveAllDirtyTabs).not.toHaveBeenCalled();
  });

  it('asks before saving when auto-save is off', async () => {
    const { preparation, callbacks } = setup({
      dirtyCount: 2,
      confirmUnsaved: false,
    });

    await expect(preparation.prepare()).resolves.toBe(false);

    expect(callbacks.confirmUnsaved).toHaveBeenCalledWith(2);
    expect(callbacks.saveAllDirtyTabs).not.toHaveBeenCalled();
  });

  it('saves without asking when auto-save is on', async () => {
    const { preparation, callbacks } = setup({
      dirtyCount: 1,
      autoSave: true,
    });

    await expect(preparation.prepare()).resolves.toBe(true);

    expect(callbacks.confirmUnsaved).not.toHaveBeenCalled();
    expect(callbacks.saveAllDirtyTabs).toHaveBeenCalledTimes(1);
  });

  it('retries a failed save once', async () => {
    const { preparation, callbacks } = setup({
      dirtyCount: 1,
      saves: [false, true],
    });

    await expect(preparation.prepare()).resolves.toBe(true);

    expect(callbacks.saveAllDirtyTabs).toHaveBeenCalledTimes(2);
  });

  it('does not ask to close anyway while a dialog is open', async () => {
    const { preparation, callbacks } = setup({
      dirtyCount: 1,
      saves: [false, false],
      hasDialog: true,
    });

    await expect(preparation.prepare()).resolves.toBe(false);

    expect(callbacks.confirmSaveFailed).not.toHaveBeenCalled();
  });

  it('discards drafts when closing despite save failure', async () => {
    const { preparation, callbacks } = setup({
      dirtyCount: 1,
      saves: [false, false],
      closeAnyway: true,
    });

    await expect(preparation.prepare()).resolves.toBe(true);

    expect(callbacks.confirmSaveFailed).toHaveBeenCalledTimes(1);
    expect(callbacks.discardDrafts).toHaveBeenCalledTimes(1);
  });

  it('stays open when close-anyway is declined', async () => {
    const { preparation, callbacks } = setup({
      dirtyCount: 1,
      saves: [false, false],
      closeAnyway: false,
    });

    await expect(preparation.prepare()).resolves.toBe(false);

    expect(callbacks.discardDrafts).not.toHaveBeenCalled();
  });
});
