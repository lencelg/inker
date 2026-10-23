export function usesCrlf(value: string): boolean {
  return value.includes('\r\n');
}

export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

export function applyLineEnding(value: string, crlf: boolean): string {
  return crlf ? value.replace(/\r?\n/g, '\r\n') : value;
}
