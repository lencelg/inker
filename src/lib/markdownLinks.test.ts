import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyMarkdownLink,
  handleMarkdownLinkClick,
  suppressLinkContextMenu,
} from './markdownLinks';

const mocks = vi.hoisted(() => ({
  openUrl: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: mocks.openUrl,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('markdown links', () => {
  it('classifies external website and mail links', () => {
    expect(classifyMarkdownLink('https://example.com/a?b=1')).toEqual({
      kind: 'external',
      href: 'https://example.com/a?b=1',
    });
    expect(classifyMarkdownLink('HTTP://example.com')).toEqual({
      kind: 'external',
      href: 'HTTP://example.com',
    });
    expect(classifyMarkdownLink('mailto:hello@example.com')).toEqual({
      kind: 'external',
      href: 'mailto:hello@example.com',
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

  it('opens external links only with Ctrl or Cmd left-click', () => {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', 'https://example.com');

    const plain = new MouseEvent('click', { cancelable: true });
    expect(handleMarkdownLinkClick(plain, anchor).kind).toBe('external');
    expect(plain.defaultPrevented).toBe(true);
    expect(mocks.openUrl).not.toHaveBeenCalled();

    const ctrl = new MouseEvent('click', {
      cancelable: true,
      ctrlKey: true,
    });
    handleMarkdownLinkClick(ctrl, anchor);
    expect(mocks.openUrl).toHaveBeenCalledWith('https://example.com');

    vi.clearAllMocks();
    const meta = new MouseEvent('click', {
      cancelable: true,
      metaKey: true,
    });
    handleMarkdownLinkClick(meta, anchor);
    expect(mocks.openUrl).toHaveBeenCalledWith('https://example.com');

    vi.clearAllMocks();
    const middle = new MouseEvent('auxclick', {
      button: 1,
      cancelable: true,
    });
    handleMarkdownLinkClick(middle, anchor);
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });

  it('returns internal targets without opening a browser', () => {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '#install');
    const click = new MouseEvent('click', {
      cancelable: true,
      ctrlKey: true,
    });

    expect(handleMarkdownLinkClick(click, anchor)).toEqual({
      kind: 'internal',
      fragment: 'install',
    });
    expect(mocks.openUrl).not.toHaveBeenCalled();
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
