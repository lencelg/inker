import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import SettingsSelect from './SettingsSelect.vue';
import type { SettingsOption } from '../../lib/settingsSchema';

const OPTIONS: SettingsOption[] = [
  { label: '暖白', value: 'paper' },
  { label: '白色', value: 'white' },
  { label: '深色', value: 'dark' },
];

function mountSelect(modelValue = 'paper') {
  return mount(SettingsSelect, {
    attachTo: document.body,
    props: {
      modelValue,
      options: OPTIONS,
      labelledby: 'theme-title',
    },
  });
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('SettingsSelect', () => {
  it('renders the selected label and emits the chosen option', async () => {
    const wrapper = mountSelect();
    const trigger = wrapper.find('.settings-select-trigger');

    expect(trigger.text()).toContain('暖白');
    expect(trigger.attributes('aria-expanded')).toBe('false');

    await trigger.trigger('click');
    await nextTick();

    const menu = document.querySelector('[role="listbox"]');
    expect(menu).not.toBeNull();
    expect(trigger.attributes('aria-expanded')).toBe('true');

    const dark = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    ).find((element) => element.textContent?.includes('深色'));
    dark?.click();
    await nextTick();

    expect(wrapper.emitted('update')).toEqual([['dark']]);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(trigger.attributes('aria-expanded')).toBe('false');
    wrapper.unmount();
  });

  it('supports keyboard navigation and selection', async () => {
    const wrapper = mountSelect();
    const trigger = wrapper.find('.settings-select-trigger');

    await trigger.trigger('keydown', { key: 'ArrowDown' });
    await nextTick();
    await nextTick();

    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toContain('暖白');

    const menu = document.querySelector('[role="listbox"]') as HTMLElement;
    menu.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    expect(document.activeElement?.textContent).toContain('白色');

    menu.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );
    await nextTick();

    expect(wrapper.emitted('update')).toEqual([['white']]);
    wrapper.unmount();
  });
});
