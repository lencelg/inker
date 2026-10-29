import {
  AlignmentType,
  BorderStyle,
  Bookmark,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  ImageRun,
  InternalHyperlink,
  LeaderType,
  LevelFormat,
  LineRuleType,
  Math as DocxMath,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type FileChild,
  type ParagraphChild,
} from 'docx';
import { latexToMath } from 'docx/math';
import {
  DEFAULT_CODE_THEME,
  codeThemeById,
  type CodeThemeDefinition,
  type CodeThemeId,
} from './codeThemes';
import { t } from './i18n';

const MAX_IMAGE_WIDTH = 600;
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const PAGE_MARGIN = 1134;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const CODE_FONT = 'Consolas';
const MUTED_COLOR = '57606A';
const BORDER_COLOR = 'D8DEE4';
const CODE_BORDER_COLOR = 'D8DEE4';
const BODY_RUN_SIZE = 22;
const BODY_LINE_SPACING = 360;

const HEADING_LEVELS: Record<
  string,
  (typeof HeadingLevel)[keyof typeof HeadingLevel]
> = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
  H5: HeadingLevel.HEADING_5,
  H6: HeadingLevel.HEADING_6,
};

const FALLBACK_SYNTAX_COLORS: Record<string, string> = {
  'hljs-keyword': 'CF222E',
  'hljs-string': '0A3069',
  'hljs-comment': '6E7781',
  'hljs-number': '0550AE',
  'hljs-title': '8250DF',
  'hljs-attr': '0550AE',
  'hljs-attribute': '0550AE',
  'hljs-built_in': '953800',
  'hljs-literal': '0550AE',
  'hljs-type': '953800',
  'hljs-variable': '953800',
  'hljs-meta': '6E7781',
  'hljs-tag': '116329',
  'hljs-name': '116329',
  'hljs-params': '24292F',
  'hljs-property': '0550AE',
  'hljs-regexp': '0A3069',
  'hljs-symbol': '0A3069',
  'hljs-template-variable': '953800',
  'hljs-selector-class': '6F42C1',
  'hljs-selector-id': '6F42C1',
  'hljs-selector-tag': '116329',
};

interface DocxExportOptions {
  codeTheme?: CodeThemeId;
  includeToc?: boolean;
}

interface DocxContext {
  bookmarks: Map<string, string>;
  syntax: Record<string, string>;
  codeBackground: string;
  codeForeground: string;
  listIndex: number;
}

interface BlockContext {
  quote?: boolean;
  bold?: boolean;
  listLevel?: number;
}

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
  color?: string;
  strike?: boolean;
  underline?: boolean;
  superScript?: boolean;
  subScript?: boolean;
}

interface ImageData {
  data: Uint8Array;
  type: 'png' | 'jpg' | 'gif' | 'bmp';
  width: number;
  height: number;
}

