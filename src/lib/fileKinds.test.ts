import { describe, expect, it } from 'vitest';
import { fileExtension, isImagePath } from './fileKinds';

describe('file kinds', () => {
  it('recognizes supported image paths case-insensitively', () => {
    expect(isImagePath('assets/cover.png')).toBe(true);
    expect(isImagePath('assets/photo.JPG')).toBe(true);
    expect(isImagePath('diagram.svg')).toBe(true);
    expect(isImagePath('notes/today.md')).toBe(false);
    expect(isImagePath('folder/image')).toBe(false);
  });

  it('extracts the final extension', () => {
    expect(fileExtension('a/b/photo.webp')).toBe('webp');
    expect(fileExtension('no-extension')).toBe('');
  });
});
