import { t } from './i18n';

export const FONTS = [
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    stack:
      "'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    stack:
      "'Fira Code', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'source-code-pro',
    label: 'Source Code Pro',
    stack:
      "'Source Code Pro', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    id: 'system-mono',
    label: 'System Monospace',
    labelKey: 'font.systemMono',
    stack:
      "ui-monospace, SFMono-Regular, Menlo, Consolas, 'DejaVu Sans Mono', monospace",
  },
] as const;

export type FontId = (typeof FONTS)[number]['id'];
type FontDefinition = (typeof FONTS)[number];

export const DEFAULT_FONT: FontId = 'jetbrains-mono';

export function fontLabel(font: FontDefinition): string {
  return 'labelKey' in font ? t(font.labelKey) : font.label;
}

export function isFontId(value: unknown): value is FontId {
  return (
    typeof value === 'string' && FONTS.some((font) => font.id === value)
  );
}

export function fontById(id: FontId) {
  return FONTS.find((font) => font.id === id) ?? FONTS[0];
}
