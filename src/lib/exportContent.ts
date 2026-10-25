import DOMPurify from 'dompurify';
import renderMathInElement from 'katex/contrib/auto-render';
import { save } from '@tauri-apps/plugin-dialog';
import { api } from '../api';
import {
  DEFAULT_CODE_THEME,
  codeThemeById,
  type CodeThemeId,
} from './codeThemes';
import { getLanguage, t } from './i18n';
import { isLocalImageSource, renderMarkdown } from './markdown';
import { renderMermaid } from './mermaid';
import { basename } from './paths';

export interface PreparedExport {
  title: string;
  container: HTMLElement;
  contentHtml: string;
  documentHtml: string;
  warnings: string[];
}

export interface ExportOptions {
  codeHighlight?: boolean;
  embedImages?: boolean;
  codeTheme?: CodeThemeId;
  includeToc?: boolean;
}

export interface SaveHtmlOptions {
  defaultDirectory?: string;
}

export interface SaveDocxOptions {
  codeTheme?: CodeThemeId;
  includeToc?: boolean;
}

const MAX_REMOTE_IMAGE_BYTES = 20 * 1024 * 1024;
const REMOTE_IMAGE = /^(?:https?:)?\/\//i;

const EXPORT_CSS = `
:root {
  color-scheme: light;
  --ink: #1f2933;
  --muted: #57606a;
  --border: #d8dee4;
  --inline-code-bg: #f6f8fa;
  --inline-code-fg: #1f2933;
  --accent: #0969da;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  color: var(--ink);
  font-family: 'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.export-body {
  max-width: 880px;
  margin: 0 auto;
  padding: 48px 28px 64px;
  font-size: 16px;
  line-height: 1.75;
  overflow-wrap: break-word;
}
.export-body > :first-child { margin-top: 0; }
.export-body h1, .export-body h2, .export-body h3,
.export-body h4, .export-body h5, .export-body h6 {
  margin: 1.5em 0 0.6em;
  line-height: 1.3;
  letter-spacing: -0.01em;
}
.export-body h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border); }
.export-body h2 { font-size: 1.5em; padding-bottom: 0.2em; border-bottom: 1px solid var(--border); }
.export-body h3 { font-size: 1.25em; }
.export-body p { margin: 0.8em 0; }
.export-body a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
.export-body ul, .export-body ol { margin: 0.6em 0; padding-left: 1.6em; }
.export-body li { margin: 0.25em 0; }
.export-body li[data-item-type='task'] { list-style: none; }
.export-body blockquote {
  margin: 1em 0;
  padding: 0.2em 0 0.2em 1em;
  border-left: 3px solid var(--border);
  color: var(--muted);
}
.export-body hr { margin: 1.6em 0; border: 0; border-top: 1px solid var(--border); }
.export-body code {
  padding: 0.15em 0.35em;
  border-radius: 4px;
  background: var(--inline-code-bg);
  color: var(--inline-code-fg);
  font-family: var(--mono);
  font-size: 0.9em;
}
.export-body .code-block { margin: 1em 0; }
.export-body .code-language {
  display: inline-block;
  margin: 0 0 4px;
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--code-bg);
  color: var(--code-fg);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  line-height: 1.5;
  text-transform: uppercase;
  opacity: 0.8;
}
.export-body pre {
  margin: 1em 0;
  padding: 14px 16px;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--code-bg);
  color: var(--code-fg);
  font-family: var(--mono);
  font-size: 0.88em;
  line-height: 1.6;
  white-space: pre;
}
.export-body .code-block pre { margin: 0; }
.export-body pre code { padding: 0; background: transparent; color: inherit; font-size: inherit; }
.export-body table { width: 100%; margin: 1em 0; border-collapse: collapse; font-size: 0.94em; }
.export-body th, .export-body td { padding: 7px 10px; border: 1px solid var(--border); text-align: left; vertical-align: top; }
.export-body th { background: var(--inline-code-bg); }
.export-body img { max-width: 100%; height: auto; border-radius: 6px; }
.export-body .mermaid-block {
  margin: 1.2em 0;
  padding: 14px;
  overflow-x: auto;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  text-align: center;
}
.export-body .mermaid-block svg { max-width: 100%; height: auto; }
.export-body .mermaid-source { border: 0; background: transparent; text-align: left; }
.export-body .mermaid-error { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
.export-body input[type='checkbox'] { margin-right: 0.4em; vertical-align: middle; }
.export-body img.md-image-loading, .export-body img.md-image-missing {
  min-width: 120px; min-height: 36px; background: var(--inline-code-bg);
}
.export-body .page-break { height: 0; margin: 0; break-after: page; page-break-after: always; }
.export-body .export-toc {
  margin: 1.4em 0;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fbfcfd;
}
.export-body .export-toc-title {
  margin: 0 0 8px;
  font-size: 0.92em;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.export-body .export-toc ul { margin: 0; padding-left: 1.2em; }
.export-body .export-toc li { margin: 0.18em 0; }
.export-body .export-toc a { color: var(--ink); text-decoration: none; }
@media print {
  body { background: #fff; }
  .export-body { max-width: none; padding: 0; }
  .export-body a { color: inherit; text-decoration: none; }
  .export-body pre, .export-body table, .export-body blockquote,
  .export-body img, .export-body .mermaid-block, .export-body .export-toc {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .export-body tr { break-inside: avoid; page-break-inside: avoid; }
  .export-body thead { display: table-header-group; }
  .export-body h1, .export-body h2, .export-body h3, .export-body h4 {
    break-after: avoid;
    page-break-after: avoid;
  }
  .export-body p { orphans: 3; widows: 3; }
  .export-body .code-language { break-after: avoid; page-break-after: avoid; }
}
@page { margin: 18mm 16mm; }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function exportTitle(notePath: string): string {
  return basename(notePath).replace(/\.(md|markdown)$/i, '') || 'note';
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '-').trim() || 'note';
}

function dataUrl(mime: string, data: string): string {
  return `data:${mime};base64,${data}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + chunk),
    );
  }
  return window.btoa(binary);
}

