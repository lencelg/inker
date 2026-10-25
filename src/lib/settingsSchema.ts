import type { Preferences } from './preferences';
import { FONTS, fontLabel } from './fonts';
import {
  DEFAULT_CODE_THEME,
  allCodeThemes,
} from './codeThemes';
import {
  DEFAULT_THEME,
  allThemes,
} from './themes';
import {
  LANGUAGE_OPTIONS,
  t,
  type TranslationKey,
} from './i18n';

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
  themeImport?: 'ui' | 'code';
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

export function settingsCategories(): SettingsCategory[] {
  return [
    {
      id: 'common',
      label: t('settings.category.common.label'),
      description: t('settings.category.common.description'),
      icon: 'settings',
    },
    {
      id: 'editor',
      label: t('settings.category.editor.label'),
      description: t('settings.category.editor.description'),
      icon: 'editor',
    },
    {
      id: 'preview',
      label: t('settings.category.preview.label'),
      description: t('settings.category.preview.description'),
      icon: 'preview',
    },
    {
      id: 'export',
      label: t('settings.category.export.label'),
      description: t('settings.category.export.description'),
      icon: 'export',
    },
  ];
}

function fontOptions(): SettingsOption[] {
  return FONTS.map((font) => ({
    label: fontLabel(font),
    value: font.id,
  }));
}