function bodyFontName(): string {
  const userAgent = navigator.userAgent;
  if (/Windows/i.test(userAgent)) return 'Microsoft YaHei';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'PingFang SC';
  return 'Noto Sans CJK SC';
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

function bodyFont() {
  const name = bodyFontName();
  return {
    ascii: 'Calibri',
    hAnsi: 'Calibri',
    eastAsia: name,
    cs: name,
  };
}

function scaledSize(
  width: number,
  height: number,
): { width: number; height: number } {
  if (width <= MAX_IMAGE_WIDTH) {
    return { width, height };
  }
  const ratio = MAX_IMAGE_WIDTH / width;
  return {
    width: MAX_IMAGE_WIDTH,
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function colorToHex(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  if (/^#[0-9a-f]{6}$/i.test(candidate)) {
    return candidate.slice(1).toUpperCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(candidate)) {
    return candidate
      .slice(1)
      .split('')
      .map((part) => `${part}${part}`)
      .join('')
      .toUpperCase();
  }
  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.color = '';
  probe.style.color = candidate;
  if (!probe.style.color) return null;
  document.body.append(probe);
  const computed = window.getComputedStyle(probe).color;
  probe.remove();
  const match = computed.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i,
  );
  if (!match) return null;
  return [match[1], match[2], match[3]]
    .map((part) =>
      Number(part).toString(16).padStart(2, '0').toUpperCase(),
    )
    .join('');
}

function syntaxColors(
  theme: CodeThemeDefinition,
): Record<string, string> {
  const colors: Record<string, string> = {
    ...FALLBACK_SYNTAX_COLORS,
  };
  for (const [kind, value] of Object.entries(theme.palette.colors)) {
    const color = colorToHex(value);
    if (!color) continue;
    colors[kind] = color;
    colors[`tk-${kind}`] = color;
  }

  const css = theme.legacyCss ?? '';
  if (!css.trim()) return colors;

  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let rule: RegExpExecArray | null;
  while ((rule = rulePattern.exec(cleaned))) {
    const colorMatch = rule[2].match(
      /(?:^|;)\s*color\s*:\s*([^;]+)/i,
    );
    if (!colorMatch) continue;
    const color = colorToHex(colorMatch[1]);
    if (!color) continue;
    for (const selector of rule[1].split(',')) {
      for (const match of selector.matchAll(
        /\.hljs[-a-zA-Z0-9_]+/g,
      )) {
        colors[match[0].slice(1)] = color;
      }
    }
  }
  return colors;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function dataImage(
  source: string,
): { mime: string; data: Uint8Array } | null {
  const match = source.match(
    /^data:image\/(png|jpe?g|gif|bmp);base64,([\s\S]+)$/i,
  );
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const type =
    mime === 'jpeg' || mime === 'jpg'
      ? 'jpg'
      : mime === 'png'
        ? 'png'
        : mime === 'gif'
          ? 'gif'
          : 'bmp';
  return { mime: type, data: base64ToBytes(match[2]) };
}

async function svgToPng(svg: string): Promise<ImageData | null> {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const display = scaledSize(
      image.naturalWidth || 800,
      image.naturalHeight || 600,
    );
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(display.width * scale));
    canvas.height = Math.max(1, Math.round(display.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!png) return null;
    return {
      data: new Uint8Array(await png.arrayBuffer()),
      type: 'png',
      width: display.width,
      height: display.height,
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterToPng(
  image: HTMLImageElement,
): Promise<ImageData | null> {
  const source = image.currentSrc || image.src;
  if (!source.startsWith('data:')) return null;
  try {
    await image.decode();
  } catch {
    return null;
  }
  const display = scaledSize(
    image.naturalWidth || 600,
    image.naturalHeight || 400,
  );
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(display.width * scale));
  canvas.height = Math.max(1, Math.round(display.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
  const png = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (!png) return null;
  return {
    data: new Uint8Array(await png.arrayBuffer()),
    type: 'png',
    width: display.width,
    height: display.height,
  };
}

async function imageParagraph(
  image: HTMLImageElement,
): Promise<Paragraph | null> {
  const source = image.currentSrc || image.src;
  if (!source) return null;
  try {
    let data: ImageData | null = null;
    if (source.startsWith('data:image/svg+xml')) {
      data = await svgToPng(await (await fetch(source)).text());
    } else {
      const direct = dataImage(source);
      if (direct) {
        const display = scaledSize(
          image.naturalWidth || 600,
          image.naturalHeight || 400,
        );
        data = {
          data: direct.data,
          type: direct.mime as ImageData['type'],
          width: display.width,
          height: display.height,
        };
      } else if (source.startsWith('data:')) {
        data = await rasterToPng(image);
      }
    }
    if (!data) {
      const alt = image.alt || t('preview.imageFallback');
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `[${alt}]`,
            italics: true,
            color: MUTED_COLOR,
          }),
        ],
      });
    }
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
      children: [
        new ImageRun({
          type: data.type,
          data: data.data,
          transformation: { width: data.width, height: data.height },
          altText: {
            name: image.alt || t('preview.imageFallback'),
            description: image.alt || '',
            title: image.title || image.alt || '',
          },
        }),
      ],
    });
  } catch {
    return null;
  }
}