async function fetchRemoteAsset(source: string): Promise<{
  mime: string;
  data: string;
}> {
  const url = source.startsWith('//') ? `https:${source}` : source;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const mime = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!mime.startsWith('image/')) {
      throw new Error('Not an image');
    }
    const blob = await response.blob();
    if (blob.size > MAX_REMOTE_IMAGE_BYTES) {
      throw new Error('Image too large');
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { mime, data: bytesToBase64(bytes) };
  } finally {
    window.clearTimeout(timer);
  }
}

function replaceMissingImage(
  image: HTMLImageElement,
  source: string,
  warnings: string[],
): void {
  const placeholder = document.createElement('span');
  placeholder.className = 'md-image-missing';
  placeholder.textContent = t('preview.imageMissing', {
    alt: image.alt || t('preview.imageFallback'),
  });
  image.replaceWith(placeholder);
  warnings.push(t('export.warning.image', { source }));
}

async function decodeImage(image: HTMLImageElement): Promise<void> {
  try {
    await image.decode();
  } catch {
    // Broken or remote images keep their fallback size.
  }
}

async function resolveExportImages(
  container: HTMLElement,
  notePath: string,
  embed: boolean,
  warnings: string[],
): Promise<void> {
  const images = Array.from(
    container.querySelectorAll<HTMLImageElement>('img'),
  );
  const remoteCache = new Map<
    string,
    { mime: string; data: string } | null
  >();

  await Promise.all(
    images.map(async (image) => {
      let source =
        image.dataset.mdSrc?.trim() ??
        image.getAttribute('src')?.trim() ??
        '';
      image.removeAttribute('data-md-src');
      if (!source) return;

      image.loading = 'eager';
      image.decoding = 'async';

      if (!embed) {
        image.src = source;
        return;
      }

      if (source.startsWith('data:')) {
        image.src = source;
        await decodeImage(image);
        return;
      }

      if (REMOTE_IMAGE.test(source)) {
        const cacheKey = source.startsWith('//')
          ? `https:${source}`
          : source;
        let asset = remoteCache.get(cacheKey);
        if (asset === undefined) {
          try {
            asset = await fetchRemoteAsset(source);
          } catch {
            asset = null;
          }
          remoteCache.set(cacheKey, asset);
        }
        if (asset) {
          image.src = dataUrl(asset.mime, asset.data);
        } else {
          image.src = source;
          warnings.push(
            t('export.warning.remoteImage', { url: source }),
          );
        }
        await decodeImage(image);
        return;
      }

      if (isLocalImageSource(source)) {
        try {
          const asset = await api.readAsset(notePath, source);
          image.src = dataUrl(asset.mime, asset.data);
        } catch {
          replaceMissingImage(image, source, warnings);
          return;
        }
      } else {
        image.src = source;
      }
      await decodeImage(image);
    }),
  );
}

async function renderExportDiagrams(
  container: HTMLElement,
  warnings: string[],
): Promise<void> {
  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>('.mermaid-block'),
  );
  await Promise.all(
    blocks.map(async (block) => {
      const source =
        block.querySelector('.mermaid-source')?.textContent ?? '';
      if (!source.trim()) return;
      try {
        block.innerHTML = await renderMermaid(source);
        block.classList.add('mermaid-rendered');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        block.classList.add('mermaid-error');
        block.textContent = t('preview.mermaidFailed', { message });
        warnings.push(t('export.warning.mermaid', { message }));
      }
    }),
  );
}

function applyPageBreaks(container: HTMLElement): void {
  for (const paragraph of Array.from(
    container.querySelectorAll('p'),
  )) {
    const text = paragraph.textContent?.trim() ?? '';
    if (text !== '\\pagebreak' && text !== '\\newpage') continue;
    const breakElement = document.createElement('div');
    breakElement.className = 'page-break';
    paragraph.replaceWith(breakElement);
  }
}

