import { describe, expect, it } from 'vitest';
import { allThemes, isBuiltInThemeId, isThemeId } from './themes';

describe('UI themes', () => {
  it('includes Monokai as a built-in theme', () => {
    expect(isBuiltInThemeId('monokai')).toBe(true);
    expect(isThemeId('monokai')).toBe(true);
    expect(allThemes()).toContainEqual({
      id: 'monokai',
      label: 'Monokai',
    });
  });
});
