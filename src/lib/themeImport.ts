import { isBuiltInThemeId, type BuiltInThemeId } from './themes';

export const MAX_THEME_FILE_BYTES = 256 * 1024;

export const UI_THEME_COLOR_TOKENS = [
  '--bg',
  '--bg-soft',
  '--panel',
  '--ink',
  '--muted',
  '--faint',
  '--border',
  '--accent',
  '--accent-strong',
  '--accent-soft',
  '--leaf',
  '--leaf-strong',
  '--warning',
  '--warning-soft',
  '--error',
  '--error-soft',
  '--error-border',
  '--success',
  '--success-soft',
  '--draft-soft',
  '--body-glow',
  '--sidebar-bg',
  '--overlay',
  '--hover',
  '--hover-strong',
  '--btn-hover-bg',
  '--btn-hover-border',
  '--primary-bg',
  '--primary-bg-hover',
  '--primary-ink',
  '--danger-bg',
  '--danger-bg-hover',
  '--danger-ink',
  '--blockquote-border',
  '--code-inline-bg',
  '--editor-active-line',
  '--editor-active-line-gutter',
  '--editor-selection',
  '--focus-ring',
  '--folder-icon',
  '--activity-bg',
  '--activity-icon',
  '--activity-icon-hover',
  '--activity-icon-active',
  '--activity-active-bg',
  '--activity-hover',
  '--statusbar-bg',
  '--statusbar-ink',
  '--statusbar-muted',
  '--statusbar-hover',
  '--statusbar-border',
  '--statusbar-border-soft',
  '--syntax-keyword',
  '--syntax-string',
  '--syntax-comment',
  '--syntax-number',
  '--syntax-type',
  '--syntax-function',
  '--syntax-variable',
  '--syntax-operator',
  '--syntax-tag',
  '--syntax-heading',
  '--syntax-link',
  '--syntax-quote',
  '--syntax-invalid',
] as const;

const UI_THEME_TOKEN_SET = new Set<string>(UI_THEME_COLOR_TOKENS);
const UNSAFE_CSS_VALUE = /url\s*\(|@import|expression\s*\(|javascript:/i;
const UNSAFE_CSS_COLOR =
  /var\s*\(|currentColor|inherit|initial|unset|revert/i;
const CODE_THEME_PROPERTIES = [
  'color',
  'background-color',
  'font-style',
  'font-weight',
  'text-decoration',
  'text-decoration-color',
  'opacity',
] as const;

export interface ParsedUiTheme {
  name: string;
  base: BuiltInThemeId;
  colors: Record<string, string>;
}

export interface ParsedCodeTheme {
  name: string;
  background: string;
  foreground: string;
  css: string;
}

function checkFileSize(text: string): void {
  if (new TextEncoder().encode(text).length > MAX_THEME_FILE_BYTES) {
    throw new Error('主题文件过大（最大 256 KB）');
  }
}

function isCssColor(value: string): boolean {
  const candidate = value.trim();
  if (
    !candidate ||
    UNSAFE_CSS_VALUE.test(candidate) ||
    UNSAFE_CSS_COLOR.test(candidate)
  ) {
    return false;
  }
  const probe = document.createElement('span');
  probe.style.color = '';
  probe.style.color = candidate;
  return probe.style.color !== '';
}

function themeName(value: string, fallback: string): string {
  const name = value.trim() || fallback;
  if (!name) throw new Error('主题名称不能为空');
  if (name.length > 60) throw new Error('主题名称不能超过 60 个字符');
  return name;
}

export function parseUiThemeFile(text: string): ParsedUiTheme {
  checkFileSize(text);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('界面主题必须是有效的 JSON 文件');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('界面主题 JSON 格式无效');
  }

  const source = raw as {
    version?: unknown;
    name?: unknown;
    base?: unknown;
    colors?: unknown;
  };
  if (
    source.version !== undefined &&
    source.version !== 1
  ) {
    throw new Error('不支持的界面主题版本');
  }
  if (typeof source.name !== 'string') {
    throw new Error('界面主题缺少 name 字段');
  }
  if (!isBuiltInThemeId(source.base)) {
    throw new Error('界面主题的 base 必须是内置主题 ID');
  }
  if (
    !source.colors ||
    typeof source.colors !== 'object' ||
    Array.isArray(source.colors)
  ) {
    throw new Error('界面主题缺少 colors 对象');
  }

  const colors: Record<string, string> = {};
  for (const [key, value] of Object.entries(source.colors)) {
    if (!UI_THEME_TOKEN_SET.has(key)) {
      throw new Error(`不支持的界面主题变量：${key}`);
    }
    if (typeof value !== 'string' || !isCssColor(value)) {
      throw new Error(`变量 ${key} 的颜色值无效`);
    }
    colors[key] = value.trim();
  }
  if (Object.keys(colors).length === 0) {
    throw new Error('界面主题至少需要提供一个颜色变量');
  }

  return {
    name: themeName(source.name, ''),
    base: source.base,
    colors,
  };
}

export function parseCodeThemeFile(
  text: string,
  fileName: string,
): ParsedCodeTheme {
  checkFileSize(text);
  if (UNSAFE_CSS_VALUE.test(text)) {
    throw new Error('代码主题不能包含 @import、url() 或其他外部资源');
  }

  const style = document.createElement('style');
  style.textContent = text;
  document.head.append(style);

  try {
    const sheet = style.sheet;
    if (!sheet) throw new Error('无法解析代码主题 CSS');

    const cssParts: string[] = [];
    let background = '';
    let foreground = '';

    for (const rule of Array.from(sheet.cssRules)) {
      if (
        !('selectorText' in rule) ||
        !('style' in rule)
      ) {
        continue;
      }

      const ruleStyle = (rule as CSSStyleRule).style;
      const selectors = (rule as CSSStyleRule).selectorText
        .split(',')
        .map((selector: string) => selector.trim())
        .filter((selector: string) => selector.startsWith('.hljs'));
      if (selectors.length === 0) continue;

      if (selectors.includes('.hljs')) {
        const nextBackground =
          ruleStyle.getPropertyValue('background-color') ||
          ruleStyle.getPropertyValue('background');
        const nextForeground = ruleStyle.getPropertyValue('color');
        if (nextBackground && isCssColor(nextBackground)) {
          background = nextBackground;
        }
        if (nextForeground && isCssColor(nextForeground)) {
          foreground = nextForeground;
        }
      }

      const declarations = CODE_THEME_PROPERTIES.map((property) => {
        const value = ruleStyle.getPropertyValue(property);
        if (!value || UNSAFE_CSS_VALUE.test(value)) return '';
        return `${property}: ${value};`;
      })
        .filter(Boolean)
        .join(' ');
      if (declarations) {
        cssParts.push(
          `${selectors.join(', ')} { ${declarations} }`,
        );
      }
    }

    if (!background || !foreground) {
      throw new Error(
        '代码主题的 .hljs 规则必须定义 background 和 color',
      );
    }
    if (cssParts.length === 0) {
      throw new Error('没有找到可用的 highlight.js 样式规则');
    }

    const fallback = fileName
      .replace(/\.css$/i, '')
      .replace(/\.min$/i, '')
      .trim();
    return {
      name: themeName('', fallback || 'Custom Code Theme'),
      background,
      foreground,
      css: cssParts.join('\n'),
    };
  } finally {
    style.remove();
  }
}
