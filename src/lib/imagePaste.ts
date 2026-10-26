import { basename } from './paths';

export type ImageFormat = 'png' | 'jpeg' | 'webp';

export interface ImageFormatOption {
  id: ImageFormat;
  label: string;
  extension: string;
  mime: string;
}

export interface ImageSaveResult {
  source: string;
  alt: string;
}

export type ImageSaveHandler = (
  file: File,
) => Promise<ImageSaveResult | null>;

export const IMAGE_FORMATS: ImageFormatOption[] = [
  { id: 'png', label: 'PNG', extension: 'png', mime: 'image/png' },
  { id: 'jpeg', label: 'JPEG', extension: 'jpg', mime: 'image/jpeg' },
  { id: 'webp', label: 'WebP', extension: 'webp', mime: 'image/webp' },
];

export const DEFAULT_IMAGE_FORMAT: ImageFormat = 'png';
export const DEFAULT_IMAGE_NAME_TEMPLATE = '{datetime}';
export const DEFAULT_IMAGE_FOLDER = 'assets';
export const DEFAULT_IMAGE_QUALITY = 0.92;
export const MIN_IMAGE_QUALITY = 0.1;
export const MAX_IMAGE_QUALITY = 1;
export const MAX_IMAGE_STEM_LENGTH = 48;
export const MAX_IMAGE_FILE_BYTES = 20 * 1024 * 1024;

const FORMAT_IDS = new Set<string>(IMAGE_FORMATS.map((format) => format.id));
const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const IMAGE_EXTENSION =
  /\.(?:png|jpe?g|webp|gif|svg|bmp|ico|avif)$/i;
const WINDOWS_RESERVED =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function isImageFormat(value: unknown): value is ImageFormat {
  return typeof value === 'string' && FORMAT_IDS.has(value);
}

export function extensionForFormat(format: ImageFormat): string {
  return (
    IMAGE_FORMATS.find((item) => item.id === format)?.extension ?? 'png'
  );
}

export function mimeForFormat(format: ImageFormat): string {
  return (
    IMAGE_FORMATS.find((item) => item.id === format)?.mime ?? 'image/png'
  );
}

export function clampImageQuality(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_IMAGE_QUALITY;
  return Math.min(
    MAX_IMAGE_QUALITY,
    Math.max(MIN_IMAGE_QUALITY, Math.round(value * 100) / 100),
  );
}

export function sanitizeImageStem(value: string): string {
  let result = '';
  let length = 0;
  for (const character of value) {
    if (LETTER_OR_NUMBER.test(character) || character === '-' || character === '_') {
      result += character;
      length += 1;
    } else if (character === ' ' || character === '.') {
      result += '-';
      length += 1;
    }
    if (length >= MAX_IMAGE_STEM_LENGTH) break;
  }
  const trimmed = result.replace(/^-+|-+$/g, '');
  const stem = trimmed === '' ? 'image' : trimmed;
  return WINDOWS_RESERVED.test(stem) ? `${stem}-image` : stem;
}

export function stripImageExtension(value: string): string {
  return value.replace(IMAGE_EXTENSION, '');
}

export function renderImageName(
  template: string,
  options: { notePath: string; now?: Date },
): string {
  const now = options.now ?? new Date();
  const pad = (value: number, length = 2): string =>
    String(value).padStart(length, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const datetime = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const timestamp = String(now.getTime());
  const note =
    basename(options.notePath).replace(/\.(?:md|markdown)$/i, '') || 'note';

  const tokens: Record<string, string> = {
    date,
    time,
    datetime,
    timestamp,
    note,
    日期: date,
    时间: time,
    日期时间: datetime,
    时间戳: timestamp,
    笔记: note,
  };

  let rendered = template;
  for (const [token, value] of Object.entries(tokens)) {
    rendered = rendered.split(`{${token}}`).join(value);
  }
  return sanitizeImageStem(rendered);
}

export function buildImageFileName(
  stem: string,
  format: ImageFormat,
): string {
  const clean = sanitizeImageStem(
    stripImageExtension(stem).trim(),
  );
  return `${clean}.${extensionForFormat(format)}`;
}

export function encodeMarkdownImagePath(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (segment === '' || segment === '.' || segment === '..') {
        return segment;
      }
      return encodeURIComponent(segment)
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');
    })
    .join('/');
}

export function shouldConvert(
  fileType: string,
  format: ImageFormat,
): boolean {
  const type = fileType.toLowerCase();
  if (!type) return true;
  if (format === 'jpeg') {
    return type !== 'image/jpeg' && type !== 'image/jpg';
  }
  return type !== mimeForFormat(format);
}

export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];

  const fromItems = Array.from(data.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  if (fromItems.length > 0) return fromItems;

  return Array.from(data.files ?? []).filter((file) =>
    file.type.startsWith('image/'),
  );
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + chunkSize),
    );
  }
  return window.btoa(binary);
}

interface LoadedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      });
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Fall back to an <img> element below.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('IMAGE_CONVERT_FAILED'));
    });
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function convertImageFile(
  file: File,
  format: ImageFormat,
  quality: number,
): Promise<Blob> {
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    throw new Error('IMAGE_TOO_LARGE');
  }
  if (!shouldConvert(file.type, format)) return file;

  const loaded = await loadImage(file);
  try {
    if (!loaded.width || !loaded.height) {
      throw new Error('IMAGE_CONVERT_FAILED');
    }
    const canvas = document.createElement('canvas');
    canvas.width = loaded.width;
    canvas.height = loaded.height;
    const context = canvas.getContext('2d');
    if (!context || typeof canvas.toBlob !== 'function') {
      throw new Error('IMAGE_CONVERT_FAILED');
    }
    if (format === 'jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(loaded.image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        resolve,
        mimeForFormat(format),
        clampImageQuality(quality),
      );
    });
    if (!blob || blob.size === 0) {
      throw new Error('IMAGE_CONVERT_FAILED');
    }
    const type = blob.type.toLowerCase();
    const matches =
      format === 'jpeg'
        ? type === 'image/jpeg' || type === 'image/jpg'
        : type === mimeForFormat(format);
    if (!matches) throw new Error('IMAGE_FORMAT_UNSUPPORTED');
    return blob;
  } finally {
    loaded.release();
  }
}
