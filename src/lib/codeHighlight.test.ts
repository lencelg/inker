import { beforeAll, describe, expect, it } from 'vitest';
import { codeHighlightRanges } from './codeHighlight';
import {
  ensureShikiLanguage,
  initShiki,
} from './shikiHighlighter';

beforeAll(async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await initShiki();
    if (await ensureShikiLanguage('javascript')) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
});

describe('code highlight ranges', () => {
  it('maps highlighted token classes back to source offsets', () => {
    const source = 'const answer = "yes";';
    const ranges = codeHighlightRanges(source, 'javascript');

    expect(ranges.length).toBeGreaterThan(0);
    const keyword = ranges.find((range) =>
      range.className.includes('tk-keyword'),
    );
    expect(keyword).toBeDefined();
    expect(source.slice(keyword?.from, keyword?.to)).toBe('const');

    const string = ranges.find((range) =>
      range.className.includes('tk-string'),
    );
    expect(string).toBeDefined();
    expect(source.slice(string?.from, string?.to)).toContain('yes');
  });

  it('returns no ranges when no language is supplied', () => {
    expect(
      codeHighlightRanges('function test() { return 1; }'),
    ).toEqual([]);
  });

  it('keeps offsets across multiple lines', () => {
    const source = 'const a = 1;\nconst b = 2;';
    const ranges = codeHighlightRanges(source, 'javascript');
    const second = ranges.find(
      (range) =>
        range.className.includes('tk-keyword') && range.from > 10,
    );
    expect(second).toBeDefined();
    expect(source.slice(second?.from, second?.to)).toBe('const');
  });

  it('returns no ranges for empty text', () => {
    expect(codeHighlightRanges('', 'javascript')).toEqual([]);
  });
});
