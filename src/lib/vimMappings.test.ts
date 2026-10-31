import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIM_MAPPINGS,
  MAX_VIM_MAPPINGS,
  parseVimMappings,
} from './vimMappings';

describe('parseVimMappings', () => {
  it('parses the default paste-image mapping', () => {
    expect(parseVimMappings(DEFAULT_VIM_MAPPINGS)).toEqual([
      { mode: 'normal', keys: '<Space>p', command: 'pasteimage' },
    ]);
  });

  it('parses multiple modes and commands', () => {
    expect(
      parseVimMappings(
        [
          '# custom mappings',
          '',
          'normal <Space>p pasteimage',
          'normal <C-s> save',
          'visual <Space>s save',
          'insert <C-p> pasteimage',
        ].join('\n'),
      ),
    ).toEqual([
      { mode: 'normal', keys: '<Space>p', command: 'pasteimage' },
      { mode: 'normal', keys: '<C-s>', command: 'save' },
      { mode: 'visual', keys: '<Space>s', command: 'save' },
      { mode: 'insert', keys: '<C-p>', command: 'pasteimage' },
    ]);
  });

  it('parses operator-pending and key-to-key mappings', () => {
    expect(
      parseVimMappings(
        [
          'operatorPending iw =ciw',
          'insert jk =<Esc>',
          'normal Q =gq',
        ].join('\n'),
      ),
    ).toEqual([
      { mode: 'operatorPending', keys: 'iw', command: '=ciw' },
      { mode: 'insert', keys: 'jk', command: '=<Esc>' },
      { mode: 'normal', keys: 'Q', command: '=gq' },
    ]);
  });

  it('ignores malformed lines', () => {
    expect(
      parseVimMappings(
        [
          'bogus <Space>p save',
          'normal <Space>p nope',
          'normal',
          'normal <Space>p',
          'normal :x save',
          'normal <Space> p save',
          'insert jk =',
          'insert jk =:w',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('keeps the last duplicate for a mode and key sequence', () => {
    expect(
      parseVimMappings(
        ['normal <Space>p save', 'normal <Space>p pasteimage'].join('\n'),
      ),
    ).toEqual([
      { mode: 'normal', keys: '<Space>p', command: 'pasteimage' },
    ]);
  });

  it('trims whitespace and normalizes case', () => {
    expect(
      parseVimMappings('  Normal   <Space>P   PasteImage  '),
    ).toEqual([
      { mode: 'normal', keys: '<Space>P', command: 'pasteimage' },
    ]);
  });

  it('caps the number of mappings', () => {
    const lines = Array.from(
      { length: MAX_VIM_MAPPINGS + 5 },
      (_, index) => `normal <Space>${index} save`,
    );
    expect(parseVimMappings(lines.join('\n'))).toHaveLength(
      MAX_VIM_MAPPINGS,
    );
  });

  it('returns an empty list for empty input', () => {
    expect(parseVimMappings('')).toEqual([]);
    expect(parseVimMappings('   \n# only comments')).toEqual([]);
  });
});
