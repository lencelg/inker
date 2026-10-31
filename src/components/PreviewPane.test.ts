import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import PreviewPane from './PreviewPane.vue';

const mocks = vi.hoisted(() => ({
  openUrl: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: mocks.openUrl,
}));

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    },
  );
});

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('PreviewPane anchors', () => {
  it('scrolls to an internal heading when a TOC link is clicked', async () => {
    const scrollTo = vi.fn();
    window.HTMLElement.prototype.scrollTo = scrollTo;

    const wrapper = mount(PreviewPane, {
      attachTo: document.body,
      props: {
        html: '<h2 id="install">Install</h2><p>Body</p><a href="#install">跳转安装</a>',
        notePath: 'note.md',
        focusLine: 1,
      },
    });
    await nextTick();
    await nextTick();

    await wrapper.find('a[href="#install"]').trigger('click');

    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' }),
    );
    expect(mocks.openUrl).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('resolves anchors from heading text when ids are missing', async () => {
    const scrollTo = vi.fn();
    window.HTMLElement.prototype.scrollTo = scrollTo;

    const wrapper = mount(PreviewPane, {
      attachTo: document.body,
      props: {
        html: '<h2>一、安装</h2><a href="#%E4%B8%80%E5%AE%89%E8%A3%85">跳转</a>',
        notePath: 'note.md',
        focusLine: 1,
      },
    });
    await nextTick();
    await nextTick();

    await wrapper.find('a').trigger('click');

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(mocks.openUrl).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('opens external links through the system opener', async () => {
    const scrollTo = vi.fn();
    window.HTMLElement.prototype.scrollTo = scrollTo;

    const wrapper = mount(PreviewPane, {
      attachTo: document.body,
      props: {
        html: '<a href="https://example.com/docs">Docs</a>',
        notePath: 'note.md',
        focusLine: 1,
      },
    });
    await nextTick();
    await nextTick();

    const anchor = wrapper.find('a').element as HTMLAnchorElement;
    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    anchor.dispatchEvent(click);

    expect(mocks.openUrl).toHaveBeenCalledWith(
      'https://example.com/docs',
    );
    expect(click.defaultPrevented).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('does not open external links without Ctrl or Cmd', async () => {
    const wrapper = mount(PreviewPane, {
      attachTo: document.body,
      props: {
        html: '<a href="https://example.com/docs">Docs</a>',
        notePath: 'note.md',
        focusLine: 1,
      },
    });
    await nextTick();
    await nextTick();

    const anchor = wrapper.find('a').element as HTMLAnchorElement;
    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    anchor.dispatchEvent(click);

    expect(mocks.openUrl).not.toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(true);
    wrapper.unmount();
  });

  it('suppresses the native context menu on links only', async () => {
    const wrapper = mount(PreviewPane, {
      attachTo: document.body,
      props: {
        html: '<p>Body</p><a href="https://example.com">Docs</a>',
        notePath: 'note.md',
        focusLine: 1,
      },
    });
    await nextTick();
    await nextTick();

    const linkMenu = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    wrapper.find('a').element.dispatchEvent(linkMenu);

    const bodyMenu = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    wrapper.find('p').element.dispatchEvent(bodyMenu);

    expect(linkMenu.defaultPrevented).toBe(true);
    expect(bodyMenu.defaultPrevented).toBe(false);
    wrapper.unmount();
  });

  it('does not navigate the webview for unsupported links', async () => {
    const wrapper = mount(PreviewPane, {
      attachTo: document.body,
      props: {
        html: '<a href="other.md">Other note</a>',
        notePath: 'note.md',
        focusLine: 1,
      },
    });
    await nextTick();
    await nextTick();

    const anchor = wrapper.find('a').element as HTMLAnchorElement;
    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    anchor.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(mocks.openUrl).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
