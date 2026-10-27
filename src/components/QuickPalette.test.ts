import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import QuickPalette from './QuickPalette.vue';
import type { PaletteItem } from '../lib/palette';

const items: PaletteItem[] = [
  { id: 'alpha.md', label: 'Alpha', detail: 'notes', kind: 'note' },
  { id: 'beta.md', label: 'Beta', kind: 'note' },
  { id: 'monokai', label: 'Monokai', kind: 'theme' },
  { id: 'back', label: 'Back', kind: 'back' },
];

function mountPalette() {
  return mount(QuickPalette, {
    attachTo: document.body,
    props: {
      items,
      placeholder: 'Search files by name',
      emptyLabel: 'No matching files',
    },
  });
}

describe('QuickPalette', () => {
  it('lists all items and filters as the query changes', async () => {
    const wrapper = mountPalette();
    await nextTick();

    expect(wrapper.findAll('.palette-item')).toHaveLength(items.length);

    const input = wrapper.find('input');
    await input.setValue('mon');

    const filtered = wrapper.findAll('.palette-item');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].text()).toContain('Monokai');

    wrapper.unmount();
  });

  it('moves the active item with arrow keys and selects with Enter', async () => {
    const wrapper = mountPalette();
    await nextTick();

    const input = wrapper.find('input');
    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('select')).toEqual([[items[1]]]);

    wrapper.unmount();
  });

  it('wraps navigation and selects with a click', async () => {
    const wrapper = mountPalette();
    await nextTick();

    const input = wrapper.find('input');
    await input.trigger('keydown', { key: 'ArrowUp' });
    await input.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('select')?.[0]).toEqual([items[3]]);

    await wrapper.findAll('.palette-item')[2].trigger('click');
    expect(wrapper.emitted('select')?.[1]).toEqual([items[2]]);

    wrapper.unmount();
  });

  it('shows the empty label when nothing matches', async () => {
    const wrapper = mountPalette();
    await nextTick();

    await wrapper.find('input').setValue('zzz');
    expect(wrapper.find('.palette-empty').text()).toBe(
      'No matching files',
    );
    expect(wrapper.find('.palette-list').exists()).toBe(false);

    wrapper.unmount();
  });

  it('closes on Escape', async () => {
    const wrapper = mountPalette();
    await nextTick();

    await wrapper.find('input').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('close')).toHaveLength(1);

    wrapper.unmount();
  });
});
