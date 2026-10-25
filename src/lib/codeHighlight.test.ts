import { describe, expect, it } from 'vitest';
import { codeHighlightRanges } from './codeHighlight';

describe('code highlight ranges', () => {
  it('maps highlighted token classes back to source offsets', () => {
    const source = 'const answer = "yes";';
    const ranges = codeHighlightRanges(source, 'javascript');

    expect(ranges.length).toBeGreaterThan(0);
    const keyword = ranges.find((range) =>
      range.className.includes('hljs-keyword'),
    );
    expect(keyword).toBeDefined();
    expect(source.slice(keyword?.from, keyword?.to)).toBe('const');

    const string = ranges.find((range) =>
      range.className.includes('hljs-string'),
    );
    expect(string).toBeDefined();
    expect(source.slice(string?.from, string?.to)).toContain('yes');
  });

  it('detects a language when none is supplied', () => {
    const ranges = codeHighlightRanges('function test() { return 1; }');
    expect(ranges.length).toBeGreaterThan(0);
  });

  it('returns no ranges for empty text', () => {
    expect(codeHighlightRanges('', 'javascript')).toEqual([]);
  });
});
