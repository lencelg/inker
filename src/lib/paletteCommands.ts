import { allCodeThemes } from './codeThemes';
import { t } from './i18n';
import type { PaletteItem } from './palette';
import { allThemes } from './themes';

export interface CommandPaletteState {
  canEdit: boolean;
  vimEnabled: boolean;
  immersive: boolean;
  autoSave: boolean;
  quickOpenIncludeImages: boolean;
  sidebarVisible: boolean;
}

export function themePaletteItems(
  currentTheme: string,
): PaletteItem[] {
  return [
    { id: '__back', label: t('palette.back'), kind: 'back' },
    ...allThemes().map((theme) => ({
      id: theme.id,
      label: theme.label,
      detail:
        theme.id === currentTheme ? t('palette.current') : undefined,
      kind: 'theme' as const,
    })),
  ];
}

export function codeThemePaletteItems(
  currentCodeTheme: string,
): PaletteItem[] {
  return [
    { id: '__back', label: t('palette.back'), kind: 'back' },
    ...allCodeThemes().map((theme) => ({
      id: theme.id,
      label: theme.label,
      detail:
        theme.id === currentCodeTheme
          ? t('palette.current')
          : undefined,
      kind: 'theme' as const,
    })),
  ];
}

function toggleDetail(value: boolean): string {
  return t(value ? 'palette.on' : 'palette.off');
}

export function commandPaletteItems(
  state: CommandPaletteState,
): PaletteItem[] {
  const command = (
    id: string,
    label: string,
    keywords: string[],
    extra: Partial<PaletteItem> = {},
  ): PaletteItem => ({
    id,
    label,
    keywords,
    kind: 'command',
    ...extra,
  });

  return [
    command('preferences.colorTheme', t('command.preferences.colorTheme'), [
      'theme',
      'color',
      'appearance',
      '主题',
      '界面',
      '外观',
    ]),
    command('preferences.codeTheme', t('command.preferences.codeTheme'), [
      'theme',
      'code',
      'syntax',
      'highlight',
      '代码',
      '主题',
      '高亮',
    ]),
    command(
      'preferences.openSettings',
      t('command.preferences.openSettings'),
      ['settings', 'preferences', '设置', '首选项', '配置'],
    ),
    command(
      'preferences.toggleVim',
      t('command.preferences.toggleVim'),
      ['vim', 'keymap', 'editor', '模式', '快捷键'],
      { detail: toggleDetail(state.vimEnabled) },
    ),
    command(
      'preferences.toggleZen',
      t('command.preferences.toggleZen'),
      ['zen', 'immersive', 'focus', '沉浸', '专注'],
      { detail: toggleDetail(state.immersive) },
    ),
    command(
      'preferences.toggleAutoSave',
      t('command.preferences.toggleAutoSave'),
      ['autosave', 'save', '自动保存', '保存'],
      { detail: toggleDetail(state.autoSave) },
    ),
    command(
      'preferences.toggleQuickOpenImages',
      t('command.preferences.toggleQuickOpenImages'),
      ['quick open', 'image', 'ctrl+p', '快速打开', '图片', '文件'],
      { detail: toggleDetail(state.quickOpenIncludeImages) },
    ),
    command('view.source', t('command.view.source'), [
      'source',
      'edit',
      'mode',
      '源码',
      '编辑',
      '模式',
    ]),
    command('view.wysiwyg', t('command.view.wysiwyg'), [
      'wysiwyg',
      'live',
      'preview',
      '实时',
      '所见即所得',
    ]),
    command('view.preview', t('command.view.preview'), [
      'preview',
      'read',
      '预览',
      '阅读',
    ]),
    command('view.side', t('command.view.side'), [
      'side',
      'split',
      'side by side',
      '分屏',
      '并排',
      '预览',
    ]),
    command(
      'view.togglePreview',
      t('command.view.togglePreview'),
      [
        'toggle',
        'switch',
        'live',
        'wysiwyg',
        'side',
        'split',
        '实时',
        '侧边',
        '并排',
        '切换',
        '预览',
      ],
    ),
    command(
      'view.toggleSidebar',
      t('command.view.toggleSidebar'),
      ['sidebar', 'panel', '侧边栏', '侧栏'],
      { detail: toggleDetail(state.sidebarVisible) },
    ),
    command('file.save', t('command.file.save'), ['save', '保存'], {
      detail: 'Ctrl/Cmd+S',
      disabled: !state.canEdit,
    }),
    command(
      'file.chooseFolder',
      t('command.file.chooseFolder'),
      ['folder', 'workspace', 'open', '文件夹', '笔记库', '工作区'],
    ),
    command(
      'markdown.createToc',
      t('command.markdown.createToc'),
      ['toc', 'table of contents', 'outline', '目录', '大纲'],
      { disabled: !state.canEdit },
    ),
  ];
}
