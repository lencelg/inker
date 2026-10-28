import type { Preferences } from './preferences';

export const WORKSPACE_SETTINGS_STORAGE_KEY =
  'inker-workspace-settings-v1';
export const MAX_WORKSPACE_SETTINGS = 20;

export type WorkspaceOverrides = Partial<Preferences>;
export type WorkspaceSettingsMap = Record<
  string,
  WorkspaceOverrides
>;

export const WORKSPACE_OVERRIDE_KEYS: ReadonlyArray<
  keyof Preferences
> = [
  'theme',
  'fontSize',
  'fontFamily',
  'vimEnabled',
  'immersive',
  'codeHighlight',
  'codeTheme',
  'sourceHighlight',
  'autoSave',
  'autoSaveDelay',
  'imageConfirmPaste',
  'imageNameTemplate',
  'imageFormat',
  'imageFolder',
  'imageQuality',
  'vimMappings',
  'quickOpenIncludeImages',
  'exportEmbedImages',
  'exportOpenAfter',
  'exportIncludeToc',
];

const overrideKeySet = new Set<keyof Preferences>(
  WORKSPACE_OVERRIDE_KEYS,
);

export function isWorkspaceOverrideKey(
  key: keyof Preferences,
): boolean {
  return overrideKeySet.has(key);
}

function trimWorkspace(notesDir: string | null): string {
  return notesDir?.trim() ?? '';
}

function pruneWorkspaces(
  map: WorkspaceSettingsMap,
): WorkspaceSettingsMap {
  const keys = Object.keys(map);
  if (keys.length <= MAX_WORKSPACE_SETTINGS) return map;
  return Object.fromEntries(
    keys
      .slice(-MAX_WORKSPACE_SETTINGS)
      .map((key) => [key, map[key]]),
  );
}

function moveWorkspaceToEnd(
  map: WorkspaceSettingsMap,
  workspace: string,
): WorkspaceSettingsMap {
  const keys = Object.keys(map).filter((key) => key !== workspace);
  keys.push(workspace);
  return Object.fromEntries(
    keys.map((key) => [key, map[key]]),
  );
}

export function normalizeWorkspaceSettings(
  value: unknown,
): WorkspaceSettingsMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: WorkspaceSettingsMap = {};
  for (const [workspace, raw] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (!workspace || !raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue;
    }
    const source = raw as Record<string, unknown>;
    const overrides: WorkspaceOverrides = {};
    for (const key of WORKSPACE_OVERRIDE_KEYS) {
      if (source[key] !== undefined && source[key] !== null) {
        (overrides as Record<string, unknown>)[key] = source[key];
      }
    }
    if (Object.keys(overrides).length > 0) {
      result[workspace] = overrides;
    }
  }

  return pruneWorkspaces(result);
}

export function workspaceOverridesFor(
  map: WorkspaceSettingsMap,
  notesDir: string | null,
): WorkspaceOverrides {
  const workspace = trimWorkspace(notesDir);
  if (!workspace) return {};
  return map[workspace] ?? {};
}

export function setWorkspaceOverrides(
  map: WorkspaceSettingsMap,
  notesDir: string | null,
  patch: WorkspaceOverrides,
): WorkspaceSettingsMap {
  const workspace = trimWorkspace(notesDir);
  if (!workspace) return map;

  const allowed: WorkspaceOverrides = {};
  for (const key of WORKSPACE_OVERRIDE_KEYS) {
    const value = patch[key];
    if (value !== undefined) {
      (allowed as Record<string, unknown>)[key] = value;
    }
  }
  if (Object.keys(allowed).length === 0) return map;

  const next: WorkspaceSettingsMap = {
    ...map,
    [workspace]: { ...(map[workspace] ?? {}), ...allowed },
  };
  return pruneWorkspaces(moveWorkspaceToEnd(next, workspace));
}

export function removeWorkspaceOverride(
  map: WorkspaceSettingsMap,
  notesDir: string | null,
  key: keyof Preferences,
): WorkspaceSettingsMap {
  const workspace = trimWorkspace(notesDir);
  const current = map[workspace];
  if (!workspace || !current || !(key in current)) return map;

  const nextOverrides = { ...current };
  delete nextOverrides[key];
  const next = { ...map };
  if (Object.keys(nextOverrides).length === 0) {
    delete next[workspace];
  } else {
    next[workspace] = nextOverrides;
  }
  return next;
}

export function readWorkspaceSettingsMap(): WorkspaceSettingsMap {
  try {
    const raw = window.localStorage.getItem(
      WORKSPACE_SETTINGS_STORAGE_KEY,
    );
    if (!raw) return {};
    return normalizeWorkspaceSettings(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeWorkspaceSettingsMap(
  map: WorkspaceSettingsMap,
): void {
  try {
    window.localStorage.setItem(
      WORKSPACE_SETTINGS_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    // Workspace overrides are optional.
  }
}
