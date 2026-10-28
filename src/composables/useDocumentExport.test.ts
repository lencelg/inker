import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePreferences } from '../lib/preferences';
import type { PreparedExport } from '../lib/exportContent';
import { useDocumentExport } from './useDocumentExport';

const mocks = vi.hoisted(() => ({
  prepareExport: vi.fn(),
  buildDocxPreviewDocument: vi.fn(() => '<docx-preview>'),
  buildDocxBase64: vi.fn(async () => 'base64-docx'),
  saveDocxBase64: vi.fn(
    async (): Promise<string | null> => '/tmp/Note.docx',
  ),
  saveHtmlExport: vi.fn(
    async (): Promise<string | null> => '/tmp/Note.html',
  ),
  openPath: vi.fn(async () => undefined),
}));

vi.mock('../lib/exportContent', () => ({
  prepareExport: mocks.prepareExport,
  buildDocxPreviewDocument: mocks.buildDocxPreviewDocument,
  buildDocxBase64: mocks.buildDocxBase64,
  saveDocxBase64: mocks.saveDocxBase64,
  saveHtmlExport: mocks.saveHtmlExport,
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: mocks.openPath,
}));

function prepared(title = 'Note'): PreparedExport {
  return {
    title,
    container: document.createElement('div'),
    contentHtml: '<h1>Note</h1>',
    documentHtml: '<html><body>Note</body></html>',
    warnings: ['warning'],
  };
}

function setup() {
  let tab: { path: string; content: string } | null = {
    path: 'note.md',
    content: '# Note',
  };
  let preferences = normalizePreferences({});
  const setError = vi.fn();
  const exporter = useDocumentExport({
    getTab: () => tab,
    getPreferences: () => preferences,
    getNotesDir: () => '/notes',
    setError,
  });

  return {
    exporter,
    setError,
    setPreferences: (next: typeof preferences) => {
      preferences = next;
    },
    clearTab: () => {
      tab = null;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prepareExport.mockImplementation(async () => prepared());
  mocks.buildDocxBase64.mockResolvedValue('base64-docx');
  mocks.saveDocxBase64.mockResolvedValue('/tmp/Note.docx');
  mocks.saveHtmlExport.mockResolvedValue('/tmp/Note.html');
  mocks.openPath.mockResolvedValue(undefined);
  vi.stubGlobal(
    'requestAnimationFrame',
    (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useDocumentExport', () => {
  it('prepares a PDF preview', async () => {
    const { exporter } = setup();

    await exporter.exportDocument('pdf');

    expect(mocks.prepareExport).toHaveBeenCalledTimes(1);
    expect(exporter.exportPreview.value).toMatchObject({
      format: 'pdf',
      title: 'Note',
      html: '<html><body>Note</body></html>',
      warnings: ['warning'],
    });
    expect(exporter.exporting.value).toBe(false);
  });

  it('prepares embedded and linked HTML variants', async () => {
    const { exporter } = setup();

    await exporter.exportDocument('html');

    expect(mocks.prepareExport).toHaveBeenCalledTimes(2);
    expect(exporter.htmlExport.value?.embedded).toBeTruthy();
    expect(exporter.htmlExport.value?.linked).toBeTruthy();
    expect(exporter.htmlExport.value?.embeddedBytes).toBeGreaterThan(0);
  });

  it('prepares a DOCX preview', async () => {
    const { exporter } = setup();

    await exporter.exportDocument('docx');

    expect(mocks.buildDocxPreviewDocument).toHaveBeenCalledTimes(1);
    expect(exporter.exportPreview.value).toMatchObject({
      format: 'docx',
      html: '<docx-preview>',
    });
    expect(exporter.exportPreview.value?.docxPrepared).toBeTruthy();
  });

  it('does nothing without an exportable tab', async () => {
    const { exporter, clearTab } = setup();
    clearTab();

    await exporter.exportDocument('pdf');

    expect(mocks.prepareExport).not.toHaveBeenCalled();
    expect(exporter.exportPreview.value).toBeNull();
  });

  it('reports preparation errors and resets busy state', async () => {
    const { exporter, setError } = setup();
    mocks.prepareExport.mockRejectedValue(new Error('export failed'));

    await exporter.exportDocument('pdf');

    expect(setError).toHaveBeenCalledTimes(1);
    expect(exporter.exporting.value).toBe(false);
  });

  it('saves a DOCX export and optionally opens it', async () => {
    const { exporter, setPreferences } = setup();
    setPreferences(normalizePreferences({ exportOpenAfter: true }));
    await exporter.exportDocument('docx');

    await exporter.saveDocx();

    expect(mocks.saveDocxBase64).toHaveBeenCalledWith(
      'Note',
      'base64-docx',
    );
    expect(exporter.exportPreview.value).toBeNull();
    expect(mocks.openPath).toHaveBeenCalledWith('/tmp/Note.docx');
  });

  it('keeps the preview when DOCX saving is cancelled', async () => {
    const { exporter } = setup();
    await exporter.exportDocument('docx');
    mocks.saveDocxBase64.mockResolvedValue(null);

    await exporter.saveDocx();

    expect(exporter.exportPreview.value).not.toBeNull();
    expect(mocks.openPath).not.toHaveBeenCalled();
  });

  it('saves the selected HTML variant', async () => {
    const { exporter, setPreferences } = setup();
    setPreferences(normalizePreferences({ exportOpenAfter: true }));
    await exporter.exportDocument('html');
    const linked = exporter.htmlExport.value?.linked;

    await exporter.saveHtml(false);

    expect(mocks.saveHtmlExport).toHaveBeenCalledWith(linked, {
      defaultDirectory: '/notes',
    });
    expect(exporter.htmlExport.value).toBeNull();
    expect(mocks.openPath).toHaveBeenCalledWith('/tmp/Note.html');
  });
});
