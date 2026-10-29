import { beforeEach, describe, expect, it, vi } from 'vitest';

const clipboardMocks = vi.hoisted(() => ({
  readText: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => clipboardMocks);

import { hasClipboardText, readClipboardText } from './clipboardText';

function dataTransfer(
  types: string[],
  getData: (type: string) => string = () => '',
): DataTransfer {
  return {
    types,
    getData,
  } as unknown as DataTransfer;
}

beforeEach(() => {
  clipboardMocks.readText.mockReset();
});

describe('hasClipboardText', () => {
  it('rejects a missing clipboard payload', () => {
    expect(hasClipboardText(null)).toBe(false);
  });

  it('detects text from MIME types even when getData is empty', () => {
    expect(
      hasClipboardText(dataTransfer(['text/plain'])),
    ).toBe(true);
    expect(
      hasClipboardText(dataTransfer(['text/html'])),
    ).toBe(true);
  });

  it('detects text from getData when types are unavailable', () => {
    expect(
      hasClipboardText(
        dataTransfer([], (type) => (type === 'text/plain' ? 'hello' : '')),
      ),
    ).toBe(true);
  });

  it('does not treat image-only clipboards as text', () => {
    expect(
      hasClipboardText(dataTransfer(['Files', 'image/png'])),
    ).toBe(false);
  });

  it('treats a throwing getData call as non-text', () => {
    expect(
      hasClipboardText(
        dataTransfer([], () => {
          throw new Error('denied');
        }),
      ),
    ).toBe(false);
  });
});

describe('readClipboardText', () => {
  it('returns clipboard text', async () => {
    clipboardMocks.readText.mockResolvedValue('hello');
    await expect(readClipboardText()).resolves.toBe('hello');
  });

  it('returns null for an empty clipboard', async () => {
    clipboardMocks.readText.mockResolvedValue('');
    await expect(readClipboardText()).resolves.toBeNull();
  });

  it('returns null when the native clipboard is unavailable', async () => {
    clipboardMocks.readText.mockRejectedValue(new Error('unavailable'));
    await expect(readClipboardText()).resolves.toBeNull();
  });
});
