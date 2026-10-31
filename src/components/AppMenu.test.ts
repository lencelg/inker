import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AppMenu from './AppMenu.vue';
import { setLanguage } from '../lib/i18n';

beforeEach(() => {
  setLanguage('en');
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('AppMenu', () => {
  it('offers HTML export without a quick export duplicate', async () => {
    const wrapper = mount(AppMenu, {
      attachTo: document.body,
      props: {
        viewMode: 'source',
        vimEnabled: false,
        exporting: false,
      },
    });

    await wrapper.find('.app-menu-trigger').trigger('click');
    await nextTick();
    await nextTick();

    const menu = document.querySelector('.app-menu');
    expect(menu).not.toBeNull();
    const text = menu?.textContent ?? '';
    expect(text).toContain('HTML');
    expect(text).not.toContain('PDF');
    expect(text).not.toContain('Word');
    expect(text).not.toContain('Quick Export');

    wrapper.unmount();
  });
});
