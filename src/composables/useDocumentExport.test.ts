import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePreferences } from '../lib/preferences';
import type { PreparedExport } from '../lib/exportContent';
import { useDocumentExport } from './useDocumentExport';

const mocks = vi.hoisted(() => ({
  prepareExport: vi.fn(),
  saveHtmlExport: vi.fn(
    async (): Promise<string | null> => '/tmp/Note.html',
  ),
  openPath: vi.fn(async () => undefined),
}));

vi.mock('../lib/exportContent', () => ({
  prepareExport: mocks.prepareExport,
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
  mocks.saveHtmlExport.mockResolvedValue('/tmp/Note.html');
  mocks.openPath.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useDocumentExport', () => {
  it('prepares embedded and linked HTML variants', async () => {
    const { exporter } = setup();

    await exporter.exportHtml();

    expect(mocks.prepareExport).toHaveBeenCalledTimes(2);
    expect(exporter.htmlExport.value?.title).toBe('Note');
    expect(exporter.htmlExport.value?.embedded).toBeTruthy();
    expect(exporter.htmlExport.value?.linked).toBeTruthy();
    expect(exporter.htmlExport.value?.embeddedBytes).toBeGreaterThan(0);
    expect(exporter.exporting.value).toBe(false);
  });

  it('does nothing without an exportable tab', async () => {
    const { exporter, clearTab } = setup();
    clearTab();

    await exporter.exportHtml();

    expect(mocks.prepareExport).not.toHaveBeenCalled();
    expect(exporter.htmlExport.value).toBeNull();
  });

  it('reports preparation errors and resets busy state', async () => {
    const { exporter, setError } = setup();
    mocks.prepareExport.mockRejectedValue(new Error('export failed'));

    await exporter.exportHtml();

    expect(setError).toHaveBeenCalledTimes(1);
    expect(exporter.exporting.value).toBe(false);
  });

  it('saves the selected HTML variant', async () => {
    const { exporter, setPreferences } = setup();
    setPreferences(normalizePreferences({ exportOpenAfter: true }));
    await exporter.exportHtml();
    const linked = exporter.htmlExport.value?.linked;

    await exporter.saveHtml(false);

    expect(mocks.saveHtmlExport).toHaveBeenCalledWith(linked, {
      defaultDirectory: '/notes',
    });
    expect(exporter.htmlExport.value).toBeNull();
    expect(mocks.openPath).toHaveBeenCalledWith('/tmp/Note.html');
  });
});
