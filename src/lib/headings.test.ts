import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { activeHeadingTrail, collectHeadings } from './headings';

const SOURCE = [
  '# Frontend Basis',
  '',
  'Intro',
  '## Bundlers + Transpilers',
  '',
  '### Loaders',
  'Body',
  '## Testing',
  '```md',
  '# Not a heading',
  '```',
  'Setext title',
  '---',
].join('\n');

function state(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown()],
  });
}

describe('heading breadcrumbs', () => {
  it('collects ATX and setext headings while ignoring code blocks', () => {
    const headings = collectHeadings(state(SOURCE));

    expect(
      headings.map(({ level, line, text }) => ({ level, line, text })),
    ).toEqual([
      { level: 1, line: 1, text: 'Frontend Basis' },
      { level: 2, line: 4, text: 'Bundlers + Transpilers' },
      { level: 3, line: 6, text: 'Loaders' },
      { level: 2, line: 8, text: 'Testing' },
      { level: 2, line: 12, text: 'Setext title' },
    ]);
  });

  it('strips inline formatting from heading labels', () => {
    const headings = collectHeadings(
      state('## **Bold** [Link](https://example.com) `code`\n'),
    );

    expect(headings[0]?.text).toBe('Bold Link code');
  });

  it('returns the ancestor path for the cursor line', () => {
    const headings = collectHeadings(state(SOURCE));
    const labels = (line: number): string[] =>
      activeHeadingTrail(headings, line).map((heading) => heading.text);

    expect(labels(0)).toEqual([]);
    expect(labels(1)).toEqual(['Frontend Basis']);
    expect(labels(3)).toEqual(['Frontend Basis']);
    expect(labels(4)).toEqual([
      'Frontend Basis',
      'Bundlers + Transpilers',
    ]);
    expect(labels(7)).toEqual([
      'Frontend Basis',
      'Bundlers + Transpilers',
      'Loaders',
    ]);
    expect(labels(8)).toEqual(['Frontend Basis', 'Testing']);
    expect(labels(13)).toEqual(['Frontend Basis', 'Setext title']);
  });
});
