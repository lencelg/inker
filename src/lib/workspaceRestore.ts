import { ancestorDirs } from './paths';
import type { ViewMode } from './viewModes';

export interface RestoreSnapshot {
  tabs: Array<{
    path: string;
    line: number;
    column: number;
    scrollTop: number;
  }>;
  activePath: string | null;
  previewPath: string | null;
  viewMode: ViewMode;
  expandedPaths: string[];
  activeView: 'explorer' | 'search';
  sidebarVisible: boolean;
}

export interface RestoreDraft {
  path: string;
  content: string;
}

export interface RestoreTab {
  path: string;
  content: string;
  savedContent: string;
}

export interface RestorePlan {
  tabs: RestoreTab[];
  activePath: string;
  previewPath: string | null;
  viewMode: ViewMode;
  expandedPaths: string[];
  activeView: 'explorer' | 'search';
  sidebarVisible: boolean;
  tabStates: Record<
    string,
    { line: number; column: number; scrollTop: number }
  >;
  recovered: number;
  staleDraftPaths: string[];
}

export interface RestorePlanInput {
  snapshot: RestoreSnapshot | null;
  drafts: readonly RestoreDraft[];
  diskContents: Record<string, string>;
  isImage: (path: string) => boolean;
}

export function buildRestorePlan({
  snapshot,
  drafts,
  diskContents,
  isImage,
}: RestorePlanInput): RestorePlan | null {
  const sessionTabs = snapshot?.tabs ?? [];
  const draftsByPath = new Map(
    drafts
      .filter((draft) => !isImage(draft.path))
      .map((draft) => [draft.path, draft] as const),
  );
  const sessionPaths = new Set(sessionTabs.map((tab) => tab.path));
  const orphanPaths = [...draftsByPath.keys()]
    .filter((path) => !sessionPaths.has(path))
    .sort();

  const tabs: RestoreTab[] = [];
  const staleDraftPaths: string[] = [];
  let recovered = 0;

  for (const tab of sessionTabs) {
    if (isImage(tab.path)) {
      tabs.push({ path: tab.path, content: '', savedContent: '' });
      continue;
    }

    const diskContent = diskContents[tab.path];
    if (diskContent === undefined) continue;

    let content = diskContent;
    const draft = draftsByPath.get(tab.path);
    if (draft) {
      if (draft.content === diskContent) {
        staleDraftPaths.push(tab.path);
      } else {
        content = draft.content;
        recovered += 1;
      }
    }

    tabs.push({
      path: tab.path,
      content,
      savedContent: diskContent,
    });
  }

  for (const path of orphanPaths) {
    const diskContent = diskContents[path];
    const draft = draftsByPath.get(path);
    if (diskContent === undefined || !draft) continue;
    if (draft.content === diskContent) {
      staleDraftPaths.push(path);
      continue;
    }
    tabs.push({
      path,
      content: draft.content,
      savedContent: diskContent,
    });
    recovered += 1;
  }

  if (tabs.length === 0) return null;

  const paths = new Set(tabs.map((tab) => tab.path));
  const dirtyPaths = new Set(
    tabs
      .filter((tab) => tab.content !== tab.savedContent)
      .map((tab) => tab.path),
  );
  const active =
    snapshot?.activePath && paths.has(snapshot.activePath)
      ? snapshot.activePath
      : tabs[0].path;
  const preview =
    snapshot?.previewPath &&
    paths.has(snapshot.previewPath) &&
    !dirtyPaths.has(snapshot.previewPath)
      ? snapshot.previewPath
      : null;

  const tabStates: RestorePlan['tabStates'] = {};
  for (const tab of sessionTabs) {
    if (isImage(tab.path) || !paths.has(tab.path)) continue;
    tabStates[tab.path] = {
      line: tab.line,
      column: tab.column,
      scrollTop: tab.scrollTop,
    };
  }

  return {
    tabs,
    activePath: active,
    previewPath: preview,
    viewMode: snapshot?.viewMode ?? 'source',
    expandedPaths: [
      ...new Set([
        ...(snapshot?.expandedPaths ?? []),
        ...ancestorDirs(active),
      ]),
    ],
    activeView: snapshot?.activeView ?? 'explorer',
    sidebarVisible: snapshot?.sidebarVisible ?? true,
    tabStates,
    recovered,
    staleDraftPaths,
  };
}
