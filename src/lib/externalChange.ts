export type ExternalChangeAction =
  | 'ignore'
  | 'adopt'
  | 'reload'
  | 'conflict';

export interface ExternalChangeInput {
  content: string;
  savedContent: string;
  diskContent: string;
  saving: boolean;
}

export function classifyExternalChange({
  content,
  savedContent,
  diskContent,
  saving,
}: ExternalChangeInput): ExternalChangeAction {
  if (saving || diskContent === savedContent) return 'ignore';
  if (diskContent === content) return 'adopt';
  if (content === savedContent) return 'reload';
  return 'conflict';
}

export function conflictedCopyPath(
  notesDir: string | null,
  notePath: string,
): string {
  const slash = notePath.lastIndexOf('/');
  const folder = slash >= 0 ? notePath.slice(0, slash + 1) : '';
  const name = slash >= 0 ? notePath.slice(slash + 1) : notePath;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : '';
  const prefix = notesDir
    ? `${notesDir.replace(/[\\/]+$/, '')}/`
    : '';
  return `${prefix}${folder}${stem} (conflicted copy)${extension}`;
}
