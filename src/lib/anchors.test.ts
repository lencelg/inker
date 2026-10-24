import { afterEach, describe, expect, it } from 'vitest';
import {
  findAnchorTarget,
  fragmentFromHref,
  headingSlug,
} from './anchors';

afterEach(() => {
  document.body.replaceChildren();
});

describe('heading anchors', () => {
  it('creates stable slugs for latin and Chinese headings', () => {
    expect(headingSlug('Hello, World!')).toBe('hello-world');
    expect(headingSlug('一、安装')).toBe('一安装');
    expect(headingSlug('C++ / C#')).toBe('c-c');
    expect(headingSlug('  Multiple   spaces  ')).toBe('multiple-spaces');
  });

  it('decodes internal fragments and ignores external links', () => {
    expect(fragmentFromHref('#%E5%AE%89%E8%A3%85')).toBe('安装');
    expect(fragmentFromHref('#install-setup')).toBe('install-setup');
    expect(fragmentFromHref('https://example.com/#section')).toBeNull();
    expect(fragmentFromHref(null)).toBeNull();
  });

  it('finds headings by id and falls back to heading text', () => {
    const root = document.createElement('div');
    const withId = document.createElement('h2');
    withId.id = 'install-setup';
    withId.textContent = 'Install Setup';
    const withoutId = document.createElement('h2');
    withoutId.textContent = '一、安装';
    root.append(withId, withoutId);
    document.body.append(root);

    expect(findAnchorTarget(root, 'install-setup')).toBe(withId);
    expect(findAnchorTarget(root, '一安装')).toBe(withoutId);
    expect(findAnchorTarget(root, 'missing')).toBeNull();
  });
});
