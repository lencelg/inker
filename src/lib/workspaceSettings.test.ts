import { afterEach, describe, expect, it } from 'vitest';
import {
  isWorkspaceOverrideKey,
  MAX_WORKSPACE_SETTINGS,
  normalizeWorkspaceSettings,
  readWorkspaceSettingsMap,
  removeWorkspaceOverride,
  setWorkspaceOverrides,
  workspaceOverridesFor,
  WORKSPACE_SETTINGS_STORAGE_KEY,
  writeWorkspaceSettingsMap,
} from './workspaceSettings';

afterEach(() => {
  window.localStorage.clear();
});

describe('workspace settings', () => {
  it('normalizes supported override keys', () => {
    expect(
      normalizeWorkspaceSettings({
        '/notes': {
          fontSize: 18,
          autoSave: true,
          language: 'zh',
          unknown: 1,
        },
        '/empty': {},
        '/bad': 'nope',
        '': { fontSize: 12 },
      }),
    ).toEqual({
      '/notes': { fontSize: 18, autoSave: true },
    });
  });

  it('marks which preferences can be overridden per workspace', () => {
    expect(isWorkspaceOverrideKey('theme')).toBe(true);
    expect(isWorkspaceOverrideKey('autoSave')).toBe(true);
    expect(isWorkspaceOverrideKey('language')).toBe(false);
    expect(isWorkspaceOverrideKey('restoreSession')).toBe(false);
  });

  it('merges and removes overrides per workspace', () => {
    let map = setWorkspaceOverrides({}, '/notes', {
      fontSize: 18,
    });
    map = setWorkspaceOverrides(map, '/notes', {
      autoSave: true,
    });

    expect(workspaceOverridesFor(map, '/notes')).toEqual({
      fontSize: 18,
      autoSave: true,
    });

    map = removeWorkspaceOverride(map, '/notes', 'fontSize');

    expect(workspaceOverridesFor(map, '/notes')).toEqual({
      autoSave: true,
    });
  });

  it('removes the workspace when its last override is reset', () => {
    const map = setWorkspaceOverrides({}, '/notes', {
      fontSize: 18,
    });

    expect(
      removeWorkspaceOverride(map, '/notes', 'fontSize'),
    ).toEqual({});
  });

  it('caps stored workspaces and keeps recently updated ones', () => {
    let map = {};
    for (let index = 0; index < MAX_WORKSPACE_SETTINGS + 2; index += 1) {
      map = setWorkspaceOverrides(map, `/notes-${index}`, {
        fontSize: 14 + index,
      });
    }

    expect(Object.keys(map)).toHaveLength(MAX_WORKSPACE_SETTINGS);
    expect(workspaceOverridesFor(map, '/notes-0')).toEqual({});
    expect(workspaceOverridesFor(map, '/notes-21')).toEqual({
      fontSize: 35,
    });
  });

  it('reads and writes the storage map', () => {
    const map = setWorkspaceOverrides({}, '/notes', {
      autoSave: true,
    });

    writeWorkspaceSettingsMap(map);

    expect(
      window.localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY),
    ).toContain('autoSave');
    expect(readWorkspaceSettingsMap()).toEqual(map);
  });
});
