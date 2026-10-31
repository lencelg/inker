import { describe, expect, it, vi } from 'vitest';
import {
  classifyMarkdownLink,
  isExternalHref,
  isExternalLinkOpenGesture,
  suppressLinkContextMenu,
} from './markdownLinks';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(async () => undefined),
}));

describe('markdown links', () => {
  it('classifies external website and mail links', () => {
    expect(isExternalHref('https://example.com')).toBe(true);
    expect(isExternalHref('HTTP://example.com')).toBe(true);
    expect(isExternalHref('mailto:hello@example.com')).toBe(true);
    expect(classifyMarkdownLink('https://example.com/a?b=1')).toEqual({
      kind: 'external',
      href: 'https://example.com/a?b=1',
    });
  });

  it('classifies heading anchors as internal', () => {
    expect(classifyMarkdownLink('#install')).toEqual({
      kind: 'internal',
      fragment: 'install',
    });
    expect(classifyMarkdownLink('#%E5%AE%89%E8%A3%85')).toEqual({
      kind: 'internal',
      fragment: '安装',
    });
  });

  it('requires Ctrl or Cmd left-click to open external links', () => {
    expect(isExternalLinkOpenGesture({ button: 0 })).toBe(false);
    expect(
      isExternalLinkOpenGesture({ button: 0, ctrlKey: true }),
    ).toBe(true);
    expect(
      isExternalLinkOpenGesture({ button: 0, metaKey: true }),
    ).toBe(true);
    expect(
      isExternalLinkOpenGesture({ button: 1, ctrlKey: true }),
    ).toBe(false);
  });

  it('suppresses the context menu only for links', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<p id="body">Body</p><a href="https://example.com">Docs</a>';
    root.addEventListener('contextmenu', suppressLinkContextMenu);

    const linkMenu = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    root.querySelector('a')?.dispatchEvent(linkMenu);

    const bodyMenu = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    root.querySelector('#body')?.dispatchEvent(bodyMenu);

    expect(linkMenu.defaultPrevented).toBe(true);
    expect(bodyMenu.defaultPrevented).toBe(false);
  });

  it('ignores relative and empty links', () => {
    expect(classifyMarkdownLink('other.md')).toEqual({ kind: 'none' });
    expect(classifyMarkdownLink('/notes/other.md')).toEqual({
      kind: 'none',
    });
    expect(classifyMarkdownLink('')).toEqual({ kind: 'none' });
    expect(classifyMarkdownLink(null)).toEqual({ kind: 'none' });
  });
});
