import { describe, expect, it } from 'vitest';
import { Vim } from '@replit/codemirror-vim';

describe('EditorPane Vim command setup', () => {
  it('registers commands and mappings without throwing', () => {
    expect(() => Vim.defineEx('write', 'w', () => undefined)).not.toThrow();
    expect(() =>
      Vim.defineEx('pasteimage', 'pa', () => undefined),
    ).not.toThrow();
    expect(() =>
      Vim.defineAction('inkerPasteImage', () => undefined),
    ).not.toThrow();
    expect(() =>
      Vim.defineAction('inkerSave', () => undefined),
    ).not.toThrow();
    expect(() =>
      Vim.mapCommand('<Space>p', 'action', 'inkerPasteImage', {}, {
        context: 'normal',
      }),
    ).not.toThrow();
    expect(() => Vim.unmap('<Space>p', 'normal')).not.toThrow();
  });
});
