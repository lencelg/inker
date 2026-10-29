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
    expect(CODE_THEMES.length).toBeGreaterThanOrEqual(14);
    expect(isCodeThemeId(DEFAULT_CODE_THEME)).toBe(true);
    for (const id of [
      'github-dark',
      'monokai',
      'tokyo-night',
      'atom-one-light',
      'github-dark-dimmed',
      'dracula',
      'solarized-dark',
      'solarized-light',
      'gruvbox-dark',
      'tokyo-night-light',
    ]) {
      expect(CODE_THEMES.map((theme) => theme.id)).toContain(id);
    }
  });

  it('applies a theme immediately without duplicating style tags', () => {
    applyCodeTheme('nord');
    const nord = codeThemeById('nord');
    expect(document.documentElement.dataset.codeTheme).toBe('nord');
    expect(
      document.documentElement.style.getPropertyValue('--code-bg'),
    ).toBe(nord.background);
    expect(
      document.getElementById('inker-code-theme'),
    ).toBeNull();
    expect(
      document.documentElement.style.getPropertyValue(
        '--code-syntax-keyword',
      ),
    ).toBe(nord.palette.colors.keyword);

    applyCodeTheme('github-light');
    const light = codeThemeById('github-light');
    expect(document.documentElement.dataset.codeTheme).toBe(
      'github-light',
    );
    expect(
      document.documentElement.style.getPropertyValue('--code-fg'),
    ).toBe(light.foreground);
    expect(
      document.getElementById('inker-code-theme'),
    ).toBeNull();
  });

  it('rejects unknown theme ids', () => {
    expect(isCodeThemeId('unknown')).toBe(false);
    expect(isCodeThemeId(null)).toBe(false);
  });
});
