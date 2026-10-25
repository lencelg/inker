import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { prepareExport } from './exportContent';
import { docxToBase64 } from './docxExport';

const MARKDOWN = [
  '# Integration Export',
  '',
  'Inline math $E = mc^2$ and a table:',
  '',
  '## Details',
  '',
  '| Name | Value |',
  '| --- | --- |',
  '| Alpha | 1 |',
  '',
  '- First',
  '- Second',
  '',
  '1. One',
  '2. Two',
  '',
  '```ts',
  'const answer = 42;',
  '```',
  '',
  '$$',
  '\\frac{a}{b}',
  '$$',
].join('\n');

describe('export integration', () => {
  it('converts prepared markdown into a DOCX with equations and structure', async () => {
    const prepared = await prepareExport('notes/export.md', MARKDOWN, {
      embedImages: true,
      includeToc: true,
      codeTheme: 'github-dark',
    });

    expect(prepared.title).toBe('Integration Export');
    expect(prepared.documentHtml).toContain('class="export-toc"');

    const base64 = await docxToBase64(
      prepared.container,
      prepared.title,
      { codeTheme: 'github-dark', includeToc: true },
    );
    const archive = await JSZip.loadAsync(base64, { base64: true });
    const file = archive.file('word/document.xml');
    expect(file).not.toBeNull();
    const xml = await file?.async('string');

    expect(xml).toContain('m:oMath');
    expect(xml).toContain('w:numPr');
    expect(xml).toContain('w:tblBorders');
    expect(xml).toContain('TOC');
  });
});