function settingTemplates(): SettingTemplate[] {
  return [
    {
      id: 'workbench.language',
      category: 'common',
      title: 'Workbench: Display Language',
      description: t('settings.language.description'),
      controlType: 'select',
      defaultValue: 'system',
      keywords: [
        '语言',
        '显示语言',
        '中文',
        '英文',
        'language',
        'locale',
        'english',
        'chinese',
      ],
      preference: 'language',
    },
    {
      id: 'workbench.colorTheme',
      category: 'common',
      title: 'Workbench: Color Theme',
      description: t('settings.colorTheme.description'),
      controlType: 'select',
      defaultValue: DEFAULT_THEME,
      keywords: ['主题', '颜色', '配色', '外观', 'theme', 'color'],
      preference: 'theme',
      themeImport: 'ui',
      hint: {
        text: t('settings.colorTheme.hint'),
        linkLabel: t('settings.colorTheme.reset'),
        action: 'reset',
      },
    },
    {
      id: 'editor.fontSize',
      category: 'common',
      title: 'Editor: Font Size',
      description: t('settings.fontSize.description'),
      controlType: 'input',
      defaultValue: 15,
      min: 11,
      max: 28,
      step: 1,
      suffix: 'px',
      keywords: ['字体', '字号', '大小', '缩放', 'font', 'size'],
      preference: 'fontSize',
      hint: {
        text: t('settings.fontSize.hint'),
        linkLabel: t('settings.fontSize.reset'),
        action: 'reset',
      },
    },
    {
      id: 'editor.immersive',
      category: 'common',
      title: 'Editor: Immersive Writing',
      description: t('settings.immersive.description'),
      controlType: 'checkbox',
      defaultValue: false,
      keywords: [
        '沉浸',
        '写作',
        '打字机',
        '居中',
        '专注',
        'immersive',
        'focus',
      ],
      preference: 'immersive',
      hint: {
        text: t('settings.immersive.hint'),
      },
    },
    {
      id: 'editor.fontFamily',
      category: 'editor',
      title: 'Editor: Font Family',
      description: t('settings.fontFamily.description'),
      controlType: 'select',
      defaultValue: 'jetbrains-mono',
      options: fontOptions(),
      keywords: ['字体', 'font', 'family', '等宽', 'jetbrains', 'fira'],
      preference: 'fontFamily',
      hint: {
        text: t('settings.fontFamily.hint'),
        linkLabel: t('settings.fontFamily.reset'),
        action: 'reset',
      },
    },
    {
      id: 'editor.vimMode',
      category: 'editor',
      title: 'Editor: Vim Mode',
      description: t('settings.vim.description'),
      controlType: 'checkbox',
      defaultValue: false,
      keywords: ['vim', '键位', '键盘', '模式', 'normal', 'insert'],
      preference: 'vimEnabled',
      hint: {
        text: t('settings.vim.hint'),
      },
    },
    {
      id: 'editor.sourceHighlight',
      category: 'editor',
      title: 'Editor: Code Block Highlight',
      description: t('settings.sourceHighlight.description'),
      controlType: 'checkbox',
      defaultValue: true,
      keywords: [
        '源码',
        '代码块',
        '语法',
        '高亮',
        'source',
        'code',
        'syntax',
        'highlight',
      ],
      preference: 'sourceHighlight',
      hint: {
        text: t('settings.sourceHighlight.hint'),
      },
    },
    {
      id: 'preview.codeHighlight',
      category: 'preview',
      title: 'Preview: Code Highlight',
      description: t('settings.codeHighlight.description'),
      controlType: 'checkbox',
      defaultValue: true,
      keywords: [
        '预览',
        '代码',
        '高亮',
        '语言',
        'highlight',
        'code',
        'preview',
      ],
      preference: 'codeHighlight',
      hint: {
        text: t('settings.codeHighlight.hint'),
      },
    },
    {
      id: 'preview.codeTheme',
      category: 'preview',
      title: 'Preview: Code Highlight Theme',
      description: t('settings.codeTheme.description'),
      controlType: 'select',
      defaultValue: DEFAULT_CODE_THEME,
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
      themeImport: 'code',
    },
    {
      id: 'export.includeImages',
      category: 'export',
      title: 'Export: Embed Local Images',
      description: t('settings.includeImages.description'),
      controlType: 'checkbox',
      defaultValue: true,
      keywords: ['导出', '图片', '附件', 'image', 'assets', '嵌入'],
      preference: 'exportEmbedImages',
      hint: {
        text: t('settings.includeImages.hint'),
      },
    },
    {
      id: 'export.includeToc',
      category: 'export',
      title: 'Export: Table of Contents',
      description: t('settings.includeToc.description'),
      controlType: 'checkbox',
      defaultValue: true,
      keywords: ['导出', '目录', 'toc', 'contents', 'heading'],
      preference: 'exportIncludeToc',
      hint: {
        text: t('settings.includeToc.hint'),
      },
    },
    {
      id: 'export.openAfterExport',
      category: 'export',
      title: 'Export: Open After Save',
      description: t('settings.openAfterExport.description'),
      controlType: 'checkbox',
      defaultValue: false,
      keywords: ['导出', '打开', '文件', 'open', 'save'],
      preference: 'exportOpenAfter',
    },
  ];
}

export function createSettingsSchema(
  preferences: Preferences,
  localValues: Record<string, SettingsValue> = {},
): SettingDefinition[] {
  const themeOptions: SettingsOption[] = allThemes().map((theme) => ({
    label: theme.label,
    value: theme.id,
  }));
  const codeThemeOptions: SettingsOption[] = allCodeThemes().map(
    (theme) => ({
      label: theme.label,
      value: theme.id,
    }),
  );
  const languageOptions: SettingsOption[] = LANGUAGE_OPTIONS.map(
    (option) => ({
      label: t(option.label as TranslationKey),
      value: option.id,
    }),
  );

  return settingTemplates().map((template) => {
    const value = template.preference
      ? (preferences[template.preference] as SettingsValue)
      : (localValues[template.id] ?? template.defaultValue);
    const options =
      template.id === 'workbench.colorTheme'
        ? themeOptions
        : template.id === 'preview.codeTheme'
          ? codeThemeOptions
          : template.id === 'workbench.language'
            ? languageOptions
            : template.options;

    return {
      ...template,
      value,
      defaultValue: template.defaultValue,
      options,
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
