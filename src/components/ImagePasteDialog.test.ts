import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import ImagePasteDialog from './ImagePasteDialog.vue';

const createObjectURL = vi.fn(() => 'blob:preview');
const revokeObjectURL = vi.fn();

function mountDialog() {
  return mount(ImagePasteDialog, {
    attachTo: document.body,
    props: {
      file: new File(['x'], 'screenshot.png', { type: 'image/png' }),
      defaultName: '20261027-140309',
      extension: 'png',
      folder: 'assets',
    },
  });
}

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: revokeObjectURL,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.replaceChildren();
});

describe('ImagePasteDialog', () => {
  it('shows the default name, extension, preview and target path', async () => {
    const wrapper = mountDialog();
    await nextTick();
    const input = wrapper.find<HTMLInputElement>('#image-paste-name');

    expect(input.element.value).toBe('20261027-140309');
    expect(wrapper.find('.image-extension').text()).toBe('.png');
    expect(wrapper.find('.image-target').text()).toContain(
      'assets/20261027-140309.png',
    );
    expect(wrapper.find('.image-paste-preview img').attributes('src')).toBe(
      'blob:preview',
    );

    wrapper.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('emits the trimmed name on submit', async () => {
    const wrapper = mountDialog();
    await wrapper.find('#image-paste-name').setValue('  shot  ');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('confirm')?.[0]).toEqual(['shot']);
    wrapper.unmount();
  });

  it('rejects an empty name', async () => {
    const wrapper = mountDialog();
    await wrapper.find('#image-paste-name').setValue('   ');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('confirm')).toBeUndefined();
    expect(wrapper.find('.error').text()).toBe('Enter a file name.');
    wrapper.unmount();
  });

  it('cancels from the button and Escape', async () => {
    const wrapper = mountDialog();
    await wrapper.find('.btn.ghost').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);

    await wrapper.find('.overlay').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('cancel')).toHaveLength(2);
    wrapper.unmount();
  });
});
