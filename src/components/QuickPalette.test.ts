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

function mountPalette(
  options: {
    initialQuery?: string;
    allowCommandPrefix?: boolean;
  } = {},
) {
  return mount(QuickPalette, {
    attachTo: document.body,
    props: {
      items,
      placeholder: 'Search files by name',
      emptyLabel: 'No matching files',
      initialQuery: options.initialQuery,
      allowCommandPrefix: options.allowCommandPrefix,
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

  it('starts with the provided query', async () => {
    const wrapper = mountPalette({ initialQuery: 'mon' });
    await nextTick();

    expect(
      (wrapper.find('input').element as HTMLInputElement).value,
    ).toBe('mon');
    expect(wrapper.findAll('.palette-item')).toHaveLength(1);

    wrapper.unmount();
  });

  it('switches to command mode when the query starts with >', async () => {
    const wrapper = mountPalette({ allowCommandPrefix: true });
    await nextTick();

    await wrapper.find('input').setValue('>theme');

    expect(wrapper.emitted('switch-command')?.[0]).toEqual(['theme']);

    wrapper.unmount();
  });

  it('keeps > literal when command mode switching is disabled', async () => {
    const wrapper = mountPalette();
    await nextTick();

    await wrapper.find('input').setValue('>theme');

    expect(wrapper.emitted('switch-command')).toBeUndefined();

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

  it('does not select while an IME composition is active', async () => {
    const wrapper = mountPalette();
    await nextTick();

    await wrapper.find('input').trigger('keydown', {
      key: 'Enter',
      isComposing: true,
    });

    expect(wrapper.emitted('select')).toBeUndefined();

    wrapper.unmount();
  });

  it('does not close on Escape while an IME composition is active', async () => {
    const wrapper = mountPalette();
    await nextTick();

    await wrapper.find('input').trigger('keydown', {
      key: 'Escape',
      isComposing: true,
    });

    expect(wrapper.emitted('close')).toBeUndefined();

    wrapper.unmount();
  });

  it('caps the rendered result list for large workspaces', async () => {
    const many: PaletteItem[] = Array.from(
      { length: 150 },
      (_, index) => ({
        id: `note-${index}.md`,
        label: `Note ${index}`,
        kind: 'note',
      }),
    );
    const wrapper = mount(QuickPalette, {
      attachTo: document.body,
      props: {
        items: many,
        placeholder: 'Search files by name',
        emptyLabel: 'No matching files',
      },
    });
    await nextTick();

    expect(wrapper.findAll('.palette-item')).toHaveLength(100);

    wrapper.unmount();
  });
});
