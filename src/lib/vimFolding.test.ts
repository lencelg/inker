import {
  codeFolding,
  foldable,
  foldedRanges,
} from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import {
  closeAllVimFolds,
  closeVimFold,
  openAllVimFolds,
  openVimFold,
} from './vimFolding';

const doc = '# A\nbody\n## A1\nmore\n# B\nend';

function makeState(): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown(), codeFolding()],
  });
}

describe('vim folding', () => {
  it('finds fold ranges for markdown headings', () => {
    const state = makeState();
    const heading = state.doc.line(1);
    expect(foldable(state, heading.from, heading.to)).toEqual({
      from: 3,
      to: 19,
    });

    const body = state.doc.line(2);
    expect(foldable(state, body.from, body.to)).toBeNull();
  });

  it('opens and closes folds at the cursor and globally', () => {
    const view = new EditorView({
      state: makeState(),
      parent: document.body,
    });
    view.dispatch({ selection: { anchor: 0 } });

    closeVimFold(view);
    expect(foldedRanges(view.state).size).toBe(1);

    openVimFold(view);
    expect(foldedRanges(view.state).size).toBe(0);

    closeAllVimFolds(view);
    expect(foldedRanges(view.state).size).toBeGreaterThan(0);

    openAllVimFolds(view);
    expect(foldedRanges(view.state).size).toBe(0);

    view.destroy();
  });
});
