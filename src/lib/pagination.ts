import {
  DOCX_PREVIEW_STYLES,
  EXPORT_PAGE_STYLES,
} from './pageLayout';

export type PreviewFormat = 'pdf' | 'docx';

interface PageState {
  page: HTMLElement;
  content: HTMLElement;
}

interface PaginationContext {
  document: Document;
  staging: HTMLElement;
  pages: PageState[];
  current: PageState;
  format: PreviewFormat;
  overflow: boolean;
}

interface SplitResult {
  fit: HTMLElement;
  rest: HTMLElement | null;
}

const BLOCK_TAGS =
  /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DIV|DL|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|TABLE|UL)$/;

function injectStyles(document: Document, format: PreviewFormat): void {
  if (document.getElementById('inker-paged-export-styles')) return;
  const style = document.createElement('style');
  style.id = 'inker-paged-export-styles';
  style.textContent =
    EXPORT_PAGE_STYLES +
    (format === 'docx' ? `\n${DOCX_PREVIEW_STYLES}` : '');
  document.head.append(style);
}

export async function waitForPreviewAssets(
  document: Document,
): Promise<void> {
  const images = Array.from(document.images);
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          const done = (): void => resolve();
          image.addEventListener('load', done, { once: true });
          image.addEventListener('error', done, { once: true });
          window.setTimeout(done, 5000);
        });
      }
      try {
        await image.decode();
      } catch {
        // Broken images keep their rendered fallback size.
      }
    }),
  );
  try {
    await document.fonts?.ready;
  } catch {
    // System fonts do not expose a ready promise in every engine.
  }
}

function createPage(
  document: Document,
  staging: HTMLElement,
  format: PreviewFormat,
): PageState {
  const page = document.createElement('div');
  page.className = 'export-page';
  const content = document.createElement('div');
  content.className =
    'export-page-content export-body' +
    (format === 'docx' ? ' docx-export-preview' : '');
  page.append(content);
  staging.append(page);
  return { page, content };
}

function hasContent(content: HTMLElement): boolean {
  return Array.from(content.childNodes).some(
    (node) =>
      node.nodeType !== 3 ||
      Boolean(node.textContent && node.textContent.trim()),
  );
}

function fits(content: HTMLElement, element: HTMLElement): boolean {
  content.append(element);
  const result =
    content.scrollHeight <= content.clientHeight + 1;
  if (!result) element.remove();
  return result;
}

function measureFits(
  content: HTMLElement,
  element: HTMLElement,
): boolean {
  content.append(element);
  const result =
    content.scrollHeight <= content.clientHeight + 1;
  element.remove();
  return result;
}

function nextPage(context: PaginationContext): void {
  context.pages.push(context.current);
  context.current = createPage(
    context.document,
    context.staging,
    context.format,
  );
}

function textPosition(
  root: HTMLElement,
  offset: number,
): { node: Node; offset: number } | null {
  const document = root.ownerDocument;
  const walker = document.createTreeWalker(root, 4);
  let remaining = Math.max(0, offset);
  let last: Text | null = null;
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    const length = text.data.length;
    if (remaining <= length) {
      return { node: text, offset: remaining };
    }
    remaining -= length;
    last = text;
    node = walker.nextNode();
  }
  return last ? { node: last, offset: last.data.length } : null;
}

function makeTextFragment(
  source: HTMLElement,
  from: number,
  to: number,
): HTMLElement | null {
  const start = textPosition(source, from);
  const end = textPosition(source, to);
  if (!start || !end) return null;
  const document = source.ownerDocument;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const fragment = source.cloneNode(false) as HTMLElement;
  fragment.removeAttribute('id');
  fragment.append(range.cloneContents());
  return fragment;
}

function snapTextOffset(text: string, offset: number): number {
  if (offset <= 0 || offset >= text.length) return offset;
  if (/\s/.test(text[offset - 1] ?? '') || /\s/.test(text[offset] ?? '')) {
    return offset;
  }
  if (/[\u2e80-\u9fff\uf900-\ufaff]/.test(text)) return offset;

  const lastBreak = Math.max(
    text.lastIndexOf(' ', offset - 1),
    text.lastIndexOf('\n', offset - 1),
    text.lastIndexOf('\t', offset - 1),
  );
  return lastBreak > 0 ? lastBreak + 1 : offset;
}

