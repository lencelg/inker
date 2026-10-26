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
    expect(wrapper.find('.status-mode').attributes('title')).toBeUndefined();
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
    expect(wrapper.find('.status-focus').text()).toBe('Zen');
    await wrapper.find('.status-focus').trigger('click');
    expect(wrapper.emitted('immersiveToggle')).toHaveLength(1);
    wrapper.unmount();
  });

  it('renders the save state only when provided', async () => {
    const wrapper = mountStatusBar();
    expect(wrapper.find('.status-save').exists()).toBe(false);

    await wrapper.setProps({ saveState: 'saved' });
    expect(wrapper.find('.status-save').text()).toBe('Saved');

    await wrapper.setProps({ saveState: 'dirty' });
    expect(wrapper.find('.status-save').text()).toBe('Unsaved');

    await wrapper.setProps({ saveState: 'saving' });
    expect(wrapper.find('.status-save').text()).toBe('Saving…');

    await wrapper.setProps({ saveState: null });
    expect(wrapper.find('.status-save').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows the active Vim mode in the bottom bar', () => {
    const wrapper = mount(StatusBar, {
      attachTo: document.body,
      props: {
        line: 1,
        column: 1,
        mode: 'source',
        vimEnabled: true,
        vimMode: 'INSERT',
        lineEnding: 'LF',
        immersive: false,
      },
    });

    expect(wrapper.find('.status-vim').text()).toBe('INSERT');
    wrapper.unmount();
  });
});