function extractLatex(node: Node): string | null {
  const element =
    node instanceof HTMLElement
      ? node
      : node.parentElement;
  if (!element) return null;
  const annotation = element.querySelector(
    'annotation[encoding="application/x-tex"]',
  );
  const latex = annotation?.textContent?.trim();
  if (latex) return latex;
  return null;
}

function mathRun(node: HTMLElement): ParagraphChild[] {
  const latex = extractLatex(node);
  if (latex) {
    try {
      return [new DocxMath({ children: latexToMath(latex) })];
    } catch {
      // Fall back to the rendered text below.
    }
  }
  const text = node.textContent?.trim();
  return text
    ? [
        new TextRun({
          text,
          italics: true,
          color: MUTED_COLOR,
        }),
      ]
    : [];
}

function syntaxColor(
  node: HTMLElement,
  style: InlineStyle,
  context: DocxContext,
): string | undefined {
  for (const name of Array.from(node.classList)) {
    const color = context.syntax[name];
    if (color) return color;
  }
  return style.color;
}

function inlineRuns(
  node: Node,
  style: InlineStyle,
  context: DocxContext,
): ParagraphChild[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text) return [];
    return [
      new TextRun({
        text,
        bold: style.bold,
        italics: style.italics,
        strike: style.strike,
        underline: style.underline ? {} : undefined,
        superScript: style.superScript,
        subScript: style.subScript,
        font: style.code ? CODE_FONT : undefined,
        color: style.color,
        shading: style.code ? { fill: 'F6F8FA' } : undefined,
      }),
    ];
  }
  if (!(node instanceof HTMLElement)) return [];
  if (node.matches('script, style, button')) return [];
  if (node.matches('input[type="checkbox"]')) {
    const checked = (node as HTMLInputElement).checked;
    return [new TextRun({ text: checked ? '☑ ' : '☐ ' })];
  }
  if (node.matches('br')) return [new TextRun({ break: 1 })];
  if (node.matches('img')) return [];
  if (
    node.matches('math, .katex, .katex-display')
  ) {
    return mathRun(node);
  }

  if (node.matches('strong, b')) {
    return inlineRuns(node, { ...style, bold: true }, context);
  }
  if (node.matches('em, i')) {
    return inlineRuns(node, { ...style, italics: true }, context);
  }
  if (node.matches('del, s, strike')) {
    return inlineRuns(node, { ...style, strike: true }, context);
  }
  if (node.matches('u')) {
    return inlineRuns(node, { ...style, underline: true }, context);
  }
  if (node.matches('sup')) {
    return inlineRuns(node, { ...style, superScript: true }, context);
  }
  if (node.matches('sub')) {
    return inlineRuns(node, { ...style, subScript: true }, context);
  }
  if (node.matches('code')) {
    return childRuns(node, { ...style, code: true }, context);
  }
  if (node.matches('a')) {
    const href = (node as HTMLAnchorElement).getAttribute('href') ?? '';
    const runs = childRuns(node, { ...style, color: '0969DA' }, context);
    if (!href) return runs;
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      const anchor = context.bookmarks.get(id);
      return anchor
        ? [new InternalHyperlink({ children: runs, anchor })]
        : runs;
    }
    return [
      new ExternalHyperlink({
        children: runs,
        link: href,
      }),
    ];
  }

  const color = syntaxColor(node, style, context);
  return childRuns(
    node,
    color ? { ...style, color } : style,
    context,
  );
}

function childRuns(
  node: Node,
  style: InlineStyle,
  context: DocxContext,
): ParagraphChild[] {
  return Array.from(node.childNodes).flatMap((child) =>
    inlineRuns(child, style, context),
  );
}

function colorHex(value: string, fallback: string): string {
  return colorToHex(value) ?? fallback;
}

