export const THEMES = [
  { id: 'paper', label: '暖白' },
  { id: 'white', label: '白色' },
  { id: 'dark', label: '深色' },
  { id: 'vscode-light', label: 'VS Code Light+' },
  { id: 'vscode-dark', label: 'VS Code Dark+' },
  { id: 'vscode-hc', label: 'VS Code 高对比' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'paper';
export const THEME_STORAGE_KEY = 'markleaf-theme';

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === 'string' &&
    THEMES.some((theme) => theme.id === value)
  );
}
