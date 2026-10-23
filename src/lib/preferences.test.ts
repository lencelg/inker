import { describe, expect, it } from 'vitest';
import { normalizePreferences } from './preferences';

describe('preferences', () => {
  it('defaults immersive writing to off', () => {
    expect(normalizePreferences({}).immersive).toBe(false);
  });

  it('keeps immersive writing enabled', () => {
    expect(normalizePreferences({ immersive: true }).immersive).toBe(true);
  });
});