function hasBlockChildren(element: HTMLElement): boolean {
  return Array.from(element.querySelectorAll('*')).some((child) =>
    BLOCK_TAGS.test(child.tagName),
  );
}

function splitTextBlock(
  source: HTMLElement,
  content: HTMLElement,
): SplitResult | null {
  if (
    hasBlockChildren(source) ||
    !['P', 'LI'].includes(source.tagName)
  ) {
    return null;
  }
  const text = source.textContent ?? '';
  if (text.trim().length < 2) return null;

  let low = 1;
  let high = text.length - 1;
  let best = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const fragment = makeTextFragment(source, 0, middle);
    if (!fragment) break;
    fragment.classList.add(
      'export-fragment',
      'export-fragment-split',
    );
    if (measureFits(content, fragment)) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (best <= 0) return null;

  const splitAt = snapTextOffset(text, best);
  if (splitAt <= 0 || splitAt >= text.length) return null;
  const fit = makeTextFragment(source, 0, splitAt);
  const rest = makeTextFragment(source, splitAt, text.length);
  if (!fit || !rest || !rest.textContent?.trim()) return null;
  fit.classList.add('export-fragment', 'export-fragment-split');
  rest.classList.add(
    'export-fragment',
    'export-fragment-continuation',
  );
  return { fit, rest };
}

function makeCodeFragment(
  source: HTMLElement,
  code: HTMLElement,
  from: number,
  to: number,
): HTMLElement | null {
  const start = textPosition(code, from);
  const end = textPosition(code, to);
  if (!start || !end) return null;
  const document = source.ownerDocument;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);

  const fragment = source.cloneNode(true) as HTMLElement;
  fragment.removeAttribute('id');
  const target =
    fragment.matches('pre')
      ? fragment.querySelector('code') ?? fragment
      : fragment.querySelector('pre code') ??
        fragment.querySelector('pre');
  if (!target) return null;
  target.replaceChildren(range.cloneContents());
  return fragment;
}

function splitCodeBlock(
  source: HTMLElement,
  content: HTMLElement,
): SplitResult | null {
  const code = source.matches('pre')
    ? (source.querySelector('code') ?? source) as HTMLElement
    : (source.querySelector('pre code') ??
        source.querySelector('pre')) as HTMLElement | null;
  if (!code) return null;
  const text = code.textContent ?? '';
  if (!text.includes('\n')) return null;

  const offsets: number[] = [];
  for (let index = 0; index < text.length - 1; index += 1) {
    if (text[index] === '\n') offsets.push(index + 1);
  }
  if (offsets.length === 0) return null;

  let low = 0;
  let high = offsets.length - 1;
  let best = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const fragment = makeCodeFragment(
      source,
      code,
      0,
      offsets[middle],
    );
    if (!fragment) break;
    fragment.classList.add(
      'export-fragment',
      'export-fragment-split',
    );
    if (measureFits(content, fragment)) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (best < 0) return null;

  const splitAt = offsets[best];
  const fit = makeCodeFragment(source, code, 0, splitAt);
  const rest = makeCodeFragment(source, code, splitAt, text.length);
  if (!fit || !rest || !rest.textContent) return null;
  fit.classList.add('export-fragment', 'export-fragment-split');
  rest.classList.add(
    'export-fragment',
    'export-fragment-continuation',
  );
  return { fit, rest };
}

function splitList(
  source: HTMLElement,
  content: HTMLElement,
): SplitResult | null {
  const items = Array.from(source.children).filter(
    (child) => child.tagName === 'LI',
  ) as HTMLElement[];
  if (items.length < 2) return null;

  const fit = source.cloneNode(false) as HTMLElement;
  fit.removeAttribute('id');
  content.append(fit);
  let included = 0;
  for (const item of items) {
    const clone = item.cloneNode(true) as HTMLElement;
    fit.append(clone);
    if (content.scrollHeight > content.clientHeight + 1) {
      clone.remove();
      break;
    }
    included += 1;
  }
  fit.remove();
  if (included === 0) return null;

  const rest = source.cloneNode(false) as HTMLElement;
  rest.removeAttribute('id');
  for (const item of items.slice(included)) {
    rest.append(item.cloneNode(true));
  }
  if (source.tagName === 'OL' && rest.children.length > 0) {
    const start = Number(source.getAttribute('start') ?? '1');
    rest.setAttribute(
      'start',
      String((Number.isFinite(start) && start > 0 ? start : 1) + included),
    );
  }
  return { fit, rest: rest.children.length > 0 ? rest : null };
}

