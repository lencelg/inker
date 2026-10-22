export interface NoteMeta {
  filename: string;
  title: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteDetail {
  note: NoteMeta;
  content: string;
}

export interface NotesState {
  notesDir: string | null;
  notes: NoteMeta[];
}

export interface CreateNoteInput {
  title: string;
  content: string;
}

export interface UpdateNoteInput extends CreateNoteInput {
  filename: string;
}

export type IssueSeverity = 'error' | 'warning';

export interface SyntaxIssue {
  line: number;
  severity: IssueSeverity;
  rule: string;
  message: string;
}

export interface NotesApi {
  getState(): Promise<NotesState>;
  chooseNotesDir(): Promise<NotesState | null>;
  refresh(): Promise<NotesState>;
  readNote(filename: string): Promise<NoteDetail>;
  createNote(input: CreateNoteInput): Promise<NoteMeta>;
  updateNote(input: UpdateNoteInput): Promise<NoteMeta>;
  deleteNote(filename: string): Promise<void>;
  importNote(): Promise<NoteMeta | null>;
}
