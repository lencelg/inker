import MarkdownIt from 'markdown-it';
import type { StateCore, Token } from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import { headingSlug } from './anchors';
import {
  codeThemeById,
  DEFAULT_CODE_THEME,
  type CodeThemeId,
} from './codeThemes';
import { escapeHtml } from './codeRender';
import { highlightFenceHtml } from './shikiHighlighter';

const TRANSPARENT_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
});

markdown.use(taskLists, { enabled: true, label: false });

function inlineText(token: Token | undefined): string {
  if (!token) return '';
  if (!token.children?.length) return token.content;
  return token.children
    .map((child) => {
      if (child.type === 'image') {
        return child.content || child.attrGet('alt') || '';
      }
      return child.content;
    })
    .join('');
}

function inlineDisplayText(token: Token | undefined): string {
  if (!token) return '';
  if (!token.children?.length) return token.content;
  return token.children
    .map((child) => {
      if (
        child.type === 'html_inline' ||
        child.type === 'html_block'
      ) {
        return '';
      }
      if (
        child.type === 'softbreak' ||
        child.type === 'hardbreak'
      ) {
        return ' ';
      }
      if (child.type === 'image') {
        return child.content || String(child.attrGet('alt') ?? '');
      }
      return child.content;
    })
    .join('');
}

export interface MarkdownHeading {
  level: number;
  text: string;
  id: string;
  line?: number;
  column?: number;
}

export function extractMarkdownHeadings(
  source: string,
): MarkdownHeading[] {
  const tokens = markdown.parse(source, {});
  const headings: MarkdownHeading[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'heading_open') continue;
    const level = Number(token.tag.slice(1));
    if (!Number.isInteger(level) || level < 1 || level > 6) continue;
    headings.push({
      level,
      text: inlineDisplayText(tokens[index + 1])
        .replace(/\r?\n/g, ' ')
        .trim(),
      id: String(token.attrGet('id') ?? ''),
      line: token.map ? token.map[0] + 1 : 1,
      column: 1,
    });
  }
  return headings;
}

function addHeadingIds(state: StateCore): void {
  const used = new Map<string, number>();
  for (let index = 0; index < state.tokens.length; index += 1) {
    const token = state.tokens[index];
    if (token.type !== 'heading_open') continue;
    const base =
      headingSlug(inlineText(state.tokens[index + 1])) ||
      `section-${index + 1}`;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    token.attrSet('id', count === 0 ? base : `${base}-${count}`);
  }
}

markdown.core.ruler.push('heading_ids', addHeadingIds);

interface SourceMappedToken {
  map: [number, number] | null;
  nesting: number;
  attrSet(name: string, value: string): void;
}

function annotateSourceLine(token: SourceMappedToken): void {
  if (token.map && token.nesting !== -1) {
    const start = token.map[0] + 1;
    token.attrSet('data-source-line', String(start));
    token.attrSet(
      'data-source-line-end',
      String(Math.max(start, token.map[1])),
    );
  }
}

const originalRenderToken = markdown.renderer.renderToken.bind(markdown.renderer);
markdown.renderer.renderToken = (tokens, idx, options) => {
  annotateSourceLine(tokens[idx]);
  return originalRenderToken(tokens, idx, options);
};

markdown.renderer.rules.fence = (tokens, idx, _options, env) => {
  const token = tokens[idx];
  const sourceLine = token.map
    ? ` data-source-line="${token.map[0] + 1}" data-source-line-end="${Math.max(
        token.map[0] + 1,
        token.map[1],
      )}"`
    : '';
  const info = token.info.trim().split(/\s+/)[0] ?? '';
  if (info === 'mermaid') {
    const source = escapeHtml(token.content);
    return `<div class="mermaid-block"${sourceLine}><pre class="mermaid-source">${source}</pre></div>\n`;
  }

  const envData = env as
    | { codeHighlight?: boolean; codeTheme?: CodeThemeId }
    | undefined;
  const highlightEnabled = envData?.codeHighlight !== false;
  const displayLanguage = info || 'text';
  const fallback = escapeHtml(token.content);
  const highlighted = highlightEnabled
    ? highlightFenceHtml(
        token.content,
        info,
        codeThemeById(envData?.codeTheme ?? DEFAULT_CODE_THEME),
      )
    : null;

  const languageClass = displayLanguage
    ? ` class="language-${escapeHtml(displayLanguage)}"`
    : '';
  const badge = escapeHtml(displayLanguage || 'text');

  return `<div class="code-block"${sourceLine}><span class="code-language">${badge}</span><pre class="hljs"><code${languageClass}>${highlighted ?? fallback}</code></pre></div>\n`;
};

const originalCodeBlockRenderer = markdown.renderer.rules.code_block;
markdown.renderer.rules.code_block = (tokens, idx, options, env, self) => {
  annotateSourceLine(tokens[idx]);
  return originalCodeBlockRenderer
    ? originalCodeBlockRenderer(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
};

const defaultImageRenderer = markdown.renderer.rules.image;

markdown.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const source = String(token.attrGet('src') ?? '').trim();
  if (source && isLocalImageSource(source)) {
    // Local images are resolved through Tauri, so the raw path is kept in a
    // data attribute and a transparent placeholder avoids a broken request.
    token.attrSet('data-md-src', source);
    token.attrSet('src', TRANSPARENT_IMAGE);
  }
  token.attrSet('loading', 'eager');
  token.attrSet('decoding', 'async');

  if (defaultImageRenderer) {
    return defaultImageRenderer(tokens, idx, options, env, self);
  }
  return self.renderToken(tokens, idx, options);
};

export function isLocalImageSource(source: string): boolean {
  const value = source.trim();
  if (!value) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('//');
}

export interface RenderOptions {
  codeHighlight?: boolean;
  codeTheme?: CodeThemeId;
}

export function renderMarkdown(
  source: string,
  options: RenderOptions = {},
): string {
  return markdown.render(source, {
    codeHighlight: options.codeHighlight !== false,
    codeTheme: options.codeTheme ?? DEFAULT_CODE_THEME,
  });
}
