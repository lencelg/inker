import { Schema } from '@milkdown/kit/prose/model';
import { SelectionRange } from '@milkdown/kit/prose/state';
import { describe, expect, it } from 'vitest';
import { MultiRangeSelection } from './proseMultiCursor';

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', group: 'block' },
    text: { group: 'inline' },
  },
  marks: {},
});

function createDoc(): ReturnType<typeof schema.node> {
  return schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text('alpha')]),
    schema.node('paragraph', null, [schema.text('beta')]),
  ]);
}

function cursor(doc: ReturnType<typeof schema.node>, position: number) {
  const resolved = doc.resolve(position);
  return new SelectionRange(resolved, resolved);
}

describe('MultiRangeSelection', () => {
  it('keeps cursors sorted and reports the first range', () => {
    const doc = createDoc();
    const selection = new MultiRangeSelection([
      cursor(doc, 9),
      cursor(doc, 3),
    ]);

    expect(selection.ranges).toHaveLength(2);
    expect(selection.ranges[0].$from.pos).toBe(3);
    expect(selection.ranges[1].$from.pos).toBe(9);
    expect(selection.from).toBe(3);
  });

  it('serializes its ranges', () => {
    const doc = createDoc();
    const selection = new MultiRangeSelection([
      cursor(doc, 3),
      new SelectionRange(doc.resolve(8), doc.resolve(10)),
    ]);

    expect(selection.toJSON()).toEqual({
      type: 'multi_range',
      ranges: [
        { from: 3, to: 3 },
        { from: 8, to: 10 },
      ],
    });
  });
});
