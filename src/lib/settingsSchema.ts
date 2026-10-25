import type { Preferences } from './preferences';
import { FONTS } from './fonts';
import {
  CODE_THEMES,
  DEFAULT_CODE_THEME,
} from './codeThemes';
import { THEMES } from './themes';

export type SettingsCategoryId = 'common' | 'editor' | 'preview' | 'export';
export type SettingsScope = 'user' | 'workspace';
export type SettingsControlType = 'input' | 'select' | 'checkbox';
export type SettingsValue = string | number | boolean;

export interface SettingsOption {
  label: string;
  value: string;
}

export interface SettingsHint {
  text: string;
  linkLabel?: string;
  action?: 'reset';
}

export interface SettingDefinition {
  id: string;
  category: SettingsCategoryId;
  title: string;
  description: string;
  controlType: SettingsControlType;
  value: SettingsValue;
  defaultValue: SettingsValue;
  options?: SettingsOption[];
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  keywords?: string[];
  hint?: SettingsHint;
  preference?: keyof Preferences;
}

export interface SettingsCategory {
  id: SettingsCategoryId;
  label: string;
  description: string;
  icon: 'settings' | 'editor' | 'preview' | 'export';
}

export interface SettingsSection extends SettingsCategory {
  items: SettingDefinition[];
}

interface SettingTemplate
  extends Omit<SettingDefinition, 'value' | 'defaultValue'> {
  defaultValue: SettingsValue;
}

export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  {
    id: 'common',
    label: '常用设置',
    description: '经常调整的设置项会集中显示在这里。',
    icon: 'settings',
  },
  {
    id: 'editor',
    label: '文本编辑器',
    description: '控制源代码编辑器的字体、键位和写作体验。',
    icon: 'editor',
  },
  {
    id: 'preview',
    label: '预览',
    description: '控制 Markdown 实时预览的渲染方式。',
    icon: 'preview',
  },
  {
    id: 'export',
    label: '导出',
    description: '配置分享笔记时使用的默认导出选项。',
    icon: 'export',
  },
];

const THEME_OPTIONS: SettingsOption[] = THEMES.map((theme) => ({
  label: theme.label,
  value: theme.id,
}));

const FONT_OPTIONS: SettingsOption[] = FONTS.map((font) => ({
  label: font.label,
  value: font.id,
}));

const CODE_THEME_OPTIONS: SettingsOption[] = CODE_THEMES.map(
  (theme) => ({
    label: theme.label,
    value: theme.id,
  }),
);

const EXPORT_OPTIONS: SettingsOption[] = [
  { label: 'PDF（打印）', value: 'pdf' },
  { label: 'HTML 网页', value: 'html' },
  { label: 'Word (.docx)', value: 'docx' },
];

