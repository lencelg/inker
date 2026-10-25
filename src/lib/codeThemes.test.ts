import { afterEach, describe, expect, it } from 'vitest';
import {
  CODE_THEMES,
  DEFAULT_CODE_THEME,
  applyCodeTheme,
  codeThemeById,
  isCodeThemeId,
} from './codeThemes';

afterEach(() => {
  document.getElementById('inker-code-theme')?.remove();
  delete document.documentElement.dataset.codeTheme;
  document.documentElement.style.removeProperty('--code-bg');
  document.documentElement.style.removeProperty('--code-fg');
});

describe('code themes', () => {
  it('ships several popular themes with a valid default', () => {
    expect(CODE_THEMES.length).toBeGreaterThanOrEqual(6);
    expect(isCodeThemeId(DEFAULT_CODE_THEME)).toBe(true);
    expect(CODE_THEMES.map((theme) => theme.id)).toContain('github-dark');
    expect(CODE_THEMES.map((theme) => theme.id)).toContain('monokai');
    expect(CODE_THEMES.map((theme) => theme.id)).toContain('tokyo-night');
  });

  it('applies a theme immediately without duplicating style tags', () => {
    applyCodeTheme('nord');
    const nord = codeThemeById('nord');
    expect(document.documentElement.dataset.codeTheme).toBe('nord');
    expect(
      document.documentElement.style.getPropertyValue('--code-bg'),
    ).toBe(nord.background);
    expect(
      document.querySelectorAll('#inker-code-theme'),
    ).toHaveLength(1);

    applyCodeTheme('github-light');
    const light = codeThemeById('github-light');
    expect(document.documentElement.dataset.codeTheme).toBe(
      'github-light',
    );
    expect(
      document.documentElement.style.getPropertyValue('--code-fg'),
    ).toBe(light.foreground);
    expect(
      document.querySelectorAll('#inker-code-theme'),
    ).toHaveLength(1);
  });

  it('rejects unknown theme ids', () => {
    expect(isCodeThemeId('unknown')).toBe(false);
    expect(isCodeThemeId(null)).toBe(false);
  });
});
