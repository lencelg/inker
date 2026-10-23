import type { Node } from '@milkdown/kit/prose/model';
import {
  Plugin,
  Selection,
  SelectionRange,
  TextSelection,
} from '@milkdown/kit/prose/state';
import type { Mappable } from '@milkdown/kit/prose/transform';
import {
  Decoration,
  DecorationSet,
  type EditorView,
} from '@milkdown/kit/prose/view';

function rangeFrom(range: SelectionRange): number {
  return range.$from.pos;
}

function rangeTo(range: SelectionRange): number {
  return range.$to.pos;
}

function sortRanges(ranges: SelectionRange[]): SelectionRange[] {
  return [...ranges].sort(
    (left, right) =>
      rangeFrom(left) - rangeFrom(right) ||
      rangeTo(left) - rangeTo(right),
  );
}

function mainRange(selection: Selection): SelectionRange {
  return selection.ranges[0];
}

export class MultiRangeSelection extends Selection {
  constructor(ranges: SelectionRange[]) {
    const sorted = sortRanges(ranges);
    super(sorted[0].$from, sorted[0].$to, sorted);
  }

  map(doc: Node, mapping: Mappable): Selection {
    const ranges = this.ranges
      .map((range) => {
        const from = doc.resolve(mapping.map(rangeFrom(range)));
        const to = doc.resolve(mapping.map(rangeTo(range)));
        if (!from.parent.inlineContent || !to.parent.inlineContent) {
          return null;
        }
        return new SelectionRange(from, to);
      })
      .filter((range): range is SelectionRange => range !== null);

    if (ranges.length === 0) {
      return Selection.near(doc.resolve(mapping.map(this.head)));
    }
    return new MultiRangeSelection(ranges);
  }

  eq(other: Selection): boolean {
    if (
      !(other instanceof MultiRangeSelection) ||
      other.ranges.length !== this.ranges.length
    ) {
      return false;
    }
    return this.ranges.every(
      (range, index) =>
        rangeFrom(range) === rangeFrom(other.ranges[index]) &&
        rangeTo(range) === rangeTo(other.ranges[index]),
    );
  }

  toJSON(): {
    type: string;
    ranges: { from: number; to: number }[];
  } {
    return {
      type: 'multi_range',
      ranges: this.ranges.map((range) => ({
        from: rangeFrom(range),
        to: rangeTo(range),
      })),
    };
  }
}

function currentRanges(selection: Selection): SelectionRange[] {
  return selection instanceof MultiRangeSelection
    ? [...selection.ranges]
    : [mainRange(selection)];
}

function addCursor(view: EditorView, position: number): boolean {
  const doc = view.state.doc;
  const resolved = doc.resolve(position);
  if (!resolved.parent.inlineContent) return false;

  const ranges = currentRanges(view.state.selection);
  if (
    ranges.some(
      (range) =>
        position >= rangeFrom(range) && position <= rangeTo(range),
    )
  ) {
    return false;
  }
  ranges.push(new SelectionRange(resolved, resolved));
  view.dispatch(
    view.state.tr
      .setSelection(new MultiRangeSelection(ranges))
      .scrollIntoView(),
  );
  return true;
}

function wordAt(doc: Node, position: number): SelectionRange | null {
  const resolved = doc.resolve(position);
  if (!resolved.parent.isTextblock) return null;
  const text = resolved.parent.textContent;
  const offset = resolved.parentOffset;
  const start = resolved.start();
  const isWord = (character: string): boolean =>
    /[\p{L}\p{N}_-]/u.test(character);

  let from = offset;
  let to = offset;
  while (from > 0 && isWord(text[from - 1])) from -= 1;
  while (to < text.length && isWord(text[to])) to += 1;
  if (from === to) return null;
  return new SelectionRange(
    doc.resolve(start + from),
    doc.resolve(start + to),
  );
}

function collectMatches(
  doc: Node,
  needle: string,
): { from: number; to: number }[] {
  const matches: { from: number; to: number }[] = [];
  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return;
    let index = node.text.indexOf(needle);
    while (index >= 0) {
      matches.push({
        from: position + index,
        to: position + index + needle.length,
      });
      index = node.text.indexOf(needle, index + needle.length);
    }
  });
  return matches;
}

function selectNextOccurrence(view: EditorView): boolean {
  const state = view.state;
  const ranges = currentRanges(state.selection);
  const main = ranges[0];
  const mainFrom = rangeFrom(main);
  const mainTo = rangeTo(main);

  if (mainFrom === mainTo) {
    const word = wordAt(state.doc, mainTo);
    if (!word) return false;
    view.dispatch(
      state.tr.setSelection(
        TextSelection.create(
          state.doc,
          rangeFrom(word),
          rangeTo(word),
        ),
      ),
    );
    return true;
  }

  const needle = state.doc.textBetween(mainFrom, mainTo, '\n');
  if (!needle.trim()) return false;

  const selected = new Set(
    ranges.map((range) => `${rangeFrom(range)}:${rangeTo(range)}`),
  );
  const matches = collectMatches(state.doc, needle);
  const next =
    matches.find(
      (match) =>
        match.from >= mainTo &&
        !selected.has(`${match.from}:${match.to}`),
    ) ??
    matches.find(
      (match) => !selected.has(`${match.from}:${match.to}`),
    );
  if (!next) return false;

  const nextRanges = [
    ...ranges,
    new SelectionRange(
      state.doc.resolve(next.from),
      state.doc.resolve(next.to),
    ),
  ];
  view.dispatch(
    state.tr
      .setSelection(new MultiRangeSelection(nextRanges))
      .scrollIntoView(),
  );
  return true;
}

