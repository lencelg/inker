import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from './i18n';
import { prepareExport } from './exportContent';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    readAsset: vi.fn(),
    saveExport: vi.fn(),
  },
}));

const readAsset = vi.mocked(api.readAsset);

beforeEach(() => {
  setLanguage('en');
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.replaceChildren();
});

describe('HTML export preparation', () => {
  it('derives metadata from the first heading and export options', async () => {
    const prepared = await prepareExport(
      'notes/Ocean.md',
      '# Ocean Notes\n\nHello world.',
      {
        embedImages: true,
        codeTheme: 'github-dark',
        includeToc: false,
      },
    );

    expect(prepared.title).toBe('Ocean Notes');
    expect(prepared.documentHtml).toContain('<html lang="en">');
    expect(prepared.documentHtml).toContain(
      '<title>Ocean Notes</title>',
    );
    expect(prepared.documentHtml).toContain('--code-bg: #0d1117');
    expect(prepared.documentHtml).toContain(
      'name="generator" content="Inker"',
    );
  });

  it('uses the current locale for the document language', async () => {
    setLanguage('zh');
    const prepared = await prepareExport(
      'notes/中文.md',
      '# 标题\n\n正文',
      { includeToc: false },
    );

    expect(prepared.documentHtml).toContain('<html lang="zh-CN">');
    expect(prepared.title).toBe('标题');
  });

  it('generates a linked table of contents when enabled', async () => {
    const prepared = await prepareExport(
      'notes/toc.md',
      '# Title\n\n## First\n\nText\n\n## Second\n\nMore',
      { embedImages: true, includeToc: true },
    );

    expect(prepared.documentHtml).toContain('class="export-toc"');
    expect(prepared.documentHtml).toContain('href="#first"');
    expect(prepared.documentHtml).toContain('href="#second"');
  });

  it('embeds local images with data URLs', async () => {
    readAsset.mockResolvedValue({
      mime: 'image/png',
      data: 'iVBORw0KGgo=',
    });

    const prepared = await prepareExport(
      'notes/image.md',
      '# Image\n\n![cover](assets/cover.png)',
      { embedImages: true, includeToc: false },
    );

    expect(readAsset).toHaveBeenCalledWith(
      'notes/image.md',
      'assets/cover.png',
    );
    expect(prepared.documentHtml).toContain(
      'src="data:image/png;base64,iVBORw0KGgo="',
    );
  });

  it('keeps original image paths in linked mode', async () => {
    const prepared = await prepareExport(
      'notes/image.md',
      '# Image\n\n![cover](assets/cover.png)',
      { embedImages: false, includeToc: false },
    );

    expect(readAsset).not.toHaveBeenCalled();
    expect(prepared.documentHtml).toContain('src="assets/cover.png"');
    expect(prepared.documentHtml).not.toContain('data:image/png');
    expect(prepared.warnings).toHaveLength(0);
  });

  it('reports missing local images as warnings', async () => {
    readAsset.mockRejectedValue(new Error('missing'));

    const prepared = await prepareExport(
      'notes/image.md',
      '# Image\n\n![cover](assets/missing.png)',
      { embedImages: true, includeToc: false },
    );

    expect(prepared.warnings).toHaveLength(1);
    expect(prepared.warnings[0]).toContain('assets/missing.png');
    expect(prepared.documentHtml).toContain('md-image-missing');
  });
});
