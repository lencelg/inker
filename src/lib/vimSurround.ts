import type { ChangeSpec } from '@codemirror/state';

export interface TextRange {
  from: number;
  to: number;
}

export interface SurroundPairSpec {
  open: string;
  close: string;
}

export interface SurroundPair extends SurroundPairSpec {
  openPos: number;
  closePos: number;
}

const SURROUND_CHARS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '<': '>',
  '"': '"',
  "'": "'",
  '`': '`',
  '*': '*',
  '_': '_',
  '~': '~',
};

export function surroundPair(
  character: string,
): SurroundPairSpec | null {
  const close = SURROUND_CHARS[character];
  return close ? { open: character, close } : null;
}

export function findSurroundPair(
  text: string,
  offset: number,
  character: string,
): SurroundPair | null {
  const spec = surroundPair(character);
  if (!spec) return null;

  const openPos = text.lastIndexOf(spec.open, Math.max(0, offset));
  if (openPos < 0) return null;

  const closePos = text.indexOf(spec.close, openPos + spec.open.length);
  if (closePos < 0 || closePos <= openPos) return null;

  return {
    open: spec.open,
    close: spec.close,
    openPos,
    closePos,
  };
}

export function addSurroundChanges(
  ranges: readonly TextRange[],
  spec: SurroundPairSpec,
): ChangeSpec[] {
  const changes: ChangeSpec[] = [];
  for (const range of ranges) {
    const from = Math.min(range.from, range.to);
    const to = Math.max(range.from, range.to);
    if (from === to) {
      changes.push({ from, to, insert: spec.open + spec.close });
    } else {
      changes.push({ from, insert: spec.open });
      changes.push({ from: to, insert: spec.close });
    }
  }
  return changes;
}

export function replaceSurroundChanges(
  pair: SurroundPair,
  spec: SurroundPairSpec,
): ChangeSpec[] {
  return [
    {
      from: pair.closePos,
      to: pair.closePos + pair.close.length,
      insert: spec.close,
    },
    {
      from: pair.openPos,
      to: pair.openPos + pair.open.length,
      insert: spec.open,
    },
  ];
}

export function deleteSurroundChanges(
  pair: SurroundPair,
): ChangeSpec[] {
  return [
    {
      from: pair.closePos,
      to: pair.closePos + pair.close.length,
      insert: '',
    },
    {
      from: pair.openPos,
      to: pair.openPos + pair.open.length,
      insert: '',
    },
  ];
}
