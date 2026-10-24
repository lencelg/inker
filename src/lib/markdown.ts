import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github-dark.css';
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

const TRANSPARENT_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
});

markdown.use(taskLists, { enabled: true, label: false });

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

  const highlightEnabled =
    (env as { codeHighlight?: boolean } | undefined)?.codeHighlight !==
    false;
  const knownLanguage = info ? hljs.getLanguage(info) : undefined;
  let highlighted: { value: string; language?: string } = {
    value: escapeHtml(token.content),
  };
  let displayLanguage = info || 'text';

  if (highlightEnabled) {
    if (knownLanguage) {
      highlighted = {
        value: hljs.highlight(token.content, {
          language: info,
          ignoreIllegals: true,
        }).value,
        language: info,
      };
    } else {
      const detected = hljs.highlightAuto(token.content);
      highlighted = {
        value: detected.value,
        language: detected.language,
      };
      displayLanguage = info || detected.language || 'text';
    }
  }

  const languageClass = displayLanguage
    ? ` class="language-${escapeHtml(displayLanguage)}"`
    : '';
  const badge = escapeHtml(displayLanguage || 'text');

  return `<div class="code-block"${sourceLine}><span class="code-language">${badge}</span><pre class="hljs"><code${languageClass}>${highlighted.value}</code></pre></div>\n`;
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
}

export function renderMarkdown(
  source: string,
  options: RenderOptions = {},
): string {
  return markdown.render(source, {
    codeHighlight: options.codeHighlight !== false,
  });
}
