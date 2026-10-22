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

interface SourceMappedToken {
  map: [number, number] | null;
  nesting: number;
  attrSet(name: string, value: string): void;
}

function annotateSourceLine(token: SourceMappedToken): void {
  if (token.map && token.nesting !== -1) {
    token.attrSet('data-source-line', String(token.map[0] + 1));
  }
}

const originalRenderToken = markdown.renderer.renderToken.bind(markdown.renderer);
markdown.renderer.renderToken = (tokens, idx, options) => {
  annotateSourceLine(tokens[idx]);
  return originalRenderToken(tokens, idx, options);
};

const originalFenceRenderer = markdown.renderer.rules.fence;
markdown.renderer.rules.fence = (tokens, idx, options, env, self) => {
  annotateSourceLine(tokens[idx]);
  return originalFenceRenderer
    ? originalFenceRenderer(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
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
  token.attrSet('loading', 'lazy');
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

export function renderMarkdown(source: string): string {
  return markdown.render(source);
}
