import type { FileEntry } from '../types';

export function basename(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

export function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

export function isSameOrDescendant(path: string, ancestor: string): boolean {
  return path === ancestor || path.startsWith(`${ancestor}/`);
}

export function replacePrefix(path: string, oldPrefix: string, newPrefix: string): string {
  return isSameOrDescendant(path, oldPrefix)
    ? `${newPrefix}${path.slice(oldPrefix.length)}`
    : path;
}

export function ancestorDirs(path: string): string[] {
  const parent = dirname(path);
  if (!parent) return [];
  return [...ancestorDirs(parent), parent];
}

export function flattenFiles(entries: FileEntry[]): FileEntry[] {
  return entries.filter((entry) => !entry.isDir);
}
