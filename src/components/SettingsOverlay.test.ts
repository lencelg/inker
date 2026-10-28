import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SettingsOverlay from './SettingsOverlay.vue';
import { normalizePreferences } from '../lib/preferences';

function mountOverlay(suspended: boolean) {
  return mount(SettingsOverlay, {
    props: {
      preferences: normalizePreferences({}),
      maximized: false,
      suspended,
    },
    global: {
      stubs: { SettingsPanel: true },
    },
  });
}

function pressEscape(): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe('SettingsOverlay', () => {
  it('closes on Escape when active', () => {
    const wrapper = mountOverlay(false);

    pressEscape();

    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });

  it('ignores Escape while suspended by the command palette', () => {
    const wrapper = mountOverlay(true);

    pressEscape();

    expect(wrapper.emitted('close')).toBeUndefined();
    wrapper.unmount();
  });
});
