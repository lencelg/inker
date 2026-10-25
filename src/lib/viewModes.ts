import { t, type TranslationKey } from './i18n';

export const VIEW_MODES = [
  { id: 'source', labelKey: 'viewMode.source' },
  { id: 'wysiwyg', labelKey: 'viewMode.wysiwyg' },
  { id: 'preview', labelKey: 'viewMode.preview' },
  { id: 'side', labelKey: 'viewMode.side' },
] as const;

export type ViewMode = (typeof VIEW_MODES)[number]['id'];

export function viewModeLabel(mode: ViewMode): string {
  const item = VIEW_MODES.find((entry) => entry.id === mode);
  return t((item?.labelKey ?? 'viewMode.source') as TranslationKey);
}
