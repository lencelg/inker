import {
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';
import { t } from './lib/i18n';

type NotesChangedEvent = {
  payload: { kind: string; paths: string[] };
};

const mocks = vi.hoisted(() => {
  let notesChangedHandler:
    | ((event: {
        payload: { kind: string; paths: string[] };
      }) => void)
    | null = null;

  const listen = vi.fn(
    async (
      event: string,
      handler: (event: {
        payload: { kind: string; paths: string[] };
      }) => void,
    ) => {
      if (event === 'notes-changed') {
        notesChangedHandler = handler;
      }
      return () => undefined;
    },
  );

  const windowMock = {
    onCloseRequested: vi.fn(async () => () => undefined),
    onResized: vi.fn(async () => () => undefined),
    isMaximized: vi.fn(async () => false),
    close: vi.fn(async () => undefined),
    minimize: vi.fn(async () => undefined),
    toggleMaximize: vi.fn(async () => undefined),
    startDragging: vi.fn(async () => undefined),
  };

  const apiMock = {
    getState: vi.fn(),
    chooseNotesDir: vi.fn(),
    pickNotesDir: vi.fn(async () => null),
    refresh: vi.fn(),
    readNote: vi.fn(),
    saveNote: vi.fn(),
    saveCopy: vi.fn(
      async (): Promise<string | null> => null,
    ),
    saveImage: vi.fn(),
    saveExport: vi.fn(),
    readAsset: vi.fn(),
    readImage: vi.fn(),
    searchNotes: vi.fn(),
    createFile: vi.fn(),
    createFolder: vi.fn(),
    renameEntry: vi.fn(),
    deleteEntry: vi.fn(),
  };

  return {
    listen,
    windowMock,
    apiMock,
    getNotesChangedHandler: () => notesChangedHandler,
    resetNotesChangedHandler: () => {
      notesChangedHandler = null;
    },
  };
});

vi.mock('./api', () => ({ api: mocks.apiMock }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: mocks.listen,
}));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => mocks.windowMock,
}));
vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: vi.fn(async () => undefined),
}));

const EditorPaneStub = defineComponent({
  name: 'EditorPane',
  props: {
    initialContent: { type: String, default: '' },
  },
  emits: [
    'change',
    'cursor',
    'scroll-sync',
    'vim-mode',
    'save-request',
  ],
  template: '<div class="editor-stub">{{ initialContent }}</div>',
  methods: {
    refresh() {},
    revealLine() {},
    scrollToLine() {},
    captureState() {
      return null;
    },
    restoreState() {},
    promptImageName() {
      return Promise.resolve(null);
    },
    insertBlock() {
      return true;
    },
  },
});

const StatusBarStub = defineComponent({
  name: 'StatusBar',
  props: {
    mode: { type: String, default: '' },
    saveState: { type: String, default: '' },
  },
  template:
    '<div class="status-stub" :data-mode="mode" :data-save-state="saveState"></div>',
});

let imageMounts = 0;

const ImagePaneStub = defineComponent({
  name: 'ImagePane',
  props: {
    path: { type: String, default: '' },
  },
  template: '<div class="image-stub"></div>',
  mounted() {
    imageMounts += 1;
  },
});

const stubs = {
  ActivityRail: true,
  AppMenu: true,
  EditorTabs: true,
  EditorPane: EditorPaneStub,
  WysiwygPane: true,
  PreviewPane: true,
  ImagePane: ImagePaneStub,
  ImagePasteDialog: true,
  InkerMark: true,
  NoteSidebar: true,
  PromptDialog: true,
  SearchPanel: true,
  SettingsOverlay: true,
  StatusBar: StatusBarStub,
  ExportPreviewDialog: true,
  HtmlExportDialog: true,
};

let contents: Map<string, string>;
let state: {
  notesDir: string | null;
  entries: Array<{ path: string; name: string; isDir: boolean }>;
};

function makeEntries() {
  return [
    { path: 'a.md', name: 'a.md', isDir: false },
    { path: 'b.md', name: 'b.md', isDir: false },
    { path: 'pic.png', name: 'pic.png', isDir: false },
  ];
}

const mountedWrappers: VueWrapper[] = [];

function mountApp() {
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { stubs },
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

async function settle(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    await flushPromises();
    await nextTick();
  }
}

