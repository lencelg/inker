import type { FileEntry, NotesState } from '../types';

export interface WorkspaceLifecycleOptions {
  getState: () => Promise<NotesState>;
  pickNotesDir: () => Promise<string | null>;
  chooseNotesDir: (path: string) => Promise<NotesState>;
  applyState: (state: NotesState) => void;
  restoreSession: (state: NotesState) => Promise<boolean>;
  firstNotePath: (entries: FileEntry[]) => string | null;
  openNote: (path: string) => Promise<boolean>;
  saveAllDirtyTabs: () => Promise<boolean>;
  captureActiveState: () => void;
  persistSession: () => void;
  resetTabs: () => void;
  clearFeedback: () => void;
  setError: (error: unknown) => void;
  isBusy: () => boolean;
  setSwitching: (value: boolean) => void;
  setHydrating: (value: boolean) => void;
  scheduleSessionPersist: () => void;
}

export function useWorkspaceLifecycle(
  options: WorkspaceLifecycleOptions,
) {
  async function openFallback(state: NotesState): Promise<void> {
    const first = options.firstNotePath(state.entries);
    if (first) {
      await options.openNote(first);
    }
  }

  async function bootstrap(): Promise<void> {
    options.setHydrating(true);
    try {
      const state = await options.getState();
      options.applyState(state);
      let restored = false;
      try {
        restored = await options.restoreSession(state);
      } catch {
        restored = false;
      }
      if (!restored) {
        await openFallback(state);
      }
    } catch (error) {
      options.setError(error);
    } finally {
      options.setHydrating(false);
      options.scheduleSessionPersist();
    }
  }

  async function chooseFolder(): Promise<void> {
    if (options.isBusy()) return;

    try {
      const path = await options.pickNotesDir();
      if (!path) return;

      options.setSwitching(true);
      try {
        options.clearFeedback();
        if (!(await options.saveAllDirtyTabs())) return;
      } finally {
        options.setSwitching(false);
      }

      options.captureActiveState();
      options.persistSession();

      options.setHydrating(true);
      options.setSwitching(true);
      try {
        const state = await options.chooseNotesDir(path);
        options.resetTabs();
        options.applyState(state);

        let restored = false;
        try {
          restored = await options.restoreSession(state);
        } catch {
          restored = false;
        }
        if (!restored) {
          await openFallback(state);
        }
      } finally {
        options.setHydrating(false);
        options.setSwitching(false);
        options.scheduleSessionPersist();
      }
    } catch (error) {
      options.setError(error);
    }
  }

  return { bootstrap, chooseFolder };
}