function codeRuns(
  node: Node,
  color: string,
  context: DocxContext,
): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const parts = (node.textContent ?? '').split('\n');
    return parts.flatMap((part, index) => {
      const runs: TextRun[] = [
        new TextRun({
          text: part.length > 0 ? part : ' ',
          font: CODE_FONT,
          size: 18,
          color,
        }),
      ];
      if (index < parts.length - 1) {
        runs.push(
          new TextRun({
            break: 1,
            font: CODE_FONT,
            size: 18,
            color,
          }),
        );
      }
      return runs;
    });
  }
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName === 'BR') {
    return [
      new TextRun({
        break: 1,
        font: CODE_FONT,
        size: 18,
        color,
      }),
    ];
  }

  let nextColor = color;
  const inlineColor = node.style?.color
    ? colorToHex(node.style.color)
    : null;
  if (inlineColor) {
    nextColor = inlineColor;
  } else {
    for (const name of Array.from(node.classList)) {
      const themed = context.syntax[name];
      if (themed) {
        nextColor = themed;
        break;
      }
    }
  }
  return Array.from(node.childNodes).flatMap((child) =>
    codeRuns(child, nextColor, context),
  );
}

function codeParagraphs(
  element: HTMLElement,
  context: DocxContext,
): Paragraph[] {
  const pre = element.matches('pre')
    ? element
    : element.querySelector('pre');
  const code = pre?.querySelector('code') ?? pre;
  const language =
    element.querySelector('.code-language')?.textContent?.trim() ?? '';
  const paragraphs: Paragraph[] = [];

  if (language) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [
          new TextRun({
            text: language,
            color: MUTED_COLOR,
            size: 16,
            font: CODE_FONT,
          }),
        ],
      }),
    );
  }

  const body = code ?? element;
  const runs = Array.from(body.childNodes).flatMap((child) =>
    codeRuns(child, context.codeForeground, context),
  );
  if (runs.length === 0) {
    runs.push(
      new TextRun({
        text: ' ',
        font: CODE_FONT,
        size: 18,
        color: context.codeForeground,
      }),
    );
  }

  paragraphs.push(
    new Paragraph({
      shading: { fill: context.codeBackground },
      spacing: {
        before: 0,
        after: 160,
        line: 240,
        lineRule: LineRuleType.AUTO,
      },
      border: {
        top: {
          style: BorderStyle.SINGLE,
          size: 4,
          color: CODE_BORDER_COLOR,
          space: 4,
        },
        bottom: {
          style: BorderStyle.SINGLE,
          size: 4,
          color: CODE_BORDER_COLOR,
          space: 4,
        },
        left: {
          style: BorderStyle.SINGLE,
          size: 4,
          color: CODE_BORDER_COLOR,
          space: 4,
        },
        right: {
          style: BorderStyle.SINGLE,
          size: 4,
          color: CODE_BORDER_COLOR,
          space: 4,
        },
      },
      children: runs,
    }),
  );
  return paragraphs;
}

async function mermaidParagraphs(
  element: HTMLElement,
): Promise<Paragraph[]> {
  const svg = element.querySelector('svg');
  if (svg) {
    const png = await svgToPng(svg.outerHTML);
    if (png) {
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
          children: [
            new ImageRun({
              type: 'png',
              data: png.data,
              transformation: {
                width: png.width,
                height: png.height,
              },
              altText: {
                name: t('docx.mermaid.title'),
                description: t('docx.mermaid.title'),
              },
            }),
          ],
        }),
      ];
    }
  }
  const source = element.textContent?.trim();
  return source
    ? [
        new Paragraph({
          children: [
            new TextRun({
              text: t('docx.mermaid.source'),
              italics: true,
              color: MUTED_COLOR,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: source, font: CODE_FONT, size: 18 }),
          ],
        }),
      ]
    : [];
}

