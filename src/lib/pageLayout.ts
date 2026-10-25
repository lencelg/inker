export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const PAGE_MARGIN_MM = 20;
export const PAGE_CONTENT_WIDTH_MM = PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2;
export const PAGE_CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2;

export const EXPORT_PAGE_STYLES = `
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; }
body { background: #e8edf3; }
.export-paged-staging {
  position: absolute;
  top: 0;
  left: -10000px;
  width: ${PAGE_WIDTH_MM}mm;
  visibility: hidden;
}
.export-page {
  position: relative;
  box-sizing: border-box;
  width: ${PAGE_WIDTH_MM}mm;
  height: ${PAGE_HEIGHT_MM}mm;
  padding: ${PAGE_MARGIN_MM}mm;
  overflow: hidden;
  background: #fff;
}
.export-page-content {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.export-page-content.export-body {
  max-width: none;
  margin: 0;
  padding: 0;
}
.export-page-content > :first-child { margin-top: 0; }
.export-page-content img { max-width: 100%; height: auto; }
.export-page-content .mermaid-block { max-height: 100%; overflow: hidden; }
.export-page-content .export-fragment-continuation { margin-top: 0 !important; }
.export-page-content .export-fragment-split { margin-bottom: 0 !important; }
.export-page-number {
  position: absolute;
  right: 0;
  bottom: 8mm;
  left: 0;
  color: #6b7280;
  font-family: 'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
    'Noto Sans CJK SC', system-ui, sans-serif;
  font-size: 10px;
  line-height: 1.3;
  text-align: center;
}
@media screen {
  body { padding: 24px 0; }
  .export-page {
    margin: 0 auto 24px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16);
  }
}
@media print {
  body { padding: 0; background: #fff; zoom: 1 !important; }
  .export-page {
    margin: 0;
    box-shadow: none;
    break-after: page;
    page-break-after: always;
  }
  .export-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }
  .export-page-number {
    color: #57606a;
  }
}
`;

export const DOCX_PREVIEW_STYLES = `
.export-page-content.docx-export-preview {
  color: #1f2933;
  font-size: 14.6667px;
  line-height: 24px;
}
.export-page-content.docx-export-preview h1,
.export-page-content.docx-export-preview h2,
.export-page-content.docx-export-preview h3,
.export-page-content.docx-export-preview h4,
.export-page-content.docx-export-preview h5,
.export-page-content.docx-export-preview h6 {
  border: 0;
  padding: 0;
  letter-spacing: 0;
}
.export-page-content.docx-export-preview h1 {
  margin: 18.67px 0 8px;
  font-size: 24px;
  line-height: 31.2px;
}
.export-page-content.docx-export-preview h2 {
  margin: 16px 0 6.67px;
  font-size: 20px;
  line-height: 26px;
}
.export-page-content.docx-export-preview h3 {
  margin: 13.33px 0 5.33px;
  font-size: 17.3333px;
  line-height: 22.53px;
}
.export-page-content.docx-export-preview h4 {
  margin: 10.67px 0 4px;
  font-size: 16px;
  line-height: 20.8px;
}
.export-page-content.docx-export-preview h5,
.export-page-content.docx-export-preview h6 {
  margin: 8px 0 4px;
  font-size: 14.6667px;
  line-height: 19.07px;
}
.export-page-content.docx-export-preview h6 { color: #57606a; }
.export-page-content.docx-export-preview p { margin: 0 0 8px; }
.export-page-content.docx-export-preview ul,
.export-page-content.docx-export-preview ol { margin: 0 0 8px; }
.export-page-content.docx-export-preview li { margin: 0 0 3px; }
.export-page-content.docx-export-preview blockquote {
  margin: 8px 0;
  padding-left: 18px;
  border-left: 1px solid #d8dee4;
  color: #57606a;
  font-style: italic;
}
.export-page-content.docx-export-preview hr {
  margin: 10.67px 0;
  border-top: 1px solid #d8dee4;
}
.export-page-content.docx-export-preview .code-block { margin: 8px 0 10.67px; }
.export-page-content.docx-export-preview .code-language {
  margin: 0 0 2.67px;
  border: 0;
  background: transparent;
  color: #57606a;
  font-family: Consolas, ui-monospace, monospace;
  font-size: 8px;
  line-height: 12px;
}
.export-page-content.docx-export-preview pre {
  margin: 0;
  padding: 6px 8px;
  border: 1px solid #d8dee4;
  border-radius: 0;
  font-family: Consolas, ui-monospace, monospace;
  font-size: 12px;
  line-height: 16px;
  white-space: pre-wrap;
}
.export-page-content.docx-export-preview code {
  border-radius: 0;
  font-family: Consolas, ui-monospace, monospace;
  font-size: 13.3333px;
}
.export-page-content.docx-export-preview pre code { font-size: 12px; }
.export-page-content.docx-export-preview table {
  margin: 8px 0;
  border-collapse: collapse;
  font-size: 14.6667px;
}
.export-page-content.docx-export-preview th,
.export-page-content.docx-export-preview td {
  padding: 4px 5.33px;
  border: 1px solid #d8dee4;
}
.export-page-content.docx-export-preview th { background: transparent; }
.export-page-content.docx-export-preview .export-toc {
  margin: 0 0 14.67px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.export-page-content.docx-export-preview .export-toc-title {
  margin: 0 0 8px;
  color: #1f2933;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0;
}
.export-page-content.docx-export-preview .export-toc li { margin: 0 0 3px; }
.export-page-content.docx-export-preview .export-toc a {
  color: #1f2933;
  text-decoration: none;
}
`;
