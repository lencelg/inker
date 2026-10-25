import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';
import HtmlExportDialog from './HtmlExportDialog.vue';
import { setLanguage } from '../lib/i18n';

function mountDialog() {
  return mount(HtmlExportDialog, {
    attachTo: document.body,
    props: {
      title: 'Export Test',
      embeddedHtml: '<!doctype html><html><body>Preview</body></html>',
      initialEmbedded: true,
      embeddedBytes: 4096,
      linkedBytes: 1024,
      warnings: ['Missing image'],
      busy: false,
    },
  });
}

function modeButtons(): HTMLButtonElement[] {
  return Array.from(
    document.body.querySelectorAll<HTMLButtonElement>(
      '.html-export-modes button',
    ),
  );
}

beforeEach(() => {
  setLanguage('en');
});

describe('HtmlExportDialog', () => {
  it('switches image modes and saves the selected mode', async () => {
    const wrapper = mountDialog();

    expect(
      modeButtons().find((button) => button.classList.contains('active'))
        ?.textContent,
    ).toBe('Embed Images');
    expect(document.body.textContent).toContain('About 4.0 KB');
    expect(document.body.textContent).toContain('Missing image');

    modeButtons()[1].click();
    await nextTick();

    expect(
      modeButtons().find((button) => button.classList.contains('active'))
        ?.textContent,
    ).toBe('Link Images');
    expect(document.body.textContent).toContain('About 1.0 KB');

    document.body
      .querySelector<HTMLButtonElement>('.export-button.primary')
      ?.click();
    await nextTick();
    expect(wrapper.emitted('save')).toEqual([[false]]);
    wrapper.unmount();
  });

  it('emits close from cancel and Escape', async () => {
    const wrapper = mountDialog();

    document.body
      .querySelectorAll<HTMLButtonElement>('.export-button')[1]
      ?.click();
    await nextTick();
    expect(wrapper.emitted('close')).toHaveLength(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wrapper.emitted('close')).toHaveLength(2);
    wrapper.unmount();
  });
});

