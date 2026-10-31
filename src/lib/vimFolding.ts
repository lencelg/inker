import {
  foldAll,
  foldCode,
  foldEffect,
  foldable,
  foldedRanges,
  unfoldAll,
  unfoldEffect,
} from '@codemirror/language';
import type { EditorView } from '@codemirror/view';

function rangeAtCursor(view: EditorView): { from: number; to: number } | null {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  return foldable(view.state, line.from, line.to);
}

function isFolded(
  view: EditorView,
  range: { from: number; to: number },
): boolean {
  let found = false;
  foldedRanges(view.state).between(range.from, range.to, (from, to) => {
    if (from === range.from && to === range.to) {
      found = true;
      return false;
    }
  });
  return found;
}

export function toggleVimFold(view: EditorView): void {
  foldCode(view);
}

export function closeVimFold(view: EditorView): void {
  const range = rangeAtCursor(view);
  if (range && !isFolded(view, range)) {
    view.dispatch({ effects: foldEffect.of(range) });
  }
}

export function openVimFold(view: EditorView): void {
  const range = rangeAtCursor(view);
  if (range && isFolded(view, range)) {
    view.dispatch({ effects: unfoldEffect.of(range) });
  }
}

export function closeAllVimFolds(view: EditorView): void {
  foldAll(view);
}

export function openAllVimFolds(view: EditorView): void {
  unfoldAll(view);
}