function numberingDefinition(
  reference: string,
  ordered: boolean,
  start: number,
) {
  return {
    reference,
    levels: Array.from({ length: 9 }, (_, level) => ({
      level,
      format: ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
      text: ordered ? `%${level + 1}.` : '•',
      start,
      alignment: AlignmentType.START,
      style: {
        paragraph: {
          indent: {
            left: 720 + level * 360,
            hanging: 360,
          },
        },
      },
    })),
  };
}

async function convertList(
  list: HTMLElement,
  level: number,
  context: DocxContext,
): Promise<Paragraph[]> {
  const ordered = list.tagName === 'OL';
  const startValue = Number(list.getAttribute('start') ?? '1');
  const start =
    Number.isFinite(startValue) && startValue > 0 ? startValue : 1;
  const reference = `inkerList${context.listIndex + 1}`;
  context.listIndex += 1;
  const instance = context.listIndex;
  const definition = numberingDefinition(reference, ordered, start);
  const paragraphs: Paragraph[] = [];
  let processed = 0;

  for (const item of Array.from(list.children)) {
    if (!(item instanceof HTMLElement) || item.tagName !== 'LI') {
      continue;
    }
    const clone = item.cloneNode(true) as HTMLElement;
    const nested = Array.from(
      clone.querySelectorAll(':scope > ul, :scope > ol'),
    ) as HTMLElement[];
    for (const nestedList of nested) nestedList.remove();

    paragraphs.push(
      new Paragraph({
        children: inlineRuns(clone, {}, context),
        numbering: {
          reference: definition,
          level,
          instance,
        },
        spacing: { after: 60 },
      }),
    );
    for (const nestedList of nested) {
      paragraphs.push(
        ...(await convertList(nestedList, level + 1, context)),
      );
    }
    processed += 1;
    if (processed % 32 === 0) await yieldToMain();
  }
  return paragraphs;
}

async function tableFrom(
  element: HTMLElement,
  context: DocxContext,
): Promise<Table> {
  const rowElements = Array.from(element.querySelectorAll('tr'));
  const cellRows = rowElements.map((row) =>
    Array.from(row.children).filter(
      (cell) =>
        cell instanceof HTMLElement &&
        (cell.tagName === 'TH' || cell.tagName === 'TD'),
    ) as HTMLElement[],
  );
  const columnCount = Math.max(
    1,
    ...cellRows.map((cells) =>
      cells.reduce(
        (total, cell) =>
          total + Math.max(1, Number(cell.getAttribute('colspan') ?? 1)),
        0,
      ),
    ),
  );
  const columnWidth = Math.max(
    600,
    Math.floor(CONTENT_WIDTH / columnCount),
  );
  const columnWidths = Array.from(
    { length: columnCount },
    () => columnWidth,
  );

  const rows: TableRow[] = [];
  for (let rowIndex = 0; rowIndex < cellRows.length; rowIndex += 1) {
    const cells = cellRows[rowIndex];
    if (cells.length === 0) continue;
    if (rowIndex > 0 && rowIndex % 24 === 0) await yieldToMain();
    const inThead =
      rowElements[rowIndex].parentElement?.tagName === 'THEAD';
    const header =
      inThead || cells.every((cell) => cell.tagName === 'TH');
    const tableCells: TableCell[] = [];

    for (const cell of cells) {
      let children: (Paragraph | Table)[] = [];
      if (cell.tagName === 'TH') {
        children = [
          new Paragraph({
            children: inlineRuns(cell, { bold: true }, context),
          }),
        ];
      } else {
        children = (await convertChildren(cell, context, {
          bold: header,
        })) as (Paragraph | Table)[];
        if (children.length === 0) {
          children = [new Paragraph('')];
        }
      }
      const columnSpan = Math.max(
        1,
        Number(cell.getAttribute('colspan') ?? 1),
      );
      const rowSpan = Math.max(
        1,
        Number(cell.getAttribute('rowspan') ?? 1),
      );
      tableCells.push(
        new TableCell({
          children,
          shading: header ? { fill: 'F2F2F2' } : undefined,
          verticalAlign: VerticalAlignTable.TOP,
          width: { size: columnWidth, type: WidthType.DXA },
          ...(columnSpan > 1 ? { columnSpan } : {}),
          ...(rowSpan > 1 ? { rowSpan } : {}),
        }),
      );
    }

    rows.push(
      new TableRow({
        children: tableCells,
        tableHeader: header,
        cantSplit: true,
      }),
    );
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths,
    layout: TableLayoutType.FIXED,
    borders: {
      top: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: BORDER_COLOR,
      },
      bottom: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: BORDER_COLOR,
      },
      left: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: BORDER_COLOR,
      },
      right: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: BORDER_COLOR,
      },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: BORDER_COLOR,
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: BORDER_COLOR,
      },
    },
  });
}

