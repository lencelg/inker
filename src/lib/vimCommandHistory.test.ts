import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadVimCommandHistory,
  MAX_VIM_COMMAND_HISTORY,
  recordVimCommand,
  VIM_COMMAND_HISTORY_KEY,
} from './vimCommandHistory';

beforeEach(() => {
  localStorage.removeItem(VIM_COMMAND_HISTORY_KEY);
});

describe('Vim command history', () => {
  it('records and loads commands in order', () => {
    recordVimCommand('set textwidth=80');
    recordVimCommand('w');

    expect(loadVimCommandHistory()).toEqual([
      'set textwidth=80',
      'w',
    ]);
  });

  it('ignores empty commands and consecutive duplicates', () => {
    recordVimCommand('  ');
    recordVimCommand('w');
    recordVimCommand('w');
    recordVimCommand('s/a/b/g');

    expect(loadVimCommandHistory()).toEqual(['w', 's/a/b/g']);
  });

  it('caps the history length', () => {
    for (let index = 0; index < MAX_VIM_COMMAND_HISTORY + 5; index += 1) {
      recordVimCommand('set textwidth=' + index);
    }

    const history = loadVimCommandHistory();
    expect(history).toHaveLength(MAX_VIM_COMMAND_HISTORY);
    expect(history[0]).toBe('set textwidth=5');
    expect(history.at(-1)).toBe(
      'set textwidth=' + (MAX_VIM_COMMAND_HISTORY + 4),
    );
  });

  it('ignores corrupt storage', () => {
    localStorage.setItem(VIM_COMMAND_HISTORY_KEY, '{not json');
    expect(loadVimCommandHistory()).toEqual([]);

    localStorage.setItem(
      VIM_COMMAND_HISTORY_KEY,
      JSON.stringify(['ok', 3, '', null, 'next']),
    );
    expect(loadVimCommandHistory()).toEqual(['ok', 'next']);
  });
});
