import hljs from 'highlight.js/lib/common';

export interface CodeHighlightRange {
  from: number;
  to: number;
  className: string;
}

function tokenClasses(element: Element | null): string {
  const classes = new Set<string>();
  let current: Element | null = element;
  while (current) {
    for (const name of current.classList) {
      if (name.startsWith('hljs-')) classes.add(name);
    }
    current = current.parentElement;
  }
  return [...classes].join(' ');
}

export function codeHighlightRanges(
  text: string,
  language = '',
): CodeHighlightRange[] {
  if (!text) return [];

  let html: string;
  try {
    html = language && hljs.getLanguage(language)
      ? hljs.highlight(text, { language, ignoreIllegals: true }).value
      : hljs.highlightAuto(text).value;
  } catch {
    return [];
  }

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const walker = document.createTreeWalker(
    parsed.body,
    NodeFilter.SHOW_TEXT,
  );
  const ranges: CodeHighlightRange[] = [];
  let offset = 0;
  let node = walker.nextNode();

  while (node) {
    const value = node.nodeValue ?? '';
    const length = value.length;
    const className = tokenClasses(node.parentElement);
    if (length > 0 && className) {
      ranges.push({
        from: offset,
        to: offset + length,
        className,
      });
    }
    offset += length;
    node = walker.nextNode();
  }

  return ranges;
}
