export interface FileEntry {
  path: string;
  name: string;
  isDir: boolean;
}

export interface NotesState {
  notesDir: string | null;
  entries: FileEntry[];
}

export interface NoteDetail {
  path: string;
  content: string;
}

export interface NoteAsset {
  mime: string;
  data: string;
}

export interface SearchMatch {
  path: string;
  name: string;
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchLength: number;
}

export interface SearchResults {
  matches: SearchMatch[];
  truncated: boolean;
}

export interface NotesApi {
  getState(): Promise<NotesState>;
  pickNotesDir(): Promise<string | null>;
  chooseNotesDir(path: string): Promise<NotesState>;
  refresh(): Promise<NotesState>;
  readNote(path: string): Promise<NoteDetail>;
  saveNote(path: string, content: string): Promise<void>;
  saveImage(
    notePath: string,
    fileName: string,
    data: string,
  ): Promise<string>;
  readAsset(notePath: string, source: string): Promise<NoteAsset>;
  searchNotes(query: string): Promise<SearchResults>;
  createFile(parent: string, name: string): Promise<string>;
  createFolder(parent: string, name: string): Promise<string>;
  renameEntry(path: string, name: string): Promise<string>;
  deleteEntry(path: string): Promise<void>;
  openSettingsWindow(): Promise<void>;
}
