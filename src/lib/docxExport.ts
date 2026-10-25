import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type FileChild,
  type ParagraphChild,
} from 'docx';
import { t } from './i18n';

const MAX_IMAGE_WIDTH = 600;
const CJK_FONT = {
  ascii: 'Microsoft YaHei',
  hAnsi: 'Microsoft YaHei',
  eastAsia: 'Microsoft YaHei',
  cs: 'Microsoft YaHei',
};
const CODE_FONT = 'Consolas';
const HEADING_LEVELS: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
  H5: HeadingLevel.HEADING_5,
  H6: HeadingLevel.HEADING_6,
};
const SYNTAX_COLORS: Record<string, string> = {
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
};

interface BlockContext {
  listLevel?: number;
  quote?: boolean;
}

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
  color?: string;
  strike?: boolean;
}

interface ImageData {
  data: Uint8Array;
  type: 'png';
  width: number;
  height: number;
}

function scaledSize(width: number, height: number): { width: number; height: number } {
  if (width <= MAX_IMAGE_WIDTH) {
    return { width, height };
  }
  const ratio = MAX_IMAGE_WIDTH / width;
  return {
    width: MAX_IMAGE_WIDTH,
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function svgToPng(svg: string): Promise<ImageData | null> {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = image.naturalWidth || 800;
    const height = image.naturalHeight || 600;
    const size = scaledSize(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
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
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function imageElementToPng(
  image: HTMLImageElement,
): Promise<ImageData | null> {
  const source = image.currentSrc || image.src;
  if (!source.startsWith('data:')) return null;
  try {
    await image.decode();
  } catch {
    return null;
  }
  const width = image.naturalWidth || 600;
  const height = image.naturalHeight || 400;
  const size = scaledSize(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
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
    width: canvas.width,
    height: canvas.height,
  };
}

async function imageParagraph(
  image: HTMLImageElement,
): Promise<Paragraph | null> {
  const source = image.currentSrc || image.src;
  if (!source) return null;
  try {
    const data = source.startsWith('data:image/svg+xml')
      ? await svgToPng(await (await fetch(source)).text())
      : await imageElementToPng(image);
    if (!data) return null;
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
      children: [
        new ImageRun({
          type: 'png',
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

function inlineRuns(
  node: Node,
  style: InlineStyle = {},
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
  if (node.matches('math, .katex, .katex-display')) {
    const text = node.textContent?.trim();
    return text ? [new TextRun({ text: ` ${text} `, italics: true })] : [];
  }

  if (node.matches('strong, b')) {
    return childRuns(node, { ...style, bold: true });
  }
  if (node.matches('em, i')) {
    return childRuns(node, { ...style, italics: true });
  }
  if (node.matches('del, s, strike')) {
    return childRuns(node, { ...style, strike: true });
  }
  if (node.matches('code')) {
    return childRuns(node, { ...style, code: true });
  }
  if (node.matches('a')) {
    const href = (node as HTMLAnchorElement).getAttribute('href') ?? '';
    const runs = childRuns(node, { ...style, color: '0969DA' });
    if (!href || href.startsWith('#')) return runs;
    return [
      new ExternalHyperlink({
        children: runs,
        link: href,
      }),
    ];
  }

  const syntaxClass = Array.from(node.classList).find(
    (name) => SYNTAX_COLORS[name],
  );
  return childRuns(
    node,
    syntaxClass ? { ...style, color: SYNTAX_COLORS[syntaxClass] } : style,
  );
}

function childRuns(node: Node, style: InlineStyle): ParagraphChild[] {
  return Array.from(node.childNodes).flatMap((child) =>
    inlineRuns(child, style),
  );
}

function codeParagraphs(element: HTMLElement): Paragraph[] {
  const pre = element.matches('pre')
    ? element
    : element.querySelector('pre');
  const code = pre?.querySelector('code')?.textContent ?? pre?.textContent ?? '';
  const language =
    element.querySelector('.code-language')?.textContent?.trim() ?? '';
  const lines = code.replace(/\n$/, '').split('\n');
  const paragraphs: Paragraph[] = [];
  if (language) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [
          new TextRun({
            text: language,
            color: '6E7781',
            size: 16,
            font: CODE_FONT,
          }),
        ],
      }),
    );
  }
  for (const line of lines) {
    paragraphs.push(
      new Paragraph({
        shading: { fill: 'F6F8FA' },
        spacing: { after: 0, line: 240 },
        children: [
          new TextRun({
            text: line || ' ',
            font: CODE_FONT,
            size: 18,
          }),
        ],
      }),
    );
  }
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
              transformation: { width: png.width, height: png.height },
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
              color: '6E7781',
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

async function convertList(
  list: HTMLElement,
  level: number,
): Promise<Paragraph[]> {
  const ordered = list.tagName === 'OL';
  const paragraphs: Paragraph[] = [];
  let index = 1;

  for (const item of Array.from(list.children)) {
    if (!(item instanceof HTMLElement) || item.tagName !== 'LI') continue;
    const clone = item.cloneNode(true) as HTMLElement;
    const nested = Array.from(
      clone.querySelectorAll(':scope > ul, :scope > ol'),
    ) as HTMLElement[];
    for (const nestedList of nested) nestedList.remove();

    const runs = inlineRuns(clone);
    const children: ParagraphChild[] = ordered
      ? [
          new TextRun({ text: `${index}. ` }),
          ...runs,
        ]
      : runs;

    paragraphs.push(
      new Paragraph({
        children,
        bullet: ordered ? undefined : { level },
        indent: ordered ? { left: 360 + level * 360 } : undefined,
        spacing: { after: 60 },
      }),
    );
    for (const nestedList of nested) {
      paragraphs.push(...(await convertList(nestedList, level + 1)));
    }
    index += 1;
  }
  return paragraphs;
}

function tableFrom(element: HTMLElement): Table {
  const rows = Array.from(element.querySelectorAll('tr')).map(
    (row) =>
      new TableRow({
        children: Array.from(row.children)
          .filter(
            (cell) =>
              cell instanceof HTMLElement &&
              (cell.tagName === 'TH' || cell.tagName === 'TD'),
          )
          .map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: inlineRuns(cell, {
                      bold: (cell as HTMLElement).tagName === 'TH',
                    }),
                  }),
                ],
                shading:
                  (cell as HTMLElement).tagName === 'TH'
                    ? { fill: 'F2F2F2' }
                    : undefined,
              }),
          ),
      }),
  );
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function horizontalRule(): Paragraph {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 6,
        color: 'D8DEE4',
        space: 1,
      },
    },
  });
}

