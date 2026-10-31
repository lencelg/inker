export const VIM_COMMAND_HISTORY_KEY = 'inker-vim-command-history';
export const MAX_VIM_COMMAND_HISTORY = 50;

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadVimCommandHistory(): string[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(VIM_COMMAND_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0,
      )
      .slice(-MAX_VIM_COMMAND_HISTORY);
  } catch {
    return [];
  }
}

export function recordVimCommand(command: string): string[] {
  const value = command.trim();
  const history = loadVimCommandHistory();
  if (!value || history[history.length - 1] === value) return history;

  const next = [...history, value].slice(-MAX_VIM_COMMAND_HISTORY);
  const store = storage();
  if (store) {
    try {
      store.setItem(VIM_COMMAND_HISTORY_KEY, JSON.stringify(next));
    } catch {
      // Storage is optional; the in-memory list still works.
    }
  }
  return next;
}
