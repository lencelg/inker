import { describe, expect, it } from 'vitest';
import { normalizePreferences } from './preferences';

describe('preferences', () => {
  it('defaults immersive writing to off', () => {
    expect(normalizePreferences({}).immersive).toBe(false);
  });

  it('keeps immersive writing enabled', () => {
    expect(normalizePreferences({ immersive: true }).immersive).toBe(true);
  });

  it('enables preview code highlighting by default', () => {
    expect(normalizePreferences({}).codeHighlight).toBe(true);
  });

  it('keeps disabled preview code highlighting', () => {
    expect(
      normalizePreferences({ codeHighlight: false }).codeHighlight,
    ).toBe(false);
  });
});