function horizontalRule(): Paragraph {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 6,
        color: BORDER_COLOR,
        space: 1,
      },
    },
  });
}

function pageBreak(): Paragraph {
  return new Paragraph({
    children: [new PageBreak()],
  });
}

function displayMathParagraph(
  element: HTMLElement,
): Paragraph | null {
  const display = element.matches('.katex-display, math')
    ? element
    : element.querySelector('.katex-display');
  if (!display) return null;
  const latex = extractLatex(display);
  if (!latex) return null;
  try {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
      children: [new DocxMath({ children: latexToMath(latex) })],
    });
  } catch {
    return null;
  }
}

async function convertBlock(
  element: HTMLElement,
  context: DocxContext,
  block: BlockContext = {},
): Promise<FileChild[]> {
  if (
    element.matches(
      'script, style, button, nav.export-toc, .page-break-marker',
    )
  ) {
    return [];
  }
  if (element.matches('.page-break')) {
    return [pageBreak()];
  }
  if (element.matches('.code-block')) {
    return codeParagraphs(element, context);
  }
  if (element.matches('.mermaid-block')) {
    return mermaidParagraphs(element);
  }
  if (element.matches('h1, h2, h3, h4, h5, h6')) {
    const heading = HEADING_LEVELS[element.tagName];
    const runs = inlineRuns(element, {}, context);
    const bookmark = element.id
      ? context.bookmarks.get(element.id)
      : undefined;
    return [
      new Paragraph({
        heading,
        children: bookmark
          ? [
              new Bookmark({
                id: bookmark,
                children: runs,
              }),
            ]
          : runs,
      }),
    ];
  }
  if (element.tagName === 'P') {
    const math = displayMathParagraph(element);
    if (math) return [math];
    const result: FileChild[] = [];
    const runs = inlineRuns(
      element,
      {
        italics: block.quote,
        bold: block.bold,
        color: block.quote ? MUTED_COLOR : undefined,
      },
      context,
    );
    if (runs.length > 0) {
      result.push(
        new Paragraph({
          children: runs,
          indent: block.quote ? { left: 360 } : undefined,
          spacing: { after: 120 },
          border: block.quote
            ? {
                left: {
                  style: BorderStyle.SINGLE,
                  size: 18,
                  color: BORDER_COLOR,
                  space: 10,
                },
              }
            : undefined,
        }),
      );
    }
    for (const image of Array.from(
      element.querySelectorAll<HTMLImageElement>('img'),
    )) {
      const paragraph = await imageParagraph(image);
      if (paragraph) result.push(paragraph);
    }
    return result;
  }
  if (element.tagName === 'UL' || element.tagName === 'OL') {
    return convertList(element, block.listLevel ?? 0, context);
  }
  if (element.tagName === 'PRE') {
    return codeParagraphs(element, context);
  }
  if (element.tagName === 'BLOCKQUOTE') {
    return convertChildren(element, context, {
      ...block,
      quote: true,
    });
  }
  if (element.tagName === 'TABLE') {
    return [await tableFrom(element, context)];
  }
  if (element.tagName === 'HR') {
    return [horizontalRule()];
  }
  if (element.tagName === 'IMG') {
    const paragraph = await imageParagraph(
      element as HTMLImageElement,
    );
    return paragraph ? [paragraph] : [];
  }
  return convertChildren(element, context, block);
}

