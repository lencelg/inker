import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import ThemeImportControl from './ThemeImportControl.vue';
import {
  customCodeThemes,
  customUiThemes,
  removeCustomCodeTheme,
  removeCustomUiTheme,
} from '../../lib/customThemes';

const UI_THEME = JSON.stringify({
  version: 1,
  name: 'Imported Ocean',
  base: 'dark',
  colors: {
    '--bg': '#0b1220',
    '--accent': '#4ea1ff',
  },
});

const CODE_THEME = `.hljs {
  color: #d8dee9;
  background: #2e3440;
}
.hljs-keyword { color: #81a1c1; }
`;

function mountControl(kind: 'ui' | 'code' = 'ui') {
  return mount(ThemeImportControl, {
    attachTo: document.body,
    props: {
      kind,
      modelValue: kind === 'ui' ? 'paper' : 'github-dark',
      defaultValue: kind === 'ui' ? 'paper' : 'github-dark',
    },
  });
}

async function chooseFile(
  wrapper: ReturnType<typeof mountControl>,
  name: string,
  text: string,
): Promise<void> {
  const file = new File([text], name);
  Object.defineProperty(file, 'text', {
    value: async () => text,
  });
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [file],
  });
  await input.trigger('change');
  await flushPromises();
}

afterEach(() => {
  for (const theme of [...customUiThemes.value]) {
    removeCustomUiTheme(theme.id);
  }
  for (const theme of [...customCodeThemes.value]) {
    removeCustomCodeTheme(theme.id);
  }
  window.localStorage.clear();
  document.body.replaceChildren();
});

describe('ThemeImportControl', () => {
  it('imports a UI theme and selects it', async () => {
    const wrapper = mountControl('ui');

    await chooseFile(wrapper, 'ocean.json', UI_THEME);

    expect(customUiThemes.value[0]?.name).toBe('Imported Ocean');
    expect(wrapper.emitted('select')?.[0]).toEqual([
      customUiThemes.value[0].id,
    ]);
    expect(wrapper.text()).toContain('Imported Ocean');
    wrapper.unmount();
  });

  it('imports a code theme and selects it', async () => {
    const wrapper = mountControl('code');

    await chooseFile(wrapper, 'custom.css', CODE_THEME);

    expect(customCodeThemes.value[0]?.name).toBe('custom');
    expect(wrapper.emitted('select')?.[0]).toEqual([
      customCodeThemes.value[0].id,
    ]);
    wrapper.unmount();
  });

  it('shows an inline error for an invalid theme file', async () => {
    const wrapper = mountControl('ui');

    await chooseFile(wrapper, 'broken.json', '{}');

    expect(wrapper.find('[role="alert"]').text()).toContain(
      'name',
    );
    expect(wrapper.emitted('select')).toBeUndefined();
    wrapper.unmount();
  });

  it('falls back to the default when deleting the active theme', async () => {
    const wrapper = mountControl('ui');
    await chooseFile(wrapper, 'ocean.json', UI_THEME);
    const imported = customUiThemes.value[0];
    await wrapper.setProps({ modelValue: imported.id });

    await wrapper.find('.custom-theme-delete').trigger('click');

    expect(wrapper.emitted('select')?.at(-1)).toEqual(['paper']);
    expect(customUiThemes.value).toHaveLength(0);
    wrapper.unmount();
  });
});
