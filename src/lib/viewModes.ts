export const VIEW_MODES = [
  { id: 'source', label: '源码模式' },
  { id: 'preview', label: '预览模式' },
  { id: 'live', label: '实时预览' },
] as const;

export type ViewMode = (typeof VIEW_MODES)[number]['id'];
