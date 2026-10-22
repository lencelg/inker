import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type {
  CreateNoteInput,
  NoteDetail,
  NoteMeta,
  NotesApi,
  NotesState,
  UpdateNoteInput,
} from './types';

export const api: NotesApi = {
  getState: () => invoke<NotesState>('get_state'),

  chooseNotesDir: async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择笔记文件夹',
    });
    if (typeof selected !== 'string') {
      return null;
    }
    return invoke<NotesState>('choose_notes_dir', { path: selected });
  },

  refresh: () => invoke<NotesState>('refresh_notes'),

  readNote: (filename) => invoke<NoteDetail>('read_note', { filename }),

  createNote: (input: CreateNoteInput) => invoke<NoteMeta>('create_note', { input }),

  updateNote: (input: UpdateNoteInput) => invoke<NoteMeta>('update_note', { input }),

  deleteNote: (filename) => invoke<void>('delete_note', { filename }),

  importNote: async () => {
    const selected = await open({
      multiple: false,
      title: '导入 Markdown',
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    if (typeof selected !== 'string') {
      return null;
    }
    return invoke<NoteMeta>('import_note', { source: selected });
  },
};
