export interface VimModeChange {
  mode?: string | null;
  subMode?: string | null;
}

export function formatVimMode(change: VimModeChange = {}): string {
  const mode = (change.mode ?? 'normal').toLowerCase();

  if (mode.includes('visual')) {
    if (mode.includes('line') || change.subMode === 'linewise') {
      return 'V-LINE';
    }
    if (mode.includes('block') || change.subMode === 'blockwise') {
      return 'V-BLOCK';
    }
    return 'VISUAL';
  }
  if (mode.includes('insert')) return 'INSERT';
  if (mode.includes('replace')) return 'REPLACE';
  if (mode.includes('normal')) return 'NORMAL';
  return mode.toUpperCase();
}
