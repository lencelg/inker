import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

export interface BreadcrumbItem {
  level: number;
  text: string;
}

export interface HeadingItem extends BreadcrumbItem {
  line: number;
}

const HEADING_NODE = /^(ATX|Setext)Heading([1-6])$/;

function inlineText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\((?:[^()\\]|\\.)*\)/g, '$1')
    .replace(/\[([^\]]+)\]\((?:[^()\\]|\\.)*\)/g, '$1')
    .replace(/`+([^`]+)`+/g, '$1')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function headingText(raw: string, kind: 'ATX' | 'Setext'): string {
  const content =
    kind === 'ATX'
      ? raw
          .replace(/^ {0,3}#{1,6}(?:[ \t]+|$)/, '')
          .replace(/[ \t]+#+[ \t]*$/, '')
      : raw.replace(/\r?\n {0,3}(?:=+|-+)[ \t]*$/, '');
  return inlineText(content);
}

export function collectHeadings(state: EditorState): HeadingItem[] {
  const headings: HeadingItem[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      const match = HEADING_NODE.exec(node.name);
      if (!match) return undefined;

      headings.push({
        level: Number(match[2]),
        line: state.doc.lineAt(node.from).number,
        text: headingText(
          state.sliceDoc(node.from, node.to),
          match[1] as 'ATX' | 'Setext',
        ),
      });
      return false;
    },
  });
  return headings;
}

export function activeHeadingTrail(
  headings: readonly HeadingItem[],
  cursorLine: number,
): HeadingItem[] {
  const trail: HeadingItem[] = [];
  for (const heading of headings) {
    if (heading.line > cursorLine) break;
    while (
      trail.length > 0 &&
      trail[trail.length - 1].level >= heading.level
    ) {
      trail.pop();
    }
    trail.push(heading);
  }
  return trail;
}
