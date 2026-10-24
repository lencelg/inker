import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import PreviewPane from './PreviewPane.vue';

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
    wrapper.unmount();
  });
});
