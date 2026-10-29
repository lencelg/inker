import { describe, expect, it } from 'vitest';
import { normalizePreferences } from './preferences';
import {
  DEFAULT_THEME_PRESET,
  expandPresetPatch,
  themePresetForPair,
  themePresetOptions,
} from './themePresets';

describe('theme presets', () => {
  it('matches known UI and code theme pairs', () => {
    expect(themePresetForPair('nord', 'nord')).toBe('nord');
    expect(themePresetForPair('dracula', 'dracula')).toBe('dracula');
    expect(themePresetForPair('paper', 'nord')).toBeNull();
    expect(themePresetForPair('custom-ui-x', 'github-dark')).toBeNull();
  });

  it('expands a preset into UI and code themes', () => {
    expect(expandPresetPatch({ themePreset: 'gruvbox' })).toEqual({
      themePreset: 'gruvbox',
      theme: 'gruvbox',
      codeTheme: 'gruvbox-dark',
    });
    expect(expandPresetPatch({ themePreset: 'custom' })).toEqual({
      themePreset: 'custom',
    });
  });

  it('offers presets plus a custom option', () => {
    const options = themePresetOptions();
    expect(options.some((option) => option.value === 'nord')).toBe(true);
    expect(options.at(-1)).toEqual({
      value: 'custom',
      label: 'Custom',
    });
  });

  it('derives the preset during preference normalization', () => {
    expect(normalizePreferences({}).themePreset).toBe(DEFAULT_THEME_PRESET);
    expect(
      normalizePreferences({ theme: 'nord', codeTheme: 'nord' }).themePreset,
    ).toBe('nord');
    expect(
      normalizePreferences({ theme: 'nord', codeTheme: 'monokai' })
        .themePreset,
    ).toBe('custom');
  });
});
