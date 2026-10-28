import { markRaw, ref } from 'vue';
import { openPath } from '@tauri-apps/plugin-opener';
import {
  buildDocxBase64,
  buildDocxPreviewDocument,
  prepareExport,
  saveDocxBase64,
  saveHtmlExport,
  type PreparedExport,
  type SaveDocxOptions,
} from '../lib/exportContent';
import type { Preferences } from '../lib/preferences';

export interface ExportPreviewState {
  format: 'pdf' | 'docx';
  title: string;
  html: string;
  warnings: string[];
  docxPrepared?: PreparedExport;
  docxOptions?: SaveDocxOptions;
  docxBase64?: string;
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
  const exportPreview = ref<ExportPreviewState | null>(null);
  const htmlExport = ref<HtmlExportState | null>(null);

  async function openExportedFile(path: string): Promise<void> {
    try {
      await openPath(path);
    } catch (error) {
      options.setError(error);
    }
  }

  async function exportDocument(
    format: 'pdf' | 'html' | 'docx',
  ): Promise<void> {
    const tab = options.getTab();
    if (!tab || exporting.value) return;

    exporting.value = true;
    try {
      const preferences = options.getPreferences();
      const commonOptions = {
        codeHighlight: preferences.codeHighlight,
        codeTheme: preferences.codeTheme,
      };
      if (format === 'pdf') {
        const prepared = await prepareExport(
          tab.path,
          tab.content,
          {
            ...commonOptions,
            embedImages: true,
            includeToc: preferences.exportIncludeToc,
          },
        );
        exportPreview.value = {
          format: 'pdf',
          title: prepared.title,
          html: prepared.documentHtml,
          warnings: prepared.warnings,
        };
        return;
      }
      if (format === 'html') {
        const [embedded, linked] = await Promise.all([
          prepareExport(tab.path, tab.content, {
            ...commonOptions,
            embedImages: true,
            includeToc: preferences.exportIncludeToc,
          }),
          prepareExport(tab.path, tab.content, {
            ...commonOptions,
            embedImages: false,
            includeToc: preferences.exportIncludeToc,
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
        return;
      }

      const prepared = await prepareExport(tab.path, tab.content, {
        ...commonOptions,
        embedImages: true,
        includeToc: false,
      });
      exportPreview.value = {
        format: 'docx',
        title: prepared.title,
        html: buildDocxPreviewDocument(
          prepared,
          preferences.exportIncludeToc,
          preferences.codeTheme,
        ),
        warnings: prepared.warnings,
        docxPrepared: markRaw(prepared),
        docxOptions: {
          codeTheme: preferences.codeTheme,
          includeToc: preferences.exportIncludeToc,
        },
      };
    } catch (error) {
      options.setError(error);
    } finally {
      exporting.value = false;
    }
  }

  async function saveDocx(): Promise<void> {
    const current = exportPreview.value;
    if (
      !current ||
      current.format !== 'docx' ||
      !current.docxPrepared ||
      !current.docxOptions ||
      exporting.value
    ) {
      return;
    }

    exporting.value = true;
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      const base64 =
        current.docxBase64 ??
        (await buildDocxBase64(
          current.docxPrepared,
          current.docxOptions,
        ));
      if (!base64) return;
      current.docxBase64 = base64;
      const path = await saveDocxBase64(current.title, base64);
      if (!path) return;
      exportPreview.value = null;
      if (options.getPreferences().exportOpenAfter) {
        await openExportedFile(path);
      }
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
    exportPreview,
    htmlExport,
    exportDocument,
    saveDocx,
    saveHtml,
  };
}
