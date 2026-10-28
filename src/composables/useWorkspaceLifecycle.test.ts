import { describe, expect, it, vi } from 'vitest';
import type { NotesState } from '../types';
import { useWorkspaceLifecycle } from './useWorkspaceLifecycle';

function state(path = '/notes'): NotesState {
  return {
    notesDir: path,
    entries: [
      { path: 'a.md', name: 'a.md', isDir: false },
    ],
  };
}

function setup(
  overrides: {
    busy?: () => boolean;
    saveAllDirtyTabs?: () => Promise<boolean>;
    restoreSession?: (state: NotesState) => Promise<boolean>;
  } = {},
) {
  const callbacks = {
    getState: vi.fn(async () => state()),
    pickNotesDir: vi.fn(async () => '/notes' as string | null),
    chooseNotesDir: vi.fn(async () => state('/other')),
    applyState: vi.fn(),
    restoreSession: vi.fn(
      overrides.restoreSession ?? (async () => true),
    ),
    firstNotePath: vi.fn(() => 'a.md'),
    openNote: vi.fn(async () => true),
    saveAllDirtyTabs: vi.fn(
      overrides.saveAllDirtyTabs ?? (async () => true),
    ),
    captureActiveState: vi.fn(),
    persistSession: vi.fn(),
    resetTabs: vi.fn(),
    clearFeedback: vi.fn(),
    setError: vi.fn(),
    isBusy: vi.fn(overrides.busy ?? (() => false)),
    setSwitching: vi.fn(),
    setHydrating: vi.fn(),
    scheduleSessionPersist: vi.fn(),
  };
  const lifecycle = useWorkspaceLifecycle(callbacks);
  return { lifecycle, callbacks };
}

describe('useWorkspaceLifecycle', () => {
  it('boots into a restored session', async () => {
    const { lifecycle, callbacks } = setup();

    await lifecycle.bootstrap();

    expect(callbacks.applyState).toHaveBeenCalledWith(state());
    expect(callbacks.restoreSession).toHaveBeenCalledTimes(1);
    expect(callbacks.openNote).not.toHaveBeenCalled();
    expect(callbacks.setHydrating.mock.calls).toEqual([[true], [false]]);
    expect(callbacks.scheduleSessionPersist).toHaveBeenCalledTimes(1);
  });

  it('falls back to the first note when restore fails', async () => {
    const { lifecycle, callbacks } = setup({
      restoreSession: async () => false,
    });

    await lifecycle.bootstrap();

    expect(callbacks.openNote).toHaveBeenCalledWith('a.md');
  });

  it('falls back when restore throws', async () => {
    const { lifecycle, callbacks } = setup({
      restoreSession: async () => {
        throw new Error('restore failed');
      },
    });

    await lifecycle.bootstrap();

    expect(callbacks.openNote).toHaveBeenCalledWith('a.md');
    expect(callbacks.setError).not.toHaveBeenCalled();
  });

  it('reports bootstrap errors and clears hydrating', async () => {
    const { lifecycle, callbacks } = setup();
    callbacks.getState.mockRejectedValue(new Error('state failed'));

    await lifecycle.bootstrap();

    expect(callbacks.setError).toHaveBeenCalledTimes(1);
    expect(callbacks.setHydrating).toHaveBeenLastCalledWith(false);
    expect(callbacks.scheduleSessionPersist).toHaveBeenCalledTimes(1);
  });

  it('ignores folder switching while busy', async () => {
    const { lifecycle, callbacks } = setup({ busy: () => true });

    await lifecycle.chooseFolder();

    expect(callbacks.pickNotesDir).not.toHaveBeenCalled();
  });

  it('does nothing when the folder picker is cancelled', async () => {
    const { lifecycle, callbacks } = setup();
    callbacks.pickNotesDir.mockResolvedValue(null);

    await lifecycle.chooseFolder();

    expect(callbacks.chooseNotesDir).not.toHaveBeenCalled();
    expect(callbacks.applyState).not.toHaveBeenCalled();
  });

  it('aborts switching when dirty tabs cannot be saved', async () => {
    const { lifecycle, callbacks } = setup({
      saveAllDirtyTabs: async () => false,
    });

    await lifecycle.chooseFolder();

    expect(callbacks.chooseNotesDir).not.toHaveBeenCalled();
    expect(callbacks.resetTabs).not.toHaveBeenCalled();
    expect(callbacks.setSwitching).toHaveBeenLastCalledWith(false);
  });

  it('switches workspaces and restores the target session', async () => {
    const { lifecycle, callbacks } = setup();

    await lifecycle.chooseFolder();

    expect(callbacks.saveAllDirtyTabs).toHaveBeenCalledTimes(1);
    expect(callbacks.captureActiveState).toHaveBeenCalledTimes(1);
    expect(callbacks.persistSession).toHaveBeenCalledTimes(1);
    expect(callbacks.chooseNotesDir).toHaveBeenCalledWith('/notes');
    expect(callbacks.resetTabs).toHaveBeenCalledTimes(1);
    expect(callbacks.applyState).toHaveBeenCalledWith(state('/other'));
    expect(callbacks.restoreSession).toHaveBeenCalledTimes(1);
    expect(callbacks.openNote).not.toHaveBeenCalled();
    expect(callbacks.setHydrating.mock.calls).toEqual([[true], [false]]);
    expect(callbacks.scheduleSessionPersist).toHaveBeenCalledTimes(1);
  });

  it('opens the first note when the target session cannot be restored', async () => {
    const { lifecycle, callbacks } = setup({
      restoreSession: async () => false,
    });

    await lifecycle.chooseFolder();

    expect(callbacks.openNote).toHaveBeenCalledWith('a.md');
  });

  it('reports switch errors and resets flags', async () => {
    const { lifecycle, callbacks } = setup();
    callbacks.chooseNotesDir.mockRejectedValue(new Error('switch failed'));

    await lifecycle.chooseFolder();

    expect(callbacks.setError).toHaveBeenCalledTimes(1);
    expect(callbacks.setSwitching).toHaveBeenLastCalledWith(false);
    expect(callbacks.setHydrating).toHaveBeenLastCalledWith(false);
  });
});
