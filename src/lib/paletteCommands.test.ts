import { describe, expect, it } from 'vitest';
import { t } from './i18n';
import {
  codeThemePaletteItems,
  commandPaletteItems,
  themePaletteItems,
} from './paletteCommands';

const state = {
  canEdit: true,
  vimEnabled: true,
  immersive: false,
  autoSave: true,
  quickOpenIncludeImages: false,
  sidebarVisible: true,
};

describe('palette command items', () => {
  it('builds the command list with toggle states', () => {
    const items = commandPaletteItems(state);
    const byId = new Map(items.map((item) => [item.id, item]));

    expect(byId.has('preferences.colorTheme')).toBe(true);
    expect(byId.has('markdown.createToc')).toBe(true);
    expect(byId.get('preferences.toggleVim')?.detail).toBe(
      t('palette.on'),
    );
    expect(byId.get('preferences.toggleZen')?.detail).toBe(
      t('palette.off'),
    );
    expect(byId.get('file.save')?.disabled).toBe(false);
  });

  it('disables editing commands when no editable note is open', () => {
    const items = commandPaletteItems({
      ...state,
      canEdit: false,
    });
    const byId = new Map(items.map((item) => [item.id, item]));

    expect(byId.get('file.save')?.disabled).toBe(true);
    expect(byId.get('markdown.createToc')?.disabled).toBe(true);
  });

  it('marks the current UI theme', () => {
    const items = themePaletteItems('dark');

    expect(items[0].kind).toBe('back');
    expect(
      items.find((item) => item.id === 'dark')?.detail,
    ).toBe(t('palette.current'));
    expect(
      items.find((item) => item.id === 'paper')?.detail,
    ).toBeUndefined();
  });

  it('marks the current code theme', () => {
    const items = codeThemePaletteItems('monokai');

    expect(items[0].kind).toBe('back');
    expect(
      items.find((item) => item.id === 'monokai')?.detail,
    ).toBe(t('palette.current'));
  });
});
