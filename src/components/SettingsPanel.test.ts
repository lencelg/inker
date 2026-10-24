import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import SettingsPanel from './SettingsPanel.vue';
import { normalizePreferences } from '../lib/preferences';

function mountPanel(overrides = {}) {
  return mount(SettingsPanel, {
    attachTo: document.body,
    props: {
      preferences: normalizePreferences(overrides),
      maximized: false,
    },
  });
}

describe('SettingsPanel', () => {
  it('renders the VS Code-style settings structure', () => {
    const wrapper = mountPanel();
    const text = wrapper.text();

    expect(text).toContain('设置');
    expect(text).toContain('常用设置');
    expect(text).toContain('文本编辑器');
    expect(text).toContain('预览');
    expect(text).toContain('导出');
    expect(text).toContain('Editor: Font Size');
    expect(wrapper.find('.scope-tab.active').text()).toBe('用户');
  });

  it('emits a preference patch when a setting changes', async () => {
    const wrapper = mountPanel();
    await wrapper
      .find('[data-setting-id="workbench.colorTheme"] .settings-select-trigger')
      .trigger('click');
    await nextTick();

    const option = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    ).find((element) => element.textContent?.includes('深色'));
    expect(option).toBeDefined();
    option?.click();
    await nextTick();

    expect(wrapper.emitted('update')?.at(-1)).toEqual([{ theme: 'dark' }]);
    wrapper.unmount();
  });

  it('emits a preference patch when a checkbox is toggled', async () => {
    const wrapper = mountPanel();
    const checkbox = wrapper.find(
      '[data-setting-id="preview.codeHighlight"] input[type="checkbox"]',
    );

    await checkbox.setValue(false);

    expect(wrapper.emitted('update')?.at(-1)).toEqual([
      { codeHighlight: false },
    ]);
  });

  it('filters content and highlights matching categories while searching', async () => {
    const wrapper = mountPanel();
    await wrapper.find('.search-input').setValue('vim');

    const sections = wrapper.findAll('.settings-section');
    expect(sections).toHaveLength(1);
    expect(sections[0].text()).toContain('Editor: Vim Mode');
    expect(sections[0].text()).not.toContain('Workbench: Color Theme');

    const matched = wrapper.findAll('.tree-category.matched .category-label');
    expect(matched.map((node) => node.text())).toEqual(['文本编辑器']);
  });

  it('shows only modified settings when the filter is enabled', async () => {
    const wrapper = mountPanel({ theme: 'dark' });
    await wrapper
      .find('button[title="仅显示已修改的设置"]')
      .trigger('click');

    const items = wrapper.findAll('.setting-item');
    expect(items).toHaveLength(1);
    expect(items[0].text()).toContain('Workbench: Color Theme');
    expect(items[0].text()).toContain('已修改');
  });

  it('resets a setting to its default value', async () => {
    const wrapper = mountPanel({ fontSize: 22 });
    await wrapper
      .find('[data-setting-id="editor.fontSize"] .hint-link')
      .trigger('click');

    expect(wrapper.emitted('update')?.at(-1)).toEqual([{ fontSize: 15 }]);
  });

  it('switches to an empty workspace scope', async () => {
    const wrapper = mountPanel();
    const tabs = wrapper.findAll('.scope-tab');
    await tabs[1].trigger('click');

    expect(wrapper.find('.scope-tab.active').text()).toBe('工作区');
    expect(wrapper.text()).toContain('当前工作区没有设置覆盖');
    expect(
      wrapper.find('.search-input').attributes('disabled'),
    ).toBeDefined();
  });
});
