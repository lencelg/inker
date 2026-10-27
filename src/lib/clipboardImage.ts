import { readImage } from '@tauri-apps/plugin-clipboard-manager';

/**
 * Reads an image from the system clipboard through Tauri.
 *
 * The WebView Clipboard API (`navigator.clipboard.read`) is not reliable in
 * WebKitGTK, so the native plugin is the source of truth for Vim commands.
 */
export async function readClipboardImageFile(): Promise<File | null> {
  const image = await readImage();
  try {
    const { width, height } = await image.size();
    if (!width || !height) return null;

    const rgba = await image.rgba();
    if (rgba.byteLength < width * height * 4) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.putImageData(
      new ImageData(new Uint8ClampedArray(rgba), width, height),
      0,
      0,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!blob || blob.size === 0) return null;

    return new File([blob], 'clipboard.png', { type: 'image/png' });
  } finally {
    await image.close().catch(() => undefined);
  }
}
