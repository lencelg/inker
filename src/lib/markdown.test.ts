import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('fenced code rendering', () => {
  it('highlights code and shows its language', () => {
    const html = renderMarkdown(
      '```bash\n# merge\ngit merge feature\n```',
    );
    expect(html).toContain('class="code-block"');
    expect(html).toContain('class="code-language">bash');
    expect(html).toContain('hljs-');
  });

  it('keeps the language badge when highlighting is disabled', () => {
    const html = renderMarkdown(
      '```bash\n# merge\ngit merge feature\n```',
      { codeHighlight: false },
    );
    expect(html).toContain('class="code-language">bash');
    expect(html).not.toContain('hljs-');
  });

  it('detects a language for fences without info', () => {
    const html = renderMarkdown(
      '```\n# merge\ngit merge feature\n```',
    );
    expect(html).toMatch(/class="code-language">[^<]+<\/span>/);
  });
});