async function convertChildren(
  element: HTMLElement,
  context: DocxContext,
  block: BlockContext = {},
): Promise<FileChild[]> {
  const children: FileChild[] = [];
  let processed = 0;
  for (const child of Array.from(element.children)) {
    if (child instanceof HTMLElement) {
      children.push(
        ...(await convertBlock(child, context, block)),
      );
      processed += 1;
      if (processed % 16 === 0) await yieldToMain();
    }
  }
  if (children.length === 0) {
    const text = element.textContent?.trim();
    if (text) children.push(new Paragraph({ children: [new TextRun(text)] }));
  }
  return children;
}

function headingBookmarks(
  container: HTMLElement,
): Map<string, string> {
  const bookmarks = new Map<string, string>();
  let index = 0;
  for (const heading of Array.from(
    container.querySelectorAll<HTMLElement>(
      'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id], math[id]',
    ),
  )) {
    if (!heading.id) continue;
    index += 1;
    bookmarks.set(heading.id, `inkerHeading${index}`);
  }
  return bookmarks;
}

export async function docxToBase64(
  container: HTMLElement,
  title: string,
  options: DocxExportOptions = {},
): Promise<string> {
  const theme = codeThemeById(
    options.codeTheme ?? DEFAULT_CODE_THEME,
  );
  const context: DocxContext = {
    bookmarks: headingBookmarks(container),
    syntax: syntaxColors(theme),
    codeBackground: colorHex(theme.background, 'F6F8FA'),
    codeForeground: colorHex(theme.foreground, '1F2933'),
    listIndex: 0,
  };

  const children = await convertChildren(container, context);
  const headingCount = container.querySelectorAll(
    'h1, h2, h3, h4',
  ).length;
  const toc: FileChild[] =
    options.includeToc !== false && headingCount >= 2
      ? [
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: t('export.contents'),
                bold: true,
                size: 32,
                color: '1F2933',
              }),
            ],
          }),
          new TableOfContents(t('export.contents'), {
            hyperlink: true,
            headingStyleRange: '1-4',
            tabLeader: LeaderType.DOT,
          }),
          pageBreak(),
        ]
      : [];

  const document = new Document({
    title,
    subject: title,
    creator: 'Inker',
    description: `${title} — Inker`,
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: {
            font: bodyFont(),
            size: BODY_RUN_SIZE,
          },
          paragraph: {
            spacing: {
              line: BODY_LINE_SPACING,
              lineRule: LineRuleType.AUTO,
            },
          },
        },
        heading1: {
          run: {
            bold: true,
            size: 36,
            color: '1F2933',
            font: bodyFont(),
          },
          paragraph: { spacing: { before: 280, after: 120 } },
        },
        heading2: {
          run: {
            bold: true,
            size: 30,
            color: '1F2933',
            font: bodyFont(),
          },
          paragraph: { spacing: { before: 240, after: 100 } },
        },
        heading3: {
          run: {
            bold: true,
            size: 26,
            color: '1F2933',
            font: bodyFont(),
          },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
        heading4: {
          run: {
            bold: true,
            size: 24,
            color: '1F2933',
            font: bodyFont(),
          },
          paragraph: { spacing: { before: 160, after: 60 } },
        },
        heading5: {
          run: {
            bold: true,
            size: 22,
            color: '1F2933',
            font: bodyFont(),
          },
        },
        heading6: {
          run: {
            bold: true,
            size: 22,
            color: MUTED_COLOR,
            font: bodyFont(),
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: {
              top: PAGE_MARGIN,
              right: PAGE_MARGIN,
              bottom: PAGE_MARGIN,
              left: PAGE_MARGIN,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [
                      PageNumber.CURRENT,
                      ' / ',
                      PageNumber.TOTAL_PAGES,
                    ],
                    color: MUTED_COLOR,
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [...toc, ...children],
      },
    ],
  });

  return Packer.toBase64String(document);
}
