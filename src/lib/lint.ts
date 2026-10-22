import type { SyntaxIssue } from '../types';

const headingMissingSpace = /^ {0,3}#{1,6}[^#\s]/;
const emptyHeading = /^ {0,3}#{1,6}\s*$/;
const inlineLink = /!?\[([^\]]*)\]\(([^)]*)\)/g;
const inlineCode = /`[^`\n]*`/g;

export function lintMarkdown(source: string): SyntaxIssue[] {
  const rawLines = source.split('\n');
  const lines = rawLines.map((line) => line.replace(/\r$/, ''));
  const issues: SyntaxIssue[] = [];
  const codeLines = detectCodeFences(lines, issues);

  for (let index = 0; index < lines.length; index += 1) {
    if (codeLines[index]) {
      continue;
    }
    const line = lines[index];
    const lineNumber = index + 1;
    const headingIssue = checkHeading(line, lineNumber);
    if (headingIssue) {
      issues.push(headingIssue);
    }
    issues.push(...checkLinks(line, lineNumber));
  }

  issues.sort((a, b) => a.line - b.line);
  return issues;
}

function checkHeading(line: string, lineNumber: number): SyntaxIssue | null {
  if (emptyHeading.test(line)) {
    return {
      line: lineNumber,
      severity: 'warning',
      rule: 'empty-heading',
      message: '标题内容为空',
    };
  }
  if (headingMissingSpace.test(line)) {
    return {
      line: lineNumber,
      severity: 'warning',
      rule: 'heading-space',
      message: '标题的 # 后缺少空格，可能不会被渲染为标题',
    };
  }
  return null;
}

function checkLinks(line: string, lineNumber: number): SyntaxIssue[] {
  const stripped = line.replace(inlineCode, '');
  const issues: SyntaxIssue[] = [];

  for (const match of stripped.matchAll(inlineLink)) {
    const text = match[1] ?? '';
    const destination = (match[2] ?? '').trim();
    const isImage = match.index !== undefined && stripped[match.index] === '!';

    if (!destination) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        rule: 'empty-link-destination',
        message: isImage ? '图片地址为空' : '链接地址为空',
      });
      continue;
    }
    if (!text) {
      issues.push({
        line: lineNumber,
        severity: 'warning',
        rule: 'empty-link-text',
        message: isImage ? '图片缺少替代文本' : '链接文本为空',
      });
    }
  }

  return issues;
}

interface FenceState {
  mark: string;
  size: number;
  line: number;
}

interface FenceInfo {
  mark: string;
  size: number;
  rest: string;
}

function detectCodeFences(lines: string[], issues: SyntaxIssue[]): boolean[] {
  const codeLines = new Array<boolean>(lines.length).fill(false);
  let open: FenceState | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (open) {
      codeLines[index] = true;
      if (isClosingFence(line, open)) {
        open = null;
      }
      continue;
    }

    const fence = openingFence(line);
    if (fence) {
      open = { ...fence, line: index + 1 };
      codeLines[index] = true;
    }
  }

  if (open) {
    issues.push({
      line: open.line,
      severity: 'error',
      rule: 'unclosed-code-fence',
      message: '代码块未闭合：缺少结束的围栏标记（``` 或 ~~~）',
    });
  }

  return codeLines;
}

function openingFence(line: string): Omit<FenceState, 'line'> | null {
  const info = fenceInfo(line);
  if (!info) {
    return null;
  }
  if (info.mark === '`' && info.rest.includes('`')) {
    return null;
  }
  return { mark: info.mark, size: info.size };
}

function isClosingFence(line: string, open: FenceState): boolean {
  const info = fenceInfo(line);
  return (
    !!info &&
    info.mark === open.mark &&
    info.size >= open.size &&
    info.rest.trim() === ''
  );
}

function fenceInfo(line: string): FenceInfo | null {
  const trimmed = line.replace(/^ {0,3}/, '');
  if (!trimmed) {
    return null;
  }

  const mark = trimmed[0];
  if (mark !== '`' && mark !== '~') {
    return null;
  }

  let size = 0;
  while (size < trimmed.length && trimmed[size] === mark) {
    size += 1;
  }
  if (size < 3) {
    return null;
  }

  return { mark, size, rest: trimmed.slice(size) };
}
