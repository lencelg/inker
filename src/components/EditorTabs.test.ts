import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import EditorTabs from './EditorTabs.vue';

const tabs = [
  { path: 'a.md', name: 'a.md', dirty: false, kind: 'note' as const },
  { path: 'b.md', name: 'b.md', dirty: false, kind: 'note' as const },
  { path: 'c.md', name: 'c.md', dirty: false, kind: 'note' as const },
];

function mountTabs() {
  return mount(EditorTabs, {
    props: {
      tabs,
      activePath: 'a.md',
      previewPath: null,
    },
  });
}

describe('EditorTabs', () => {
  it('emits a reorder action when a tab is dropped on another', async () => {
    const wrapper = mountTabs();
    const elements = wrapper.findAll('.tab');

    await elements[0].trigger('dragstart');
    await elements[2].trigger('dragover');
    await elements[2].trigger('drop');

    expect(wrapper.emitted('reorder')).toEqual([['a.md', 'c.md']]);
    wrapper.unmount();
  });

  it('ignores a drop onto the dragged tab', async () => {
    const wrapper = mountTabs();
    const elements = wrapper.findAll('.tab');

    await elements[0].trigger('dragstart');
    await elements[0].trigger('drop');

    expect(wrapper.emitted('reorder')).toBeUndefined();
    wrapper.unmount();
  });

  it('clears the drag indicator after drag end', async () => {
    const wrapper = mountTabs();
    const elements = wrapper.findAll('.tab');

    await elements[0].trigger('dragstart');
    await elements[1].trigger('dragover');
    expect(elements[1].classes()).toContain('drag-over');

    await elements[0].trigger('dragend');
    expect(elements[1].classes()).not.toContain('drag-over');
    wrapper.unmount();
  });
});
