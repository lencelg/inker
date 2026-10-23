import { describe, expect, it } from 'vitest';
import {
  applyLineEnding,
  normalizeLineEndings,
  usesCrlf,
} from './lineEndings';

describe('line endings', () => {
  it('detects CRLF content', () => {
    expect(usesCrlf('a\r\nb')).toBe(true);
    expect(usesCrlf('a\nb')).toBe(false);
  });

  it('normalizes CRLF for the rich editor', () => {
    expect(normalizeLineEndings('a\r\nb\r\nc')).toBe('a\nb\nc');
  });

  it('restores CRLF for saving', () => {
    expect(applyLineEnding('a\nb\n', true)).toBe('a\r\nb\r\n');
    expect(applyLineEnding('a\nb\n', false)).toBe('a\nb\n');
  });
});
