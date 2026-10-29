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

  it('includes the expanded palette of built-in themes', () => {
    for (const id of ['nord', 'dracula', 'gruvbox', 'solarized-light']) {
      expect(isBuiltInThemeId(id)).toBe(true);
      expect(allThemes().some((theme) => theme.id === id)).toBe(true);
    }
  });
});