function splitTable(
  source: HTMLElement,
  content: HTMLElement,
): SplitResult | null {
  const rows = Array.from(source.querySelectorAll('tr')).filter(
    (row) => !row.closest('thead') && !row.closest('tfoot'),
  );
  if (rows.length < 2) return null;

  const makeWrapper = (): {
    table: HTMLElement;
    body: HTMLElement;
  } => {
    const table = source.cloneNode(false) as HTMLElement;
    table.removeAttribute('id');
    const colgroup = source.querySelector(':scope > colgroup');
    if (colgroup) table.append(colgroup.cloneNode(true));
    const caption = source.querySelector(':scope > caption');
    if (caption) table.append(caption.cloneNode(true));
    const head = source.querySelector(':scope > thead');
    if (head) table.append(head.cloneNode(true));
    const body = source.ownerDocument.createElement('tbody');
    table.append(body);
    return { table, body };
  };

  const fit = makeWrapper();
  content.append(fit.table);
  let included = 0;
  for (const row of rows) {
    const clone = row.cloneNode(true) as HTMLElement;
    fit.body.append(clone);
    if (content.scrollHeight > content.clientHeight + 1) {
      clone.remove();
      break;
    }
    included += 1;
  }
  fit.table.remove();
  if (included === 0) return null;

  const rest = makeWrapper();
  for (const row of rows.slice(included)) {
    rest.body.append(row.cloneNode(true));
  }
  return { fit: fit.table, rest: rest.body.children.length ? rest.table : null };
}

function splitBlock(
  block: HTMLElement,
  content: HTMLElement,
): SplitResult | null {
  if (block.matches('.code-block') || block.tagName === 'PRE') {
    return splitCodeBlock(block, content);
  }
  if (block.tagName === 'TABLE') return splitTable(block, content);
  if (block.tagName === 'UL' || block.tagName === 'OL') {
    return splitList(block, content);
  }
  return splitTextBlock(block, content);
}

function placeBlock(
  block: HTMLElement,
  context: PaginationContext,
): void {
  if (fits(context.current.content, block)) return;

  if (hasContent(context.current.content)) {
    nextPage(context);
    placeBlock(block, context);
    return;
  }

  const split = splitBlock(block, context.current.content);
  if (split) {
    context.current.content.append(split.fit);
    if (split.rest) {
      nextPage(context);
      placeBlock(split.rest, context);
    }
    return;
  }

  context.current.content.append(block);
  context.overflow = true;
}

function normalizeTopLevelNode(
  node: Node,
  document: Document,
): HTMLElement | null {
  if (node.nodeType === 1) return node as HTMLElement;
  if (node.nodeType === 3 && node.textContent?.trim()) {
    const paragraph = document.createElement('p');
    paragraph.textContent = node.textContent;
    return paragraph;
  }
  return null;
}

export interface PaginationResult {
  pageCount: number;
  overflow: boolean;
}

export function paginatePreview(
  document: Document,
  format: PreviewFormat,
): PaginationResult {
  const article = document.querySelector<HTMLElement>(
    'article.export-body',
  );
  if (!article) {
    throw new Error('Export content is missing.');
  }

  injectStyles(document, format);
  const staging = document.createElement('div');
  staging.className = 'export-paged-staging';
  document.body.append(staging);

  const context: PaginationContext = {
    document,
    staging,
    pages: [],
    current: createPage(document, staging, format),
    format,
    overflow: false,
  };

  const nodes = Array.from(article.childNodes);
  for (const node of nodes) {
    const block = normalizeTopLevelNode(node, document);
    if (!block) continue;
    if (block.matches('.page-break')) {
      if (hasContent(context.current.content)) nextPage(context);
      continue;
    }
    placeBlock(block.cloneNode(true) as HTMLElement, context);
  }

  if (hasContent(context.current.content) || context.pages.length === 0) {
    context.pages.push(context.current);
  }

  const pageCount = context.pages.length;
  for (let index = 0; index < pageCount; index += 1) {
    const page = context.pages[index].page;
    const number = document.createElement('div');
    number.className = 'export-page-number';
    number.textContent = `${index + 1} / ${pageCount}`;
    page.append(number);
  }

  const pageElements = context.pages.map((page) => page.page);
  staging.remove();
  document.body.replaceChildren(...pageElements);
  document.body.classList.add('export-paged-ready');

  return { pageCount, overflow: context.overflow };
}
