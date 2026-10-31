import { mount, type VueWrapper } from '@vue/test-utils';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { nextTick } from 'vue';
import EditorPane from './EditorPane.vue';
import type { ImageSaveHandler } from '../lib/imagePaste';
import type { FileEntry } from '../types';
import { VIM_COMMAND_HISTORY_KEY } from '../lib/vimCommandHistory';

const clipboardMocks = vi.hoisted(() => ({
  readClipboardImageFile: vi.fn(),
}));

const clipboardTextMocks = vi.hoisted(() => ({
  hasClipboardText: vi.fn(),
  readClipboardText: vi.fn(),
}));

vi.mock('../lib/clipboardImage', () => clipboardMocks);
vi.mock('../lib/clipboardText', () => clipboardTextMocks);

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
    notePath?: string;
    files?: FileEntry[];
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
      notePath: options.notePath ?? 'note.md',
      files: options.files ?? [],
    },
  });
}

async function openVimPrompt(
  wrapper: VueWrapper,
): Promise<HTMLInputElement> {
  const content = wrapper.find('.cm-content').element as HTMLElement;
  content.focus();
  const colon = new KeyboardEvent('keydown', {
    key: ':',
    code: 'Semicolon',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(colon, 'keyCode', { get: () => 186 });
  Object.defineProperty(colon, 'which', { get: () => 186 });
  content.dispatchEvent(colon);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
  return wrapper.find('.cm-vim-panel input').element as HTMLInputElement;
}

async function submitVimCommand(
  wrapper: VueWrapper,
  command: string,
): Promise<void> {
  const input = await openVimPrompt(wrapper);
  input.value = command;
  input.setSelectionRange(command.length, command.length);
  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      bubbles: true,
      cancelable: true,
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
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

beforeEach(() => {
  clipboardTextMocks.hasClipboardText.mockReturnValue(false);
  clipboardTextMocks.readClipboardText.mockResolvedValue(null);
  localStorage.removeItem(VIM_COMMAND_HISTORY_KEY);
});

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

  it('falls back to the native clipboard for plain text paste', async () => {
    prepareEditorDom();
    clipboardTextMocks.readClipboardText.mockResolvedValue('pasted text');
    const wrapper = mountEditor();
    await nextTick();

    const content = wrapper.find('.cm-content').element as HTMLElement;
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { types: [], items: [], files: [], getData: () => '' },
    });
    content.dispatchEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(event.defaultPrevented).toBe(true);
    expect(wrapper.find('.cm-content').text()).toContain('pasted text');

    wrapper.unmount();
  });

  it('lets the WebView paste text when clipboardData is present', async () => {
    prepareEditorDom();
    clipboardTextMocks.hasClipboardText.mockReturnValue(true);
    const wrapper = mountEditor();
    await nextTick();

    const content = wrapper.find('.cm-content').element as HTMLElement;
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        types: ['text/plain'],
        items: [],
        files: [],
        getData: () => 'native text',
      },
    });
    content.dispatchEvent(event);
    await nextTick();

    expect(clipboardTextMocks.readClipboardText).not.toHaveBeenCalled();
    expect(clipboardMocks.readClipboardImageFile).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('folds Markdown headings with za in Vim normal mode', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({
      vimEnabled: true,
      initialContent: '# A\nbody\n\n# B\nend',
    });
    await nextTick();

    const content = wrapper.find('.cm-content').element as HTMLElement;
    content.focus();
    content.dispatchEvent(keydown('z', 'KeyZ', 90));
    content.dispatchEvent(keydown('a', 'KeyA', 65));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(wrapper.find('.cm-foldPlaceholder').exists()).toBe(true);
    wrapper.unmount();
  });

  it('handles Vim note navigation and tab commands', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({
      vimEnabled: true,
      notePath: 'docs/note.md',
    });
    await nextTick();

    await submitVimCommand(wrapper, 'e other.md');
    expect(wrapper.emitted('openNote')?.at(-1)).toEqual([
      'docs/other.md',
    ]);

    await submitVimCommand(wrapper, 'bn');
    expect(wrapper.emitted('switchTab')?.at(-1)).toEqual([1]);

    await submitVimCommand(wrapper, 'bp');
    expect(wrapper.emitted('switchTab')?.at(-1)).toEqual([-1]);

    await submitVimCommand(wrapper, 'q');
    expect(wrapper.emitted('closeTab')?.at(-1)).toEqual([false]);

    await submitVimCommand(wrapper, 'q!');
    expect(wrapper.emitted('closeTab')?.at(-1)).toEqual([true]);

    await submitVimCommand(wrapper, 'wq');
    expect(wrapper.emitted('saveAndCloseTab')).toHaveLength(1);

    await submitVimCommand(wrapper, 'x');
    expect(wrapper.emitted('saveAndCloseTab')).toHaveLength(2);

    wrapper.unmount();
  });

  it('applies insert-mode key-to-key mappings', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({
      vimEnabled: true,
      vimMappings: 'insert jk =<Esc>',
    });
    await nextTick();

    const content = wrapper.find('.cm-content').element as HTMLElement;
    content.focus();
    content.dispatchEvent(keydown('i', 'KeyI', 73));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    content.dispatchEvent(keydown('j', 'KeyJ', 74));
    content.dispatchEvent(keydown('k', 'KeyK', 75));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(wrapper.emitted('vimMode')?.at(-1)).toEqual(['NORMAL']);
    wrapper.unmount();
  });

  it('surrounds words with gs and text objects', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({
      vimEnabled: true,
      initialContent: 'hello world',
    });
    await nextTick();
    const content = wrapper.find('.cm-content').element as HTMLElement;
    content.focus();

    content.dispatchEvent(keydown('g', 'KeyG', 71));
    content.dispatchEvent(keydown('s', 'KeyS', 83));
    content.dispatchEvent(keydown('i', 'KeyI', 73));
    content.dispatchEvent(keydown('w', 'KeyW', 87));
    content.dispatchEvent(keydown('(', '(', 57));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(wrapper.find('.cm-content').text()).toBe('(hello) world');
    wrapper.unmount();
  });

  it('surrounds the current line in visual mode', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({
      vimEnabled: true,
      initialContent: 'hello',
    });
    await nextTick();
    const content = wrapper.find('.cm-content').element as HTMLElement;
    content.focus();

    content.dispatchEvent(keydown('V', 'KeyV', 86));
    content.dispatchEvent(keydown('S', 'KeyS', 83));
    content.dispatchEvent(keydown('*', '*', 56));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(wrapper.find('.cm-content').text()).toBe('*hello*');
    wrapper.unmount();
  });

  it('surrounds with a motion and in visual mode', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({
      vimEnabled: true,
      initialContent: 'hello world',
    });
    await nextTick();
    const content = wrapper.find('.cm-content').element as HTMLElement;
    content.focus();

    content.dispatchEvent(keydown('g', 'KeyG', 71));
    content.dispatchEvent(keydown('s', 'KeyS', 83));
    content.dispatchEvent(keydown('e', 'KeyE', 69));
    content.dispatchEvent(keydown('"', '"', 222));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
    expect(wrapper.find('.cm-content').text()).toBe('"hello" world');

    wrapper.unmount();
  });

  it('surrounds a visual selection', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({
      vimEnabled: true,
      initialContent: 'hello world',
    });
    await nextTick();
    const content = wrapper.find('.cm-content').element as HTMLElement;
    content.focus();

    content.dispatchEvent(keydown('v', 'KeyV', 86));
    content.dispatchEvent(keydown('e', 'KeyE', 69));
    content.dispatchEvent(keydown('S', 'KeyS', 83));
    content.dispatchEvent(keydown('(', '(', 57));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
    expect(wrapper.find('.cm-content').text()).toBe('(hello) world');

    wrapper.unmount();
  });

  it('emits Vim macro recording state', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({ vimEnabled: true });
    await nextTick();

    const content = wrapper.find('.cm-content').element as HTMLElement;
    content.focus();
    content.dispatchEvent(keydown('q', 'KeyQ', 81));
    content.dispatchEvent(keydown('a', 'KeyA', 65));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(wrapper.emitted('vimRecording')?.at(-1)).toEqual(['a']);

    content.dispatchEvent(keydown('q', 'KeyQ', 81));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(wrapper.emitted('vimRecording')?.at(-1)).toEqual([null]);
    wrapper.unmount();
  });

  it('emits Vim notification text as a status message', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({
      vimEnabled: true,
      initialContent: 'one\ntwo',
    });
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    const content = wrapper.find('.cm-content').element as HTMLElement;
    content.focus();
    content.dispatchEvent(keydown('y', 'KeyY', 89));
    content.dispatchEvent(keydown('y', 'KeyY', 89));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    const messages = wrapper.emitted('vimMessage')?.flat() ?? [];
    expect(
      messages.some((message) => /yanked/i.test(String(message))),
    ).toBe(true);
    wrapper.unmount();
  });

  it('recalls Vim command history with ArrowUp and ArrowDown', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({ vimEnabled: true });
    await nextTick();
    const content = wrapper.find('.cm-content').element as HTMLElement;

    const openPrompt = async (): Promise<HTMLInputElement> => {
      content.focus();
      const colon = new KeyboardEvent('keydown', {
        key: ':',
        code: 'Semicolon',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(colon, 'keyCode', { get: () => 186 });
      Object.defineProperty(colon, 'which', { get: () => 186 });
      content.dispatchEvent(colon);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await nextTick();
      return wrapper.find('.cm-vim-panel input')
        .element as HTMLInputElement;
    };

    let input = await openPrompt();
    input.value = 'set textwidth=80';
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true,
        cancelable: true,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    input = await openPrompt();
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        code: 'ArrowUp',
        keyCode: 38,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(input.value).toBe('set textwidth=80');

    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        keyCode: 40,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(input.value).toBe('');

    wrapper.unmount();
  });

  it('deletes a word with Ctrl-W in the Vim command line', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({ vimEnabled: true });
    await nextTick();

    const content = wrapper.find('.cm-content').element as HTMLElement;
    content.focus();
    const colon = new KeyboardEvent('keydown', {
      key: ':',
      code: 'Semicolon',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(colon, 'keyCode', { get: () => 186 });
    Object.defineProperty(colon, 'which', { get: () => 186 });
    content.dispatchEvent(colon);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    const input = wrapper.find('.cm-vim-panel input')
      .element as HTMLInputElement;
    input.value = 'set textwidth=80';
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'w',
        code: 'KeyW',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(input.value).toBe('set ');
    wrapper.unmount();
  });

  it('completes Ex commands with Tab in the Vim command line', async () => {
    prepareEditorDom();
    const wrapper = mountEditor({ vimEnabled: true });
    await nextTick();

    const content = wrapper.find('.cm-content').element as HTMLElement;
    content.focus();
    const colon = new KeyboardEvent('keydown', {
      key: ':',
      code: 'Semicolon',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(colon, 'keyCode', { get: () => 186 });
    Object.defineProperty(colon, 'which', { get: () => 186 });
    content.dispatchEvent(colon);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    const input = wrapper.find('.cm-vim-panel input')
      .element as HTMLInputElement;
    expect(input).toBeInstanceOf(HTMLInputElement);

    input.value = 'w';
    input.setSelectionRange(1, 1);
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(input.value).toBe('write');
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
