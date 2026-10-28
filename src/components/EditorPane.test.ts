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
    initialContent?: string;
    sourceHighlight?: boolean;
    vimEnabled?: boolean;
    vimMappings?: string;
    requestImageSave?: ImageSaveHandler;
  } = {},
) {
  return mount(EditorPane, {
    attachTo: document.body,
    props: {
      initialContent:
        options.initialContent ?? '# Title\n\nHello world',
      vimEnabled: options.vimEnabled ?? false,
      readOnly: false,
      immersive: false,
      sourceHighlight: options.sourceHighlight ?? true,
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

  it('marks fenced code lines for the code theme in source mode', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({
      initialContent: '```js\nconst value = 1;\n```',
    });
    await nextTick();

    expect(
      wrapper.findAll('.cm-codeblock-themed').length,
    ).toBeGreaterThan(0);

    wrapper.unmount();
  });

  it('uses the code theme foreground for punctuation in fenced code', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({
      initialContent: '```js\nconst value = { a: 1 };\n```',
    });
    await nextTick();

    expect(
      wrapper.find('.cm-codeblock-themed .cm-code-punctuation').exists(),
    ).toBe(true);

    wrapper.unmount();
  });

  it('leaves code blocks unthemed when source highlighting is off', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({
      initialContent: '```js\nconst value = 1;\n```',
      sourceHighlight: false,
    });
    await nextTick();

    expect(wrapper.findAll('.cm-codeblock-themed')).toHaveLength(0);
    expect(
      wrapper.findAll('.cm-codeblock-plain').length,
    ).toBeGreaterThan(0);

    wrapper.unmount();
  });

  it('inserts a block at the current cursor', async () => {
    prepareEditorDom();
    const wrapper = mountEditor();
    await nextTick();

    const instance = wrapper.vm as unknown as {
      insertBlock: (text: string) => boolean;
    };
    expect(instance.insertBlock('- [A](#a)')).toBe(true);
    await nextTick();

    expect(wrapper.find('.cm-content').text()).toContain('- [A](#a)');
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toContain(
      '- [A](#a)',
    );

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
