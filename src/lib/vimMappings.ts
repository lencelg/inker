export type VimMappingMode = 'normal' | 'visual' | 'insert';
export type VimMappingCommand = 'pasteimage' | 'save';

export interface VimMapping {
  mode: VimMappingMode;
  keys: string;
  command: VimMappingCommand;
}

export const DEFAULT_VIM_MAPPINGS = 'normal <Space>p pasteimage';
export const MAX_VIM_MAPPINGS = 20;
export const MAX_VIM_KEYS_LENGTH = 64;

const MODES = new Set<string>(['normal', 'visual', 'insert']);
const COMMANDS = new Set<string>(['pasteimage', 'save']);

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

    const mode = parts[0].toLowerCase();
    const keys = parts[1];
    const command = parts[2].toLowerCase();
    if (!MODES.has(mode) || !COMMANDS.has(command)) continue;
    if (!isValidKeys(keys)) continue;

    const mapping: VimMapping = {
      mode: mode as VimMappingMode,
      keys,
      command: command as VimMappingCommand,
    };
    mappings.set(`${mapping.mode}\u0000${mapping.keys}`, mapping);
  }

  return [...mappings.values()].slice(0, MAX_VIM_MAPPINGS);
}
