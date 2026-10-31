import type { FileEntry, NotesState } from '../types';

export interface WorkspaceLifecycleOptions {
  getState: () => Promise<NotesState>;
  pickNotesDir: () => Promise<string | null>;
  chooseNotesDir: (path: string) => Promise<NotesState>;
  applyState: (state: NotesState) => void;
  showLauncher: (state: NotesState) => void;
  recordWorkspace: (state: NotesState) => void;
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

  async function bootstrapLauncher(): Promise<void> {
    options.setHydrating(true);
    try {
      const state = await options.getState();
      options.showLauncher(state);
    } catch (error) {
      options.setError(error);
    } finally {
      options.setHydrating(false);
    }
  }

  async function switchTo(path: string): Promise<void> {
    if (options.isBusy()) return;

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
      options.recordWorkspace(state);

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
  }

  async function chooseFolder(): Promise<void> {
    if (options.isBusy()) return;
    try {
      const path = await options.pickNotesDir();
      if (!path) return;
      await switchTo(path);
    } catch (error) {
      options.setError(error);
    }
  }

  async function openWorkspace(path: string): Promise<void> {
    if (options.isBusy()) return;
    const value = path.trim();
    if (!value) return;
    try {
      await switchTo(value);
    } catch (error) {
      options.setError(error);
    }
  }

  return { bootstrapLauncher, chooseFolder, openWorkspace };
}
