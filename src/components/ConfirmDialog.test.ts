import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ConfirmDialog from './ConfirmDialog.vue';

function mountDialog(cancelLabel?: string) {
  return mount(ConfirmDialog, {
    props: {
      title: 'Title',
      message: 'Message',
      confirmLabel: 'Reload',
      danger: true,
      cancelLabel,
    },
    attachTo: document.body,
  });
}

describe('ConfirmDialog', () => {
  it('uses the default cancel label when none is provided', () => {
    const wrapper = mountDialog();
    const buttons = wrapper.findAll('button');
    expect(buttons[0].text()).not.toBe('');
    expect(buttons[1].text()).toBe('Reload');
    wrapper.unmount();
  });

  it('renders a custom cancel label', () => {
    const wrapper = mountDialog('Keep my changes');
    expect(wrapper.findAll('button')[0].text()).toBe(
      'Keep my changes',
    );
    wrapper.unmount();
  });
});
