export interface MinimapChunk {
  start: number;
  end: number;
}

/**
 * Splits a logical line into one chunk per visual row, preferring to break at
 * the last space in the second half of the chunk.
 */
export function splitMinimapChunks(
  text: string,
  visualRows: number,
): MinimapChunk[] {
  if (visualRows <= 1) {
    return [{ start: 0, end: text.length }];
  }
  const chunks: MinimapChunk[] = [];
  let offset = 0;
  for (let row = 0; row < visualRows - 1; row += 1) {
    if (offset >= text.length) break;
    const remainingRows = visualRows - row;
    let end =
      offset +
      Math.max(1, Math.ceil((text.length - offset) / remainingRows));
    end = Math.min(text.length, end);
    if (end >= text.length) break;
    const minimum = offset + Math.max(1, Math.floor((end - offset) / 2));
    const space = text.lastIndexOf(' ', end);
    if (space >= minimum) end = space + 1;
    chunks.push({ start: offset, end });
    offset = end;
  }
  if (offset < text.length) {
    chunks.push({ start: offset, end: text.length });
  }
  while (chunks.length < visualRows) {
    chunks.push({ start: text.length, end: text.length });
  }
  return chunks.slice(0, visualRows);
}
