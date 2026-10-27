import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import EditorPane from './EditorPane.vue';
import type { ImageSaveHandler } from '../lib/imagePaste';

const clipboardMocks = vi.hoisted(() => ({
  readClipboardImageFile: vi.fn(),
}));

vi.mock('../lib/clipboardImage', () => clipboardMocks);

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function keydown(key: string, code: string, keyCode: number): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    code,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  Object.defineProperty(event, 'which', { get: () => keyCode });
  return event;
}

function mountEditor(
  options: {
    vimEnabled?: boolean;
    vimMappings?: string;
    requestImageSave?: ImageSaveHandler;
  } = {},
) {
  return mount(EditorPane, {
    attachTo: document.body,
    props: {
      initialContent: '# Title\n\nHello world',
      vimEnabled: options.vimEnabled ?? false,
      readOnly: false,
      immersive: false,
      sourceHighlight: true,
      requestImageSave: options.requestImageSave ?? (async () => null),
      vimMappings:
        options.vimMappings ?? 'normal <Space>p pasteimage',
    },
  });
}

function prepareEditorDom(): void {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  if (typeof Range.prototype.getClientRects !== 'function') {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [],
    });
  }
}

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('EditorPane', () => {
  it('renders the initial markdown content in source mode', async () => {
    prepareEditorDom();

    const wrapper = mountEditor();
    await nextTick();

    expect(wrapper.find('.cm-content').exists()).toBe(true);
    expect(wrapper.find('.cm-content').text()).toContain('Hello world');

    wrapper.unmount();
  });

  it('runs the paste image mapping for <Space>p in normal mode', async () => {
    prepareEditorDom();
    clipboardMocks.readClipboardImageFile.mockResolvedValue(
      new File(['x'], 'x.png', { type: 'image/png' }),
    );
    const requestImageSave = vi.fn(async (_file: File) => ({
      source: 'assets/x.png',
      alt: 'x',
    }));

    const wrapper = mountEditor({
      vimEnabled: true,
      requestImageSave,
    });
    await nextTick();

    const content = wrapper.find('.cm-content');
    expect(content.exists()).toBe(true);
    const target = content.element as HTMLElement;
    target.focus();
    target.dispatchEvent(keydown(' ', 'Space', 32));
    target.dispatchEvent(keydown('p', 'KeyP', 80));

    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(requestImageSave).toHaveBeenCalledTimes(1);
    expect(requestImageSave.mock.calls[0][0]).toBeInstanceOf(File);

    wrapper.unmount();
  });
});
