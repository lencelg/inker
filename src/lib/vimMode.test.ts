import { describe, expect, it } from 'vitest';
import { formatVimMode } from './vimMode';

describe('Vim status labels', () => {
  it('formats the common modes', () => {
    expect(formatVimMode()).toBe('NORMAL');
    expect(formatVimMode({ mode: 'normal' })).toBe('NORMAL');
    expect(formatVimMode({ mode: 'insert' })).toBe('INSERT');
    expect(formatVimMode({ mode: 'replace' })).toBe('REPLACE');
    expect(formatVimMode({ mode: 'visual' })).toBe('VISUAL');
  });

  it('distinguishes visual line and block modes', () => {
    expect(formatVimMode({ mode: 'visual', subMode: 'linewise' })).toBe(
      'V-LINE',
    );
    expect(formatVimMode({ mode: 'visual', subMode: 'blockwise' })).toBe(
      'V-BLOCK',
    );
    expect(formatVimMode({ mode: 'visual line' })).toBe('V-LINE');
  });
});
