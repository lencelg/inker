import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { docxToBase64 } from './docxExport';

function container(markup: string): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = markup;
  return element;
}

async function documentXml(base64: string): Promise<string> {
  const archive = await JSZip.loadAsync(base64, { base64: true });
  const file = archive.file('word/document.xml');
  if (!file) throw new Error('document.xml missing');
  return file.async('string');
}

describe('DOCX export', () => {
  it('preserves headings, native lists, tables, code, math, and links', async () => {
    const base64 = await docxToBase64(
      container(`
        <h1 id="title">Document Title</h1>
        <h2 id="install">Install</h2>
        <p>See <a href="#install">the install section</a>.</p>
        <ul>
          <li>First item</li>
          <li>Second item
            <ul><li>Nested item</li></ul>
          </li>
        </ul>
        <ol><li>Step one</li><li>Step two</li></ol>
        <table>
          <thead><tr><th>Name</th><th>Value</th></tr></thead>
          <tbody><tr><td>Alpha</td><td>1</td></tr></tbody>
        </table>
        <div class="code-block">
          <span class="code-language">js</span>
          <pre class="hljs"><code><span class="hljs-keyword">const</span> x = 1;</code></pre>
        </div>
        <p><span class="katex"><math><semantics><mrow><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mrow><annotation encoding="application/x-tex">E=mc^2</annotation></semantics></math></span></p>
      `),
      'Document Title',
      { codeTheme: 'github-dark', includeToc: true },
    );

    const xml = await documentXml(base64);
    const archive = await JSZip.loadAsync(base64, { base64: true });

    expect(xml).toContain('w:numPr');
    expect(xml).toContain('w:tblBorders');
    expect(xml).toContain('w:tblHeader');
    expect(xml).toContain('m:oMath');
    expect(xml).toContain('w:anchor="inkerHeading2"');
    expect(xml).toContain('TOC');
    expect(xml).toContain('w:fill="24292E"');
    expect(xml).toContain('w:color w:val="E1E4E8"');
    expect(Object.keys(archive.files)).toContain('word/footer1.xml');

    const core = archive.file('docProps/core.xml');
    expect(core).not.toBeNull();
    expect(await core?.async('string')).toContain('Document Title');
  });

  it('omits the generated TOC when disabled', async () => {
    const base64 = await docxToBase64(
      container('<h1>One</h1><h2>Two</h2><p>Body</p>'),
      'No TOC',
      { includeToc: false },
    );

    const xml = await documentXml(base64);
    expect(xml).not.toContain('TOC \\o');
  });
});
