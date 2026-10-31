import { describe, expect, it } from 'vitest';
import type { FileEntry } from '../types';
import { completeVimCommandLine } from './vimCommandLineCompletion';

function makeInput(value: string, cursor = value.length): HTMLInputElement {
  const input = document.createElement('input');
  input.value = value;
  input.setSelectionRange(cursor, cursor);
  document.body.append(input);
  return input;
}

const files: FileEntry[] = [
  { path: 'docs', name: 'docs', isDir: true },
  { path: 'docs/note.md', name: 'note.md', isDir: false },
  { path: 'docs/img', name: 'img', isDir: true },
  { path: 'docs/images', name: 'images', isDir: true },
  { path: 'docs/img/a.png', name: 'a.png', isDir: false },
  { path: 'other.md', name: 'other.md', isDir: false },
];

const context = { notePath: 'docs/note.md', files };

describe('Vim command-line completion', () => {
  it('completes Ex command names from the start of the line', () => {
    const input = makeInput('w');
    completeVimCommandLine(input, context);
    expect(input.value).toBe('write');
    expect(input.selectionStart).toBe(5);
  });

  it('cycles through command candidates with Tab and Shift+Tab', () => {
    const input = makeInput('s');
    completeVimCommandLine(input, context);
    expect(input.value).toBe('set');

    completeVimCommandLine(input, context);
    expect(input.value).toBe('setglobal');

    completeVimCommandLine(input, context);
    expect(input.value).toBe('setlocal');

    const backward = makeInput('s');
    completeVimCommandLine(backward, context, false);
    expect(backward.value).toBe('substitute');
  });

  it('recomputes after the user edits the command', () => {
    const input = makeInput('s');
    completeVimCommandLine(input, context);
    expect(input.value).toBe('set');

    input.value = 'se';
    input.setSelectionRange(2, 2);
    completeVimCommandLine(input, context);
    expect(input.value).toBe('set');
  });

  it('completes files relative to the current note', () => {
    const input = makeInput('w im');
    completeVimCommandLine(input, context);
    expect(input.value).toBe('w images/');

    completeVimCommandLine(input, context);
    expect(input.value).toBe('w img/');
  });

  it('completes children of a typed directory', () => {
    const input = makeInput('w img/');
    completeVimCommandLine(input, context);
    expect(input.value).toBe('w img/a.png');
  });

  it('supports parent, current, and root-relative paths', () => {
    const parent = makeInput('w ../');
    completeVimCommandLine(parent, context);
    expect(parent.value).toBe('w ../docs/');

    const current = makeInput('w ./im');
    completeVimCommandLine(current, context);
    expect(current.value).toBe('w ./images/');

    const root = makeInput('w /');
    completeVimCommandLine(root, context);
    expect(root.value).toBe('w /docs/');
  });

  it('preserves text after the cursor', () => {
    const input = makeInput('w img!', 5);
    completeVimCommandLine(input, context);
    expect(input.value).toBe('w img/!');
    expect(input.selectionStart).toBe(6);
  });

  it('normalizes Windows-style separators in file paths', () => {
    const input = makeInput('w im');
    completeVimCommandLine(input, {
      notePath: 'docs\\note.md',
      files: [
        { path: 'docs\\img', name: 'img', isDir: true },
        { path: 'docs\\images', name: 'images', isDir: true },
      ],
    });
    expect(input.value).toBe('w images/');
  });

  it('keeps the prompt usable when there are no candidates', () => {
    const input = makeInput('w zzz');
    expect(completeVimCommandLine(input, context)).toBe(true);
    expect(input.value).toBe('w zzz');
  });
});