function collapseSelections(view: EditorView): boolean {
  const selection = view.state.selection;
  if (!(selection instanceof MultiRangeSelection)) return false;
  view.dispatch(
    view.state.tr.setSelection(
      TextSelection.near(
        view.state.doc.resolve(rangeTo(mainRange(selection))),
      ),
    ),
  );
  return true;
}

function insertAcrossSelections(
  view: EditorView,
  text: string,
): boolean {
  const selection = view.state.selection;
  if (!(selection instanceof MultiRangeSelection)) return false;

  try {
    const descending = [...selection.ranges].sort(
      (left, right) => rangeFrom(right) - rangeFrom(left),
    );
    let transaction = view.state.tr;
    for (const range of descending) {
      transaction = transaction.insertText(
        text,
        rangeFrom(range),
        rangeTo(range),
      );
    }

    const cursors = selection.ranges.map((range) => {
      const position = transaction.mapping.map(rangeTo(range), 1);
      const resolved = transaction.doc.resolve(position);
      return new SelectionRange(resolved, resolved);
    });
    view.dispatch(
      transaction.setSelection(new MultiRangeSelection(cursors)),
    );
    return true;
  } catch {
    return false;
  }
}

function deleteAcrossSelections(
  view: EditorView,
  direction: -1 | 1,
): boolean {
  const selection = view.state.selection;
  if (!(selection instanceof MultiRangeSelection)) return false;

  try {
    const docSize = view.state.doc.content.size;
    const operations = selection.ranges
      .map((range) => {
        const from = rangeFrom(range);
        const to = rangeTo(range);
        if (from !== to) {
          return { from, to };
        }
        if (direction < 0 && from > 0) {
          return { from: from - 1, to: from };
        }
        if (direction > 0 && to < docSize) {
          return { from: to, to: to + 1 };
        }
        return null;
      })
      .filter(
        (operation): operation is { from: number; to: number } =>
          operation !== null,
      );

    if (operations.length === 0) return true;

    let transaction = view.state.tr;
    for (const operation of operations.sort(
      (left, right) => right.from - left.from,
    )) {
      transaction = transaction.delete(operation.from, operation.to);
    }

    const cursors = selection.ranges.map((range) => {
      const position = transaction.mapping.map(rangeFrom(range), -1);
      const resolved = transaction.doc.resolve(position);
      return new SelectionRange(resolved, resolved);
    });
    view.dispatch(
      transaction.setSelection(new MultiRangeSelection(cursors)),
    );
    return true;
  } catch {
    return false;
  }
}

function multiCursorDecorations(state: {
  doc: Node;
  selection: Selection;
}): DecorationSet | null {
  const selection = state.selection;
  if (!(selection instanceof MultiRangeSelection)) return null;

  const decorations = [];
  for (let index = 1; index < selection.ranges.length; index += 1) {
    const range = selection.ranges[index];
    const from = rangeFrom(range);
    const to = rangeTo(range);
    if (from === to) {
      decorations.push(
        Decoration.widget(
          from,
          () => {
            const caret = document.createElement('span');
            caret.className = 'pm-multi-caret';
            return caret;
          },
          { side: 1 },
        ),
      );
    } else {
      decorations.push(
        Decoration.inline(from, to, {
          class: 'pm-multi-selection',
        }),
      );
    }
  }
  return DecorationSet.create(state.doc, decorations);
}

export function createProseMultiCursorPlugin(): Plugin {
  return new Plugin({
    props: {
      handleTextInput: (view, _from, _to, text) =>
        insertAcrossSelections(view, text),
      handleKeyDown: (view, event) => {
        if (event.key === 'Escape') return collapseSelections(view);
        if (
          (event.ctrlKey || event.metaKey) &&
          !event.shiftKey &&
          event.key.toLowerCase() === 'd'
        ) {
          return selectNextOccurrence(view);
        }
        if (event.key === 'Backspace') {
          return deleteAcrossSelections(view, -1);
        }
        if (event.key === 'Delete') {
          return deleteAcrossSelections(view, 1);
        }
        return false;
      },
      handleDOMEvents: {
        mousedown: (view, event) => {
          if (!event.altKey) return false;
          const position = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (!position) return false;
          if (!addCursor(view, position.pos)) return false;
          event.preventDefault();
          return true;
        },
      },
      decorations: multiCursorDecorations,
    },
  });
}
