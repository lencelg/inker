import type { FileEntry } from '../types';
import { isImagePath } from './fileKinds';
import { dirname } from './paths';

export type PaletteItemKind =
  | 'note'
  | 'image'
  | 'command'
  | 'theme'
  | 'back';

export interface PaletteItem {
  id: string;
  label: string;
  detail?: string;
  keywords?: string[];
  kind?: PaletteItemKind;
  disabled?: boolean;
}

export function fuzzyScore(query: string, text: string): number | null {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery === '') return 0;

  const candidate = text.toLocaleLowerCase();
  if (candidate === '') return null;
  if (candidate === normalizedQuery) return 1000;

  const index = candidate.indexOf(normalizedQuery);
  if (index === 0) {
    return 900 - Math.min(200, candidate.length - normalizedQuery.length);
  }
  if (index > 0) {
    return (
      700 -
      Math.min(300, index) -
      Math.min(100, candidate.length - normalizedQuery.length)
    );
  }

  let cursor = 0;
  let first = -1;
  let last = -1;
  let run = 0;
  let maxRun = 0;
  for (const character of normalizedQuery) {
    const found = candidate.indexOf(character, cursor);
    if (found === -1) return null;
    if (first === -1) first = found;
    run = last >= 0 && found === last + 1 ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
    last = found;
    cursor = found + 1;
  }

  const span = last - first + 1;
  return (
    300 +
    maxRun * 10 -
    Math.min(200, (span - normalizedQuery.length) * 2) -
    Math.min(100, first)
  );
}

function scoreItem(item: PaletteItem, query: string): number | null {
  const label = fuzzyScore(query, item.label);
  const detail =
    item.detail === undefined ? null : fuzzyScore(query, item.detail);
  let keyword: number | null = null;
  for (const value of item.keywords ?? []) {
    const score = fuzzyScore(query, value);
    if (score !== null) {
      keyword = Math.max(keyword ?? -Infinity, score);
    }
  }

  const scores = [
    label,
    detail === null ? null : detail - 150,
    keyword === null ? null : keyword - 400,
  ].filter((score): score is number => score !== null);
  return scores.length === 0 ? null : Math.max(...scores);
}

export function filterPaletteItems(
  items: readonly PaletteItem[],
  query: string,
): PaletteItem[] {
  if (query.trim() === '') return [...items];

  return items
    .map((item, index) => ({
      item,
      index,
      score: scoreItem(item, query),
    }))
    .filter(
      (
        entry,
      ): entry is { item: PaletteItem; index: number; score: number } =>
        entry.score !== null,
    )
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.item);
}

const SETTINGS_PERSISTENT_COMMANDS = new Set([
  'preferences.colorTheme',
  'preferences.codeTheme',
  'preferences.openSettings',
  'preferences.toggleVim',
  'preferences.toggleZen',
  'preferences.toggleAutoSave',
  'preferences.toggleQuickOpenImages',
  'file.save',
]);

export function commandKeepsSettingsOpen(commandId: string): boolean {
  return SETTINGS_PERSISTENT_COMMANDS.has(commandId);
}

export function buildFilePaletteItems(
  entries: readonly FileEntry[],
  includeImages: boolean,
  recentPaths: readonly string[] = [],
): PaletteItem[] {
  const recentOrder = new Map(
    recentPaths.map((path, index) => [path, index]),
  );

  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !entry.isDir)
    .filter(
      ({ entry }) => includeImages || !isImagePath(entry.path),
    )
    .sort((left, right) => {
      const leftRecent = recentOrder.get(left.entry.path);
      const rightRecent = recentOrder.get(right.entry.path);
      if (leftRecent !== undefined || rightRecent !== undefined) {
        if (leftRecent === undefined) return 1;
        if (rightRecent === undefined) return -1;
        if (leftRecent !== rightRecent) return leftRecent - rightRecent;
      }
      return left.index - right.index;
    })
    .map(({ entry }) => ({
      id: entry.path,
      label: entry.name,
      detail: dirname(entry.path),
      keywords: [entry.path],
      kind: isImagePath(entry.path) ? 'image' : 'note',
    }));
}
