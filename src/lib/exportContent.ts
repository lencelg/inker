import DOMPurify from 'dompurify';
import renderMathInElement from 'katex/contrib/auto-render';
import { save } from '@tauri-apps/plugin-dialog';
import githubCss from 'highlight.js/styles/github.css?raw';
import { api } from '../api';
import { isLocalImageSource, renderMarkdown } from './markdown';
import { renderMermaid } from './mermaid';
import { basename } from './paths';

export interface PreparedExport {
  title: string;
  container: HTMLElement;
  contentHtml: string;
  documentHtml: string;
}

export interface ExportOptions {
  codeHighlight?: boolean;
}

const EXPORT_CSS = `
:root {
  color-scheme: light;
  --ink: #1f2933;
  --muted: #57606a;
  --border: #d8dee4;
  --code-bg: #f6f8fa;
  --accent: #0969da;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body {
  color: var(--ink);
  font-family: 'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;
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
  background: var(--code-bg);
  font-family: var(--mono);
  font-size: 0.9em;
}
.export-body .code-block { position: relative; margin: 1em 0; }
.export-body pre {
  margin: 1em 0;
  padding: 14px 16px;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--code-bg);
  font-family: var(--mono);
  font-size: 0.88em;
  line-height: 1.6;
  white-space: pre;
}
.export-body .code-block pre { margin: 0; }
.export-body pre code { padding: 0; background: transparent; font-size: inherit; }
.export-body .code-language {
  position: absolute;
  top: 7px;
  right: 9px;
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: rgba(246, 248, 250, 0.92);
  color: var(--muted);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  pointer-events: none;
}
.export-body table { width: 100%; margin: 1em 0; border-collapse: collapse; font-size: 0.94em; }
.export-body th, .export-body td { padding: 7px 10px; border: 1px solid var(--border); text-align: left; vertical-align: top; }
.export-body th { background: var(--code-bg); }
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
  min-width: 120px; min-height: 36px; background: var(--code-bg);
}
@media print {
  body { background: #fff; }
  .export-body { max-width: none; padding: 0; }
  a { color: inherit; text-decoration: none; }
  pre, table, blockquote, img { break-inside: avoid; }
  h1, h2, h3, h4 { break-after: avoid; }
}
@page { margin: 18mm; }
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

async function resolveExportImages(
  container: HTMLElement,
  notePath: string,
): Promise<void> {
  const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(
    images.map(async (image) => {
      let source = image.dataset.mdSrc?.trim() ?? '';
      if (!source) {
        source = image.getAttribute('src')?.trim() ?? '';
      }
      if (source && isLocalImageSource(source)) {
        try {
          const asset = await api.readAsset(notePath, source);
          image.src = `data:${asset.mime};base64,${asset.data}`;
        } catch {
          const placeholder = document.createElement('span');
          placeholder.textContent = `${image.alt || '图片'}（无法加载）`;
          image.replaceWith(placeholder);
          return;
        }
      }
      image.removeAttribute('data-md-src');
      image.loading = 'eager';
      try {
        await image.decode();
      } catch {
        // Remote images may stay unavailable; keep alt text in that case.
      }
    }),
  );
}

async function renderExportDiagrams(container: HTMLElement): Promise<void> {
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
        block.classList.add('mermaid-error');
        block.textContent = `Mermaid 渲染失败：${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    }),
  );
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
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
  });
  await resolveExportImages(container, notePath);
  await renderExportDiagrams(container);

  for (const element of container.querySelectorAll(
    '[data-source-line], [data-source-line-end]',
  )) {
    element.removeAttribute('data-source-line');
    element.removeAttribute('data-source-line-end');
  }

  const title = exportTitle(notePath);
  const contentHtml = container.innerHTML;
  const documentHtml = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${githubCss}\n${EXPORT_CSS}</style>
</head>
<body>
<article class="markdown-body export-body">${contentHtml}</article>
</body>
</html>`;

  return { title, container, contentHtml, documentHtml };
}

export async function saveHtmlExport(
  prepared: PreparedExport,
): Promise<boolean> {
  const path = await save({
    defaultPath: `${safeFileName(prepared.title)}.html`,
    filters: [{ name: 'HTML', extensions: ['html'] }],
  });
  if (!path) return false;
  await api.saveExport(path, prepared.documentHtml, false);
  return true;
}

export async function saveDocxExport(
  prepared: PreparedExport,
): Promise<boolean> {
  const { docxToBase64 } = await import('./docxExport');
  const base64 = await docxToBase64(prepared.container, prepared.title);
  const path = await save({
    defaultPath: `${safeFileName(prepared.title)}.docx`,
    filters: [{ name: 'Word', extensions: ['docx'] }],
  });
  if (!path) return false;
  await api.saveExport(path, base64, true);
  return true;
}
