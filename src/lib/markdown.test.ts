import { beforeAll, describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';
import {
  ensureShikiLanguage,
  initShiki,
} from './shikiHighlighter';

beforeAll(async () => {
  await initShiki();
  await ensureShikiLanguage('shellscript');
});

describe('fenced code rendering', () => {
  it('highlights code and shows its language', () => {
    const html = renderMarkdown(
      '```bash\n# merge\ngit merge feature\n```',
    );
    expect(html).toContain('class="code-block"');
    expect(html).toContain('class="code-language">bash');
    expect(html).toContain('class="tk tk-');
  });

  it('keeps the language badge when highlighting is disabled', () => {
    const html = renderMarkdown(
      '```bash\n# merge\ngit merge feature\n```',
      { codeHighlight: false },
    );
    expect(html).toContain('class="code-language">bash');
    expect(html).not.toContain('class="tk tk-');
  });

  it('falls back to plain text for fences without info', () => {
    const html = renderMarkdown(
      '```\n# merge\ngit merge feature\n```',
    );
    expect(html).toContain('class="code-language">text');
    expect(html).not.toContain('class="tk tk-');
  });
});

describe('heading anchors', () => {
  it('adds stable ids for latin, formatted and duplicate headings', () => {
    const html = renderMarkdown(
      '# 安装\n\n## Install **Setup**\n\n## 安装',
    );

    expect(html).toContain('id="安装"');
    expect(html).toContain('id="install-setup"');
    expect(html).toContain('id="安装-1"');
  });
});
