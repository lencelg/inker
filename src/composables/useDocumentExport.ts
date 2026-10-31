import { ref } from 'vue';
import { openPath } from '@tauri-apps/plugin-opener';
import type { PreparedExport } from '../lib/exportContent';
import type { Preferences } from '../lib/preferences';

type ExportContentModule = typeof import('../lib/exportContent');
let exportContentPromise: Promise<ExportContentModule> | null = null;

function loadExportContent(): Promise<ExportContentModule> {
  exportContentPromise ??= import('../lib/exportContent');
  return exportContentPromise;
}

export interface HtmlExportState {
  title: string;
  embedded: PreparedExport;
  linked: PreparedExport;
  embeddedBytes: number;
  linkedBytes: number;
  warnings: string[];
}

export interface ExportableTab {
  path: string;
  content: string;
}

export interface DocumentExportOptions {
  getTab: () => ExportableTab | null;
  getPreferences: () => Preferences;
  getNotesDir: () => string | null;
  setError: (error: unknown) => void;
}

export function useDocumentExport(options: DocumentExportOptions) {
  const exporting = ref(false);
  const htmlExport = ref<HtmlExportState | null>(null);

  async function openExportedFile(path: string): Promise<void> {
    try {
      await openPath(path);
    } catch (error) {
      options.setError(error);
    }
  }

  async function exportHtml(): Promise<void> {
    const tab = options.getTab();
    if (!tab || exporting.value) return;

    exporting.value = true;
    try {
      const preferences = options.getPreferences();
      const { prepareExport } = await loadExportContent();
      const commonOptions = {
        codeHighlight: preferences.codeHighlight,
        codeTheme: preferences.codeTheme,
        includeToc: preferences.exportIncludeToc,
      };
      const [embedded, linked] = await Promise.all([
        prepareExport(tab.path, tab.content, {
          ...commonOptions,
          embedImages: true,
        }),
        prepareExport(tab.path, tab.content, {
          ...commonOptions,
          embedImages: false,
        }),
      ]);
      htmlExport.value = {
        title: embedded.title,
        embedded,
        linked,
        embeddedBytes: new TextEncoder().encode(
          embedded.documentHtml,
        ).length,
        linkedBytes: new TextEncoder().encode(
          linked.documentHtml,
        ).length,
        warnings: [...new Set(embedded.warnings)],
      };
    } catch (error) {
      options.setError(error);
    } finally {
      exporting.value = false;
    }
  }

  async function saveHtml(embedded: boolean): Promise<void> {
    const current = htmlExport.value;
    if (!current || exporting.value) return;

    exporting.value = true;
    try {
      const { saveHtmlExport } = await loadExportContent();
      const prepared = embedded ? current.embedded : current.linked;
      const path = await saveHtmlExport(prepared, {
        defaultDirectory: embedded
          ? undefined
          : options.getNotesDir() ?? undefined,
      });
      if (!path) return;
      htmlExport.value = null;
      if (options.getPreferences().exportOpenAfter) {
        await openExportedFile(path);
      }
    } catch (error) {
      options.setError(error);
    } finally {
      exporting.value = false;
    }
  }

  return {
    exporting,
    htmlExport,
    exportHtml,
    saveHtml,
  };
}
