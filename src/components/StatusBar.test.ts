import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import StatusBar from './StatusBar.vue';

function mountStatusBar() {
  return mount(StatusBar, {
    attachTo: document.body,
    props: {
      line: 1,
      column: 1,
      mode: 'source',
      vimEnabled: false,
      lineEnding: 'LF',
      immersive: false,
    },
  });
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('StatusBar mode menu', () => {
  it('opens the menu and emits the selected mode', async () => {
    const wrapper = mountStatusBar();
    await wrapper.find('.status-mode').trigger('click');
    await nextTick();

    const items = document.body.querySelectorAll<HTMLButtonElement>(
      '[role="menuitemradio"]',
    );
    expect(items).toHaveLength(4);

    items[1].click();
    await nextTick();

    expect(wrapper.emitted('modeChange')?.[0]).toEqual(['wysiwyg']);
    expect(wrapper.find('.status-mode').attributes('aria-expanded')).toBe(
      'false',
    );
    wrapper.unmount();
  });

  it('closes on Escape', async () => {
    const wrapper = mountStatusBar();
    await wrapper.find('.status-mode').trigger('click');
    await nextTick();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();

    expect(wrapper.find('.status-mode').attributes('aria-expanded')).toBe(
      'false',
    );
    wrapper.unmount();
  });

  it('emits the immersive toggle', async () => {
    const wrapper = mountStatusBar();
    await wrapper.find('.status-focus').trigger('click');
    expect(wrapper.emitted('immersiveToggle')).toHaveLength(1);
    wrapper.unmount();
  });
});