async function convertBlock(
  element: HTMLElement,
  context: BlockContext = {},
): Promise<FileChild[]> {
  if (element.matches('.code-block')) {
    return codeParagraphs(element);
  }
  if (element.matches('.mermaid-block')) {
    return mermaidParagraphs(element);
  }
  if (element.matches('h1, h2, h3, h4, h5, h6')) {
    const heading = HEADING_LEVELS[element.tagName];
    return [
      new Paragraph({
        heading,
        children: inlineRuns(element),
      }),
    ];
  }
  if (element.tagName === 'P') {
    const result: FileChild[] = [];
    const runs = inlineRuns(element, { italics: context.quote });
    if (runs.length > 0) {
      result.push(
        new Paragraph({
          children: runs,
          indent: context.quote ? { left: 360 } : undefined,
          spacing: { after: 120 },
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
    return convertList(element, context.listLevel ?? 0);
  }
  if (element.tagName === 'PRE') {
    return codeParagraphs(element);
  }
  if (element.tagName === 'BLOCKQUOTE') {
    return convertChildren(element, { ...context, quote: true });
  }
  if (element.tagName === 'TABLE') {
    return [tableFrom(element)];
  }
  if (element.tagName === 'HR') {
    return [horizontalRule()];
  }
  if (element.tagName === 'IMG') {
    const paragraph = await imageParagraph(element as HTMLImageElement);
    return paragraph ? [paragraph] : [];
  }
  return convertChildren(element, context);
}

async function convertChildren(
  element: HTMLElement,
  context: BlockContext = {},
): Promise<FileChild[]> {
  const children: FileChild[] = [];
  for (const child of Array.from(element.children)) {
    if (child instanceof HTMLElement) {
      children.push(...(await convertBlock(child, context)));
    }
  }
  if (children.length === 0) {
    const text = element.textContent?.trim();
    if (text) children.push(new Paragraph({ children: [new TextRun(text)] }));
  }
  return children;
}

export async function docxToBase64(
  container: HTMLElement,
  title: string,
): Promise<string> {
  const children = await convertChildren(container);
  const document = new Document({
    title,
    creator: 'Inker',
    styles: {
      default: {
        document: {
          run: { font: CJK_FONT, size: 22 },
          paragraph: { spacing: { line: 360 } },
        },
        title: {
          run: { bold: true, size: 48, color: '1F2933', font: CJK_FONT },
          paragraph: { spacing: { after: 240 } },
        },
        heading1: {
          run: { bold: true, size: 36, color: '1F2933', font: CJK_FONT },
          paragraph: { spacing: { before: 280, after: 120 } },
        },
        heading2: {
          run: { bold: true, size: 30, color: '1F2933', font: CJK_FONT },
          paragraph: { spacing: { before: 240, after: 100 } },
        },
        heading3: {
          run: { bold: true, size: 26, color: '1F2933', font: CJK_FONT },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
        heading4: {
          run: { bold: true, size: 24, color: '1F2933', font: CJK_FONT },
          paragraph: { spacing: { before: 160, after: 60 } },
        },
        heading5: {
          run: { bold: true, size: 22, color: '1F2933', font: CJK_FONT },
        },
        heading6: {
          run: { bold: true, size: 22, color: '6E7781', font: CJK_FONT },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBase64String(document);
}