function addTableOfContents(
  container: HTMLElement,
  language: 'zh' | 'en',
): void {
  const headings = Array.from(
    container.querySelectorAll<HTMLElement>('h1, h2, h3, h4'),
  ).filter((heading) => heading.id);
  if (headings.length < 2) return;

  const nav = document.createElement('nav');
  nav.className = 'export-toc';
  const title = document.createElement('p');
  title.className = 'export-toc-title';
  title.textContent = t('export.contents');
  nav.append(title);

  const root = document.createElement('ul');
  for (const heading of headings) {
    const level = Number(heading.tagName.slice(1));
    const item = document.createElement('li');
    item.style.marginLeft = `${Math.max(0, level - 1) * 12}px`;
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent?.trim() ?? '';
    item.append(link);
    root.append(item);
  }
  nav.append(root);

  const firstHeading = container.querySelector('h1');
  if (firstHeading) {
    firstHeading.after(nav);
  } else {
    container.prepend(nav);
  }
  container.dataset.exportToc = 'true';
  if (language === 'zh') container.lang = 'zh-CN';
}

export async function prepareExport(
  notePath: string,
  markdownSource: string,
  options: ExportOptions = {},
): Promise<PreparedExport> {
  const container = document.createElement('div');
  container.className = 'markdown-body export-body';
  container.innerHTML = DOMPurify.sanitize(
    renderMarkdown(markdownSource, {
      codeHighlight: options.codeHighlight !== false,
    }),
    {
      ADD_ATTR: [
        'data-md-src',
        'data-source-line',
        'data-source-line-end',
        'style',
        'colspan',
        'rowspan',
        'align',
        'valign',
        'width',
        'height',
        'cellpadding',
        'cellspacing',
        'border',
        'bgcolor',
      ],
      ADD_TAGS: [
        'table',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'th',
        'td',
        'caption',
        'colgroup',
        'col',
      ],
    },
  );

  renderMathInElement(container, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
      { left: '$', right: '$', display: false },
    ],
    throwOnError: false,
    output: 'mathml',
    ignoredTags: [
      'script',
      'noscript',
      'style',
      'textarea',
      'pre',
      'code',
      'option',
    ],
  });

  const warnings: string[] = [];
  await resolveExportImages(
    container,
    notePath,
    options.embedImages !== false,
    warnings,
  );
  await renderExportDiagrams(container, warnings);
  applyPageBreaks(container);

  const language = getLanguage();
  if (options.includeToc) {
    addTableOfContents(container, language);
  }

  for (const element of container.querySelectorAll(
    '[data-source-line], [data-source-line-end]',
  )) {
    element.removeAttribute('data-source-line');
    element.removeAttribute('data-source-line-end');
  }

  const firstHeading = container
    .querySelector('h1')
    ?.textContent?.trim();
  const title =
    (firstHeading && firstHeading.length > 0
      ? firstHeading
      : exportTitle(notePath)
    ).slice(0, 120);
  const contentHtml = container.innerHTML;
  const codeTheme = codeThemeById(
    options.codeTheme ?? DEFAULT_CODE_THEME,
  );
  const themeVars = `:root { --code-bg: ${codeTheme.background}; --code-fg: ${codeTheme.foreground}; }`;
  const documentHtml = `<!doctype html>
<html lang="${language === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Inker">
<title>${escapeHtml(title)}</title>
<style>${codeTheme.css}\n${EXPORT_CSS}\n${themeVars}</style>
</head>
<body>
<article class="markdown-body export-body">${contentHtml}</article>
</body>
</html>`;

  return {
    title,
    container,
    contentHtml,
    documentHtml,
    warnings,
  };
}

function joinDirectory(directory: string, fileName: string): string {
  const separator =
    directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  return `${directory.replace(/[\\/]+$/, '')}${separator}${fileName}`;
}

export async function saveHtmlExport(
  prepared: PreparedExport,
  options: SaveHtmlOptions = {},
): Promise<string | null> {
  const fileName = `${safeFileName(prepared.title)}.html`;
  const path = await save({
    defaultPath: options.defaultDirectory
      ? joinDirectory(options.defaultDirectory, fileName)
      : fileName,
    filters: [{ name: 'HTML', extensions: ['html'] }],
  });
  if (!path) return null;
  await api.saveExport(path, prepared.documentHtml, false);
  return path;
}

export async function saveDocxExport(
  prepared: PreparedExport,
  options: SaveDocxOptions = {},
): Promise<string | null> {
  const { docxToBase64 } = await import('./docxExport');
  const base64 = await docxToBase64(prepared.container, prepared.title, {
    codeTheme: options.codeTheme,
    includeToc: options.includeToc,
  });
  const path = await save({
    defaultPath: `${safeFileName(prepared.title)}.docx`,
    filters: [{ name: 'Word', extensions: ['docx'] }],
  });
  if (!path) return null;
  await api.saveExport(path, base64, true);
  return path;
}
