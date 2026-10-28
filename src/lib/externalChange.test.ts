import { describe, expect, it } from 'vitest';
import {
  classifyExternalChange,
  conflictedCopyPath,
} from './externalChange';

function classify(
  content: string,
  savedContent: string,
  diskContent: string,
  saving = false,
) {
  return classifyExternalChange({
    content,
    savedContent,
    diskContent,
    saving,
  });
}

describe('classifyExternalChange', () => {
  it('ignores unchanged disk content', () => {
    expect(classify('local', 'saved', 'saved')).toBe('ignore');
  });

  it('ignores events while the note is being saved', () => {
    expect(classify('local', 'saved', 'new disk', true)).toBe('ignore');
  });

  it('adopts disk content when it matches local content', () => {
    expect(classify('same', 'saved', 'same')).toBe('adopt');
  });

  it('reloads a clean tab when the disk changed', () => {
    expect(classify('saved', 'saved', 'new disk')).toBe('reload');
  });

  it('reports a conflict when local and disk changes differ', () => {
    expect(classify('local', 'saved', 'new disk')).toBe('conflict');
  });
});

describe('conflictedCopyPath', () => {
  it('builds a copy path next to nested notes', () => {
    expect(
      conflictedCopyPath('/notes', 'journal/day.md'),
    ).toBe('/notes/journal/day (conflicted copy).md');
  });

  it('works without an absolute workspace path', () => {
    expect(conflictedCopyPath(null, 'note.md')).toBe(
      'note (conflicted copy).md',
    );
  });
});