const SETTING_TEMPLATES: readonly SettingTemplate[] = [
  {
    id: 'workbench.colorTheme',
    category: 'common',
    title: 'Workbench: Color Theme',
    description: '指定界面、编辑器和预览区域使用的颜色主题。',
    controlType: 'select',
    defaultValue: 'paper',
    options: THEME_OPTIONS,
    keywords: ['主题', '颜色', '配色', '外观', 'theme', 'color'],
    preference: 'theme',
    hint: {
      text: '主题切换会立即应用到整个工作台，并保存在本机。',
      linkLabel: '恢复默认主题',
      action: 'reset',
    },
  },
  {
    id: 'editor.fontSize',
    category: 'common',
    title: 'Editor: Font Size',
    description: '控制编辑器字体大小（像素）。',
    controlType: 'input',
    defaultValue: 15,
    min: 11,
    max: 28,
    step: 1,
    suffix: 'px',
    keywords: ['字体', '字号', '大小', '缩放', 'font', 'size'],
    preference: 'fontSize',
    hint: {
      text: '也可以按住 Ctrl 并滚动鼠标滚轮快速调整。',
      linkLabel: '重置为默认值',
      action: 'reset',
    },
  },
  {
    id: 'editor.immersive',
    category: 'common',
    title: 'Editor: Immersive Writing',
    description: '保持当前行居中并淡化其他内容，减少视觉干扰。',
    controlType: 'checkbox',
    defaultValue: false,
    keywords: ['沉浸', '写作', '打字机', '居中', '专注', 'immersive'],
    preference: 'immersive',
    hint: {
      text: '该选项会同时作用于源代码和实时预览两种编辑模式。',
    },
  },
  {
    id: 'editor.fontFamily',
    category: 'editor',
    title: 'Editor: Font Family',
    description: '控制编辑器、标签页和文件树使用的等宽字体。',
    controlType: 'select',
    defaultValue: 'jetbrains-mono',
    options: FONT_OPTIONS,
    keywords: ['字体', 'font', 'family', '等宽', 'jetbrains', 'fira'],
    preference: 'fontFamily',
    hint: {
      text: '字体列表来自本机已安装并随应用打包的字体。',
      linkLabel: '恢复默认字体',
      action: 'reset',
    },
  },
  {
    id: 'editor.vimMode',
    category: 'editor',
    title: 'Editor: Vim Mode',
    description: '启用 Vim 键位，支持 Normal、Insert、搜索、替换和宏。',
    controlType: 'checkbox',
    defaultValue: false,
    keywords: ['vim', '键位', '键盘', '模式', 'normal', 'insert'],
    preference: 'vimEnabled',
    hint: {
      text: 'Vim 模式仅影响源代码编辑器，实时预览保持标准输入。',
    },
  },
  {
    id: 'editor.sourceHighlight',
    category: 'editor',
    title: 'Editor: Code Block Highlight',
    description: '控制源码模式中围栏代码块的语法高亮。',
    controlType: 'checkbox',
    defaultValue: true,
    keywords: ['源码', '代码块', '语法', '高亮', 'source', 'code', 'syntax'],
    preference: 'sourceHighlight',
    hint: {
      text: '关闭后仅代码块显示为单色，Markdown 语法高亮不受影响。',
    },
  },
  {
    id: 'preview.codeHighlight',
    category: 'preview',
    title: 'Preview: Code Highlight',
    description: '为预览和实时预览中的代码块启用语法高亮。',
    controlType: 'checkbox',
    defaultValue: true,
    keywords: ['预览', '代码', '高亮', '语言', 'highlight', 'code'],
    preference: 'codeHighlight',
    hint: {
      text: '关闭后代码块会使用纯文本样式，预览中的语言标识也会隐藏。',
    },
  },
  {
    id: 'preview.codeTheme',
    category: 'preview',
    title: 'Preview: Code Highlight Theme',
    description: '选择预览和实时预览中的代码语法配色主题。',
    controlType: 'select',
    defaultValue: DEFAULT_CODE_THEME,
    options: CODE_THEME_OPTIONS,
    keywords: [
      '预览',
      '代码',
      '主题',
      '高亮',
      '配色',
      'theme',
      'syntax',
      'highlight',
    ],
    preference: 'codeTheme',
    hint: {
      text: '切换后会立即应用到已经打开的预览内容。',
    },
  },
  {
    id: 'export.defaultFormat',
    category: 'export',
    title: 'Export: Default Format',
    description: '选择分享笔记时默认使用的导出格式。',
    controlType: 'select',
    defaultValue: 'pdf',
    options: EXPORT_OPTIONS,
    keywords: ['导出', '格式', 'pdf', 'html', 'word', 'docx'],
    hint: {
      text: '顶部导出菜单仍可临时选择其他格式。',
    },
  },
  {
    id: 'export.includeImages',
    category: 'export',
    title: 'Export: Include Local Images',
    description: '将笔记中引用的本地图片嵌入导出文件，便于单独分享。',
    controlType: 'checkbox',
    defaultValue: true,
    keywords: ['导出', '图片', '附件', 'image', 'assets', '嵌入'],
    hint: {
      text: '图片会转换为内嵌资源，避免移动文件后无法显示。',
    },
  },
  {
    id: 'export.openAfterExport',
    category: 'export',
    title: 'Export: Open After Save',
    description: '导出完成后使用系统默认应用打开生成的文件。',
    controlType: 'checkbox',
    defaultValue: false,
    keywords: ['导出', '打开', '文件', 'open', 'save'],
    hint: {
      text: '文件仍会先通过系统保存对话框写入你选择的位置。',
    },
  },
];

export function createSettingsSchema(
  preferences: Preferences,
  localValues: Record<string, SettingsValue> = {},
): SettingDefinition[] {
  return SETTING_TEMPLATES.map((template) => {
    const value = template.preference
      ? (preferences[template.preference] as SettingsValue)
      : (localValues[template.id] ?? template.defaultValue);

    return {
      ...template,
      value,
      defaultValue: template.defaultValue,
    };
  });
}

export function isSettingModified(setting: SettingDefinition): boolean {
  return setting.value !== setting.defaultValue;
}

export function matchesSetting(
  setting: SettingDefinition,
  query: string,
): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;

  const haystack = [
    setting.title,
    setting.description,
    setting.hint?.text ?? '',
    ...(setting.keywords ?? []),
  ]
    .join(' ')
    .toLocaleLowerCase();

  return haystack.includes(normalized);
}
