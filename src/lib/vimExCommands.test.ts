import { describe, expect, it } from 'vitest';
import {
  APP_VIM_EX_COMMANDS,
  VIM_EX_COMPLETION_NAMES,
} from './vimExCommands';

describe('Vim ex commands', () => {
  it('registers the app-specific commands with valid prefixes', () => {
    const names = APP_VIM_EX_COMMANDS.map((command) => command.name);
    expect(names).toEqual([
      'write',
      'pasteimage',
      'edit',
      'quit',
      'wq',
      'xit',
      'bnext',
      'bprevious',
    ]);

    for (const command of APP_VIM_EX_COMMANDS) {
      const prefix = command.prefix ?? command.name;
      expect(command.name.startsWith(prefix)).toBe(true);
    }
  });

  it('completes app commands but not the save-and-close wq', () => {
    expect(VIM_EX_COMPLETION_NAMES).toContain('write');
    expect(VIM_EX_COMPLETION_NAMES).toContain('edit');
    expect(VIM_EX_COMPLETION_NAMES).toContain('quit');
    expect(VIM_EX_COMPLETION_NAMES).toContain('bnext');
    expect(VIM_EX_COMPLETION_NAMES).toContain('pasteimage');
    expect(VIM_EX_COMPLETION_NAMES).not.toContain('wq');
  });
});
