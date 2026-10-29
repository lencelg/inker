import { readText } from '@tauri-apps/plugin-clipboard-manager';

/**
 * Returns true when the paste event carries text that the WebView can insert
 * natively. Some WebKitGTK builds expose the MIME types but return an empty
 * string from getData(), so types must be checked before falling back to the
 * native clipboard reader.
 */
export function hasClipboardText(data: DataTransfer | null): boolean {
  if (!data) return false;

  const types = Array.from(data.types ?? []);
  if (
    types.some(
      (type) =>
        type === 'text/plain' ||
        type === 'text/html' ||
        type === 'text/uri-list' ||
        type === 'text',
    )
  ) {
    return true;
  }

  try {
    return data.getData('text/plain') !== '';
  } catch {
    return false;
  }
}

/**
 * Reads plain text through the native clipboard plugin. Used as a fallback
 * when the WebView paste event does not expose clipboardData at all.
 */
export async function readClipboardText(): Promise<string | null> {
  try {
    const text = await readText();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
