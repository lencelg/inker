import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ExternalChangeDialog from './ExternalChangeDialog.vue';

function mountDialog() {
  return mount(ExternalChangeDialog, {
    attachTo: document.body,
    props: {
      title: 'File changed on disk',
      message: 'Choose an action.',
      reloadLabel: 'Reload',
      keepLabel: 'Keep My Changes',
      saveCopyLabel: 'Save a Copy',
    },
  });
}

describe('ExternalChangeDialog', () => {
  it('emits the selected action', async () => {
    const wrapper = mountDialog();
    const buttons = wrapper.findAll('button');

    await buttons[0].trigger('click');
    await buttons[1].trigger('click');
    await buttons[2].trigger('click');

    expect(wrapper.emitted('saveCopy')).toHaveLength(1);
    expect(wrapper.emitted('keep')).toHaveLength(1);
    expect(wrapper.emitted('reload')).toHaveLength(1);
    wrapper.unmount();
  });

  it('keeps local changes on Escape or backdrop click', async () => {
    const wrapper = mountDialog();

    await wrapper.find('.overlay').trigger('keydown', {
      key: 'Escape',
    });
    await wrapper.find('.overlay').trigger('click');

    expect(wrapper.emitted('keep')).toHaveLength(2);
    wrapper.unmount();
  });
});
