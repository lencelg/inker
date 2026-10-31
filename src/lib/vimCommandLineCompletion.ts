import type { FileEntry } from '../types';
import { VIM_EX_COMPLETION_NAMES } from './vimExCommands';

export interface VimCompletionContext {
  notePath: string;
  files: readonly FileEntry[];
  commands?: readonly string[];
}

interface CompletionCandidate {
  value: string;
  cursor: number;
}

interface CompletionState {
  candidates: CompletionCandidate[];
  index: number;
  value: string;
  cursor: number;
}

const states = new WeakMap<HTMLInputElement, CompletionState>();

function normalizeDirectory(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.length > 0 ? `${parts.join('/')}/` : '';
}

function parentDirectory(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.slice(0, slash + 1) : '';
}

function entryName(entry: FileEntry): string {
  if (entry.name) return entry.name;
  const slash = entry.path.lastIndexOf('/');
  return slash >= 0 ? entry.path.slice(slash + 1) : entry.path;
}

function applyCandidate(
  input: HTMLInputElement,
  candidate: CompletionCandidate,
): void {
  input.value = candidate.value;
  input.setSelectionRange(candidate.cursor, candidate.cursor);
}

function commandCandidates(
  value: string,
  cursor: number,
  commands: readonly string[],
): CompletionCandidate[] {
  const before = value.slice(0, cursor);
  const match = /^(\s*)(\w+)$/.exec(before);
  if (!match) return [];

  const leading = match[1];
  const typed = match[2];
  const after = value.slice(cursor);
  return commands
    .filter((command) => command.startsWith(typed))
    .sort()
    .map((command) => ({
      value: `${leading}${command}${after}`,
      cursor: leading.length + command.length,
    }));
}

function fileCandidates(
  value: string,
  cursor: number,
  context: VimCompletionContext,
): CompletionCandidate[] {
  const before = value.slice(0, cursor);
  const match = /^(\s*\w+\s+)(.*)$/.exec(before);
  if (!match) return [];

  const argument = match[2];
  const currentDirectory = parentDirectory(
    context.notePath.replace(/\\/g, '/'),
  );
  const slash = argument.lastIndexOf('/');
  const directoryPart = slash >= 0 ? argument.slice(0, slash + 1) : '';
  const base = slash >= 0 ? argument.slice(slash + 1) : argument;
  const baseStart = cursor - base.length;

  const resolvedDirectory = directoryPart.startsWith('/')
    ? normalizeDirectory(directoryPart.slice(1))
    : normalizeDirectory(`${currentDirectory}${directoryPart}`);

  const seen = new Set<string>();
  const names: string[] = [];
  for (const file of context.files) {
    const filePath = file.path.replace(/\\/g, '/');
    if (parentDirectory(filePath) !== resolvedDirectory) continue;
    const name = entryName(file);
    if (!name.startsWith(base)) continue;
    const full = `${name}${file.isDir ? '/' : ''}`;
    if (seen.has(full)) continue;
    seen.add(full);
    names.push(full);
  }

  names.sort((left, right) => left.localeCompare(right));
  return names.map((name) => ({
    value: `${value.slice(0, baseStart)}${name}${value.slice(cursor)}`,
    cursor: baseStart + name.length,
  }));
}

/**
 * Handles Tab completion for the Ex command prompt. Returns true when the
 * key press was handled (even if there were no candidates), so the caller
 * can keep the prompt focused instead of letting Tab move focus away.
 */
export function resolveVimNotePath(
  input: string,
  notePath: string,
): string | null {
  const value = input.trim().replace(/\\/g, '/');
  if (!value) return null;

  const current = parentDirectory(notePath.replace(/\\/g, '/'));
  const combined = value.startsWith('/')
    ? value.slice(1)
    : `${current}${value}`;
  const parts: string[] = [];
  for (const part of combined.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.length > 0 ? parts.join('/') : null;
}

export function completeVimCommandLine(
  input: HTMLInputElement,
  context: VimCompletionContext,
  forward = true,
): boolean {
  const value = input.value;
  const cursor = input.selectionStart ?? value.length;
  const state = states.get(input);

  if (
    state &&
    state.candidates.length > 1 &&
    state.value === value &&
    state.cursor === cursor
  ) {
    state.index =
      (state.index + (forward ? 1 : -1) + state.candidates.length) %
      state.candidates.length;
    const candidate = state.candidates[state.index];
    state.value = candidate.value;
    state.cursor = candidate.cursor;
    applyCandidate(input, candidate);
    return true;
  }

  const commands = context.commands ?? VIM_EX_COMPLETION_NAMES;
  const candidates = commandCandidates(value, cursor, commands);
  const all =
    candidates.length > 0
      ? candidates
      : fileCandidates(value, cursor, context);

  if (all.length === 0) {
    states.delete(input);
    return true;
  }

  const index = forward ? 0 : all.length - 1;
  const candidate = all[index];
  if (all.length > 1) {
    states.set(input, {
      candidates: all,
      index,
      value: candidate.value,
      cursor: candidate.cursor,
    });
  } else {
    states.delete(input);
  }
  applyCandidate(input, candidate);
  return true;
}