async function waitForExternalRefresh(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 350);
  });
  await settle();
}

function pressShortcut(options: {
  key: string;
  shiftKey?: boolean;
}): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: options.key,
      ctrlKey: true,
      shiftKey: options.shiftKey ?? false,
      bubbles: true,
      cancelable: true,
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  mocks.resetNotesChangedHandler();
  imageMounts = 0;

  contents = new Map([
    ['a.md', '# A'],
    ['b.md', '# B'],
  ]);
  state = { notesDir: '/notes', entries: makeEntries() };

  mocks.apiMock.getState.mockResolvedValue(state);
  mocks.apiMock.refresh.mockResolvedValue(state);
  mocks.apiMock.saveCopy.mockResolvedValue(null);
  mocks.apiMock.readNote.mockImplementation(
    async (path: string) => ({
      path,
      content: contents.get(path) ?? '',
    }),
  );
  mocks.apiMock.saveNote.mockImplementation(
    async (path: string, content: string) => {
      contents.set(path, content);
    },
  );
});

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
  }
  document.body.replaceChildren();
});

describe('App integration', () => {
  it('shows a warning when file watching is unavailable', async () => {
    mocks.apiMock.getState.mockResolvedValue({
      ...state,
      watcherError: 'watch failed',
    });
    const wrapper = mountApp();
    await settle();

    expect(wrapper.find('.banner').text()).toContain('watch failed');
  });

  it('opens recent files first and switches to commands with >', async () => {
    const wrapper = mountApp();
    await settle();

    expect(wrapper.find('.editor-stub').text()).toContain('# A');

    pressShortcut({ key: 'p' });
    await settle();
    let items = wrapper.findAll('.palette-item');
    expect(items).toHaveLength(2);
    expect(items[0].text()).toContain('a.md');

    const second = items.find((item) => item.text().includes('b.md'));
    expect(second).toBeTruthy();
    await second!.trigger('click');
    await settle();
    expect(wrapper.find('.editor-stub').text()).toContain('# B');

    pressShortcut({ key: 'p' });
    await settle();
    items = wrapper.findAll('.palette-item');
    expect(items[0].text()).toContain('b.md');

    await wrapper.find('.palette-input input').setValue('>theme');
    await settle();

    expect(wrapper.find('.quick-palette').exists()).toBe(true);
    expect(
      (wrapper.find('.palette-input input').element as HTMLInputElement)
        .value,
    ).toBe('theme');
    expect(
      wrapper
        .findAll('.palette-item')
        .some((item) =>
          item.text().includes(t('command.preferences.colorTheme')),
        ),
    ).toBe(true);

  });

  it('runs a view mode command from the command palette', async () => {
    const wrapper = mountApp();
    await settle();

    pressShortcut({ key: 'p', shiftKey: true });
    await settle();

    const item = wrapper
      .findAll('.palette-item')
      .find((entry) =>
        entry.text().includes(t('command.view.side')),
      );
    expect(item).toBeTruthy();
    await item!.trigger('click');
    await settle();

    expect(
      wrapper.find('.status-stub').attributes('data-mode'),
    ).toBe('side');
  });

  it('reloads a clean tab when the file changes on disk', async () => {
    const wrapper = mountApp();
    await settle();

    const handler = mocks.getNotesChangedHandler();
    expect(handler).toBeTypeOf('function');

    contents.set('a.md', '# A changed externally');
    handler!({
      payload: { kind: 'modify', paths: ['a.md'] },
    });
    await waitForExternalRefresh();

    expect(wrapper.find('.editor-stub').text()).toContain(
      '# A changed externally',
    );
  });

  it('ignores modifications to files that are not open', async () => {
    const wrapper = mountApp();
    await settle();

    const readsBefore = mocks.apiMock.readNote.mock.calls.length;
    mocks.apiMock.refresh.mockClear();

    contents.set('b.md', '# B external');
    mocks.getNotesChangedHandler()!({
      payload: { kind: 'modify', paths: ['b.md'] },
    });
    await waitForExternalRefresh();

    expect(mocks.apiMock.refresh).not.toHaveBeenCalled();
    expect(mocks.apiMock.readNote.mock.calls.length).toBe(readsBefore);
    expect(wrapper.find('.editor-stub').text()).toContain('# A');
  });

  it('reloads an open image when it changes on disk', async () => {
    window.localStorage.setItem('inker-quick-open-images', 'true');
    const wrapper = mountApp();
    await settle();

    pressShortcut({ key: 'p' });
    await settle();
    const image = wrapper
      .findAll('.palette-item')
      .find((item) => item.text().includes('pic.png'));
    expect(image).toBeTruthy();
    await image!.trigger('click');
    await settle();

    expect(imageMounts).toBe(1);

    mocks.getNotesChangedHandler()!({
      payload: { kind: 'modify', paths: ['pic.png'] },
    });
    await waitForExternalRefresh();

    expect(imageMounts).toBe(2);
  });

  it('asks before discarding local changes on an external edit', async () => {
    const wrapper = mountApp();
    await settle();

    wrapper
      .findComponent(EditorPaneStub)
      .vm.$emit('change', '# A local');
    await settle();

    const handler = mocks.getNotesChangedHandler();
    contents.set('a.md', '# A external');
    handler!({
      payload: { kind: 'modify', paths: ['a.md'] },
    });
    await waitForExternalRefresh();

    expect(wrapper.find('.dialog').exists()).toBe(true);
    await wrapper.find('.dialog .btn.danger').trigger('click');
    await settle();

    expect(wrapper.find('.editor-stub').text()).toContain('# A external');
  });

  it('saves a conflicted copy on request', async () => {
    mocks.apiMock.saveCopy.mockResolvedValue(
      '/notes/a (conflicted copy).md',
    );
    const wrapper = mountApp();
    await settle();

    wrapper
      .findComponent(EditorPaneStub)
      .vm.$emit('change', '# A local');
    await settle();

    contents.set('a.md', '# A external');
    mocks.getNotesChangedHandler()!({
      payload: { kind: 'modify', paths: ['a.md'] },
    });
    await waitForExternalRefresh();

    await wrapper.find('.dialog .btn.copy').trigger('click');
    await settle();

    expect(mocks.apiMock.saveCopy).toHaveBeenCalledWith(
      '/notes/a (conflicted copy).md',
      '# A local',
    );
    expect(wrapper.find('.editor-stub').text()).toContain('# A local');
    expect(wrapper.find('.banner.warning').text()).toContain(
      t('externalChange.copySaved'),
    );
  });

  it('keeps local changes when the conflict dialog is cancelled', async () => {
    const wrapper = mountApp();
    await settle();

    wrapper
      .findComponent(EditorPaneStub)
      .vm.$emit('change', '# A local');
    await settle();

    const handler = mocks.getNotesChangedHandler();
    contents.set('a.md', '# A external');
    handler!({
      payload: { kind: 'modify', paths: ['a.md'] },
    });
    await waitForExternalRefresh();

    await wrapper.find('.dialog .btn.keep').trigger('click');
    await settle();

    expect(wrapper.find('.editor-stub').text()).toContain('# A local');
    expect(
      wrapper.find('.status-stub').attributes('data-save-state'),
    ).toBe('dirty');
  });

  it('keeps unsaved content when the file is deleted on disk', async () => {
    const wrapper = mountApp();
    await settle();

    wrapper
      .findComponent(EditorPaneStub)
      .vm.$emit('change', '# A local');
    await settle();

    mocks.apiMock.refresh.mockResolvedValue({
      notesDir: '/notes',
      entries: [{ path: 'b.md', name: 'b.md', isDir: false }],
    });
    mocks.getNotesChangedHandler()!({
      payload: { kind: 'remove', paths: ['a.md'] },
    });
    await waitForExternalRefresh();

    expect(wrapper.find('.editor-stub').text()).toContain('# A local');
    expect(wrapper.find('.banner.warning').exists()).toBe(true);

    mocks.apiMock.saveCopy.mockResolvedValue(
      '/notes/a (conflicted copy).md',
    );
    await wrapper.find('.banner-action').trigger('click');
    await settle();

    expect(mocks.apiMock.saveCopy).toHaveBeenCalledWith(
      '/notes/a (conflicted copy).md',
      '# A local',
    );
    expect(wrapper.find('.banner-action').exists()).toBe(false);
  });
});
