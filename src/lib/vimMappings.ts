export type VimMappingMode =
  | 'normal'
  | 'visual'
  | 'insert'
  | 'operatorPending';
export type VimMappingCommand = string;

export interface VimMapping {
  mode: VimMappingMode;
  keys: string;
  command: VimMappingCommand;
}

export const DEFAULT_VIM_MAPPINGS = 'normal <Space>p pasteimage';
export const MAX_VIM_MAPPINGS = 20;
export const MAX_VIM_KEYS_LENGTH = 64;

const MODES: Record<string, VimMappingMode> = {
  normal: 'normal',
  visual: 'visual',
  insert: 'insert',
  operator: 'operatorPending',
  operatorpending: 'operatorPending',
};
const ACTIONS = new Set<string>(['pasteimage', 'save']);

function isValidKeys(keys: string): boolean {
  if (keys.length === 0 || keys.length > MAX_VIM_KEYS_LENGTH) return false;
  if (keys.startsWith(':') || /\s/.test(keys)) return false;
  return true;
}

export function parseVimMappings(value: string): VimMapping[] {
  if (!value) return [];

  const mappings = new Map<string, VimMapping>();
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    if (parts.length !== 3) continue;

    const mode = MODES[parts[0].toLowerCase()];
    const keys = parts[1];
    const rawCommand = parts[2];
    if (!mode || !isValidKeys(keys)) continue;

    const action = rawCommand.toLowerCase();
    let command: string;
    if (ACTIONS.has(action)) {
      command = action;
    } else if (rawCommand.startsWith('=')) {
      if (!isValidKeys(rawCommand.slice(1))) continue;
      command = rawCommand;
    } else {
      continue;
    }

    const mapping: VimMapping = { mode, keys, command };
    mappings.set(`${mapping.mode}\u0000${mapping.keys}`, mapping);
  }

  return [...mappings.values()].slice(0, MAX_VIM_MAPPINGS);
}
