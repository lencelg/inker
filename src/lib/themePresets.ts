import {
  allCodeThemes,
  type CodeThemeId,
} from './codeThemes';
import { allThemes, type BuiltInThemeId, type ThemeId } from './themes';
import { t } from './i18n';
import type { Preferences } from './preferences';

export type ThemePresetValue = BuiltInThemeId | 'custom';

export interface ThemePreset {
  id: BuiltInThemeId;
  theme: ThemeId;
  codeTheme: CodeThemeId;
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: 'paper', theme: 'paper', codeTheme: 'github-dark' },
  { id: 'white', theme: 'white', codeTheme: 'github-light' },
  { id: 'dark', theme: 'dark', codeTheme: 'github-dark' },
  { id: 'monokai', theme: 'monokai', codeTheme: 'monokai' },
  { id: 'nord', theme: 'nord', codeTheme: 'nord' },
  { id: 'dracula', theme: 'dracula', codeTheme: 'dracula' },
  { id: 'gruvbox', theme: 'gruvbox', codeTheme: 'gruvbox-dark' },
  {
    id: 'solarized-light',
    theme: 'solarized-light',
    codeTheme: 'solarized-light',
  },
  { id: 'vscode-light', theme: 'vscode-light', codeTheme: 'atom-one-light' },
  { id: 'vscode-dark', theme: 'vscode-dark', codeTheme: 'vs-dark' },
  {
    id: 'vscode-hc',
    theme: 'vscode-hc',
    codeTheme: 'github-dark-high-contrast',
  },
];

export const DEFAULT_THEME_PRESET: ThemePresetValue = 'paper';

export function themePresetForPair(
  theme: string,
  codeTheme: string,
): BuiltInThemeId | null {
  return (
    THEME_PRESETS.find(
      (preset) =>
        preset.theme === theme && preset.codeTheme === codeTheme,
    )?.id ?? null
  );
}

export function themePresetOptions(): Array<{
  value: ThemePresetValue;
  label: string;
}> {
  const themes = new Map(allThemes().map((theme) => [theme.id, theme.label]));
  const codeThemes = new Map(
    allCodeThemes().map((theme) => [theme.id, theme.label]),
  );
  return [
    ...THEME_PRESETS.map((preset) => ({
      value: preset.id,
      label: `${themes.get(preset.theme) ?? preset.theme} + ${
        codeThemes.get(preset.codeTheme) ?? preset.codeTheme
      }`,
    })),
    { value: 'custom', label: t('themePreset.custom') },
  ];
}

export function expandPresetPatch(
  patch: Partial<Preferences>,
): Partial<Preferences> {
  const presetId = patch.themePreset;
  if (!presetId || presetId === 'custom') return patch;
  const preset = THEME_PRESETS.find((item) => item.id === presetId);
  if (!preset) return patch;
  return {
    ...patch,
    theme: preset.theme,
    codeTheme: preset.codeTheme,
  };
}
