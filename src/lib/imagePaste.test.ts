import { describe, expect, it } from 'vitest';
import {
  buildImageFileName,
  clampImageQuality,
  convertImageFile,
  encodeMarkdownImagePath,
  extensionForFormat,
  imageFilesFrom,
  isImageFormat,
  mimeForFormat,
  renderImageName,
  sanitizeImageStem,
  shouldConvert,
  stripImageExtension,
} from './imagePaste';

describe('image formats', () => {
  it('recognizes supported formats', () => {
    expect(isImageFormat('png')).toBe(true);
    expect(isImageFormat('jpeg')).toBe(true);
    expect(isImageFormat('webp')).toBe(true);
    expect(isImageFormat('gif')).toBe(false);
    expect(isImageFormat(null)).toBe(false);
  });

  it('maps extensions and MIME types', () => {
    expect(extensionForFormat('png')).toBe('png');
    expect(extensionForFormat('jpeg')).toBe('jpg');
    expect(extensionForFormat('webp')).toBe('webp');
    expect(mimeForFormat('png')).toBe('image/png');
    expect(mimeForFormat('jpeg')).toBe('image/jpeg');
    expect(mimeForFormat('webp')).toBe('image/webp');
  });

  it('clamps quality', () => {
    expect(clampImageQuality(0.92)).toBe(0.92);
    expect(clampImageQuality(0.92)).toBe(0.92);
    expect(clampImageQuality(0)).toBe(0.1);
    expect(clampImageQuality(2)).toBe(1);
    expect(clampImageQuality(Number.NaN)).toBe(0.92);
  });
});

describe('sanitizeImageStem', () => {
  it('keeps letters, numbers, hyphens and underscores', () => {
    expect(sanitizeImageStem('screen-shot_1')).toBe('screen-shot_1');
    expect(sanitizeImageStem('我的图片')).toBe('我的图片');
  });

  it('turns spaces and dots into hyphens and drops unsafe characters', () => {
    expect(sanitizeImageStem('screen shot.png')).toBe('screen-shot-png');
    expect(sanitizeImageStem('../a/b:c')).toBe('abc');
    expect(sanitizeImageStem('  我的 图片.. ')).toBe('我的-图片');
  });

  it('falls back and trims', () => {
    expect(sanitizeImageStem('')).toBe('image');
    expect(sanitizeImageStem('---')).toBe('image');
    expect(sanitizeImageStem('--abc--')).toBe('abc');
  });

  it('avoids Windows reserved device names', () => {
    expect(sanitizeImageStem('CON')).toBe('CON-image');
    expect(sanitizeImageStem('com1')).toBe('com1-image');
    expect(sanitizeImageStem('console')).toBe('console');
  });

  it('limits the stem to 48 characters', () => {
    expect(sanitizeImageStem('a'.repeat(60))).toHaveLength(48);
  });
});

describe('stripImageExtension', () => {
  it('removes known image extensions', () => {
    expect(stripImageExtension('photo.JPG')).toBe('photo');
    expect(stripImageExtension('a.b.png')).toBe('a.b');
    expect(stripImageExtension('noext')).toBe('noext');
    expect(stripImageExtension('note.md')).toBe('note.md');
  });
});

describe('renderImageName', () => {
  const now = new Date(2026, 9, 27, 14, 3, 9);

  it('renders date and time tokens', () => {
    expect(renderImageName('{date}', { notePath: 'a.md', now })).toBe(
      '2026-10-27',
    );
    expect(renderImageName('{time}', { notePath: 'a.md', now })).toBe(
      '14-03-09',
    );
    expect(renderImageName('{datetime}', { notePath: 'a.md', now })).toBe(
      '20261027-140309',
    );
    expect(renderImageName('{timestamp}', { notePath: 'a.md', now })).toBe(
      String(now.getTime()),
    );
  });

  it('renders note names without markdown extensions', () => {
    expect(
      renderImageName('{note}', {
        notePath: 'notes/sub/我的笔记.md',
        now,
      }),
    ).toBe('我的笔记');
    expect(
      renderImageName('x-{note}', {
        notePath: 'notes/sub/plan.markdown',
        now,
      }),
    ).toBe('x-plan');
  });

  it('supports Chinese aliases', () => {
    expect(
      renderImageName('{日期}-{时间}-{笔记}', {
        notePath: '笔记.md',
        now,
      }),
    ).toBe('2026-10-27-14-03-09-笔记');
  });

  it('leaves unknown tokens as sanitized literal text', () => {
    expect(renderImageName('x-{unknown}', { notePath: 'a.md', now })).toBe(
      'x-unknown',
    );
    expect(renderImageName('', { notePath: 'a.md', now })).toBe('image');
  });
});

describe('file names and paths', () => {
  it('builds a file name from the stem and format', () => {
    expect(buildImageFileName('photo.JPG', 'png')).toBe('photo.png');
    expect(buildImageFileName('', 'jpeg')).toBe('image.jpg');
    expect(buildImageFileName('我的 图片', 'webp')).toBe('我的-图片.webp');
  });

  it('encodes markdown image paths without touching separators', () => {
    expect(encodeMarkdownImagePath('../assets/my image(1).png')).toBe(
      '../assets/my%20image%281%29.png',
    );
    expect(encodeMarkdownImagePath('assets/中文.png')).toBe(
      'assets/%E4%B8%AD%E6%96%87.png',
    );
  });

  it('decides when conversion is needed', () => {
    expect(shouldConvert('image/png', 'png')).toBe(false);
    expect(shouldConvert('image/jpeg', 'jpeg')).toBe(false);
    expect(shouldConvert('image/jpg', 'jpeg')).toBe(false);
    expect(shouldConvert('image/png', 'jpeg')).toBe(true);
    expect(shouldConvert('', 'png')).toBe(true);
  });

  it('passes through files already in the target format', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await expect(convertImageFile(file, 'png', 0.9)).resolves.toBe(file);
  });
});

describe('imageFilesFrom', () => {
  it('reads image files from clipboard items', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const data = {
      items: [
        { kind: 'file', type: 'image/png', getAsFile: () => file },
        { kind: 'file', type: 'text/plain', getAsFile: () => null },
      ],
      files: [],
    } as unknown as DataTransfer;

    expect(imageFilesFrom(data)).toEqual([file]);
  });

  it('falls back to files and ignores empty input', () => {
    const file = new File(['x'], 'b.jpg', { type: 'image/jpeg' });
    const data = {
      items: [],
      files: [file, new File(['x'], 'c.txt', { type: 'text/plain' })],
    } as unknown as DataTransfer;

    expect(imageFilesFrom(data)).toEqual([file]);
    expect(imageFilesFrom(null)).toEqual([]);
  });
});
