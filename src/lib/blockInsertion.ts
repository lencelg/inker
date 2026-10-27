export interface BlockInsertion {
  text: string;
  cursor: number;
}

export function withBlockSpacing(
  doc: string,
  from: number,
  to: number,
  block: string,
): BlockInsertion {
  const newline = doc.includes('\r\n') ? '\r\n' : '\n';
  const content = block
    .replace(/\r\n/g, '\n')
    .replace(/\s+$/, '')
    .replace(/\n/g, newline);
  const before = doc.slice(0, from);
  const after = doc.slice(to);

  const leading =
    from === 0 || before.endsWith(newline + newline)
      ? ''
      : before.endsWith(newline)
        ? newline
        : newline + newline;
  const trailing =
    to >= doc.length || after.startsWith(newline + newline)
      ? ''
      : after.startsWith(newline)
        ? newline
        : newline + newline;

  const text = `${leading}${content}${trailing}`;
  return { text, cursor: from + text.length };
}
