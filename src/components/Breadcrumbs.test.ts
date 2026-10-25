import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import Breadcrumbs from './Breadcrumbs.vue';
import { setLanguage } from '../lib/i18n';

describe('Breadcrumbs', () => {
  it('renders the heading path with the current section marked', () => {
    setLanguage('en');
    const wrapper = mount(Breadcrumbs, {
      props: {
        items: [
          { level: 1, text: 'Frontend Basis' },
          { level: 2, text: 'Bundlers + Transpilers' },
        ],
      },
    });

    expect(wrapper.get('nav').attributes('aria-label')).toBe(
      'Heading path',
    );
    expect(
      wrapper.findAll('.breadcrumb-label').map((item) => item.text()),
    ).toEqual(['Frontend Basis', 'Bundlers + Transpilers']);
    expect(wrapper.findAll('.breadcrumb-separator')).toHaveLength(1);
    expect(
      wrapper.findAll('.breadcrumb-label')[1].attributes('aria-current'),
    ).toBe('location');
  });

  it('renders nothing without headings', () => {
    const wrapper = mount(Breadcrumbs, { props: { items: [] } });
    expect(wrapper.find('nav').exists()).toBe(false);
  });
});
