import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type {
  NoteAsset,
  NoteDetail,
  NotesApi,
  NotesState,
  SearchResults,
} from './types';

export const api: NotesApi = {
  getState: () => invoke<NotesState>('get_state'),

  pickNotesDir: async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择笔记文件夹',
    });
    return typeof selected === 'string' ? selected : null;
  },

  chooseNotesDir: (path) => invoke<NotesState>('choose_notes_dir', { path }),

  refresh: () => invoke<NotesState>('refresh_notes'),

  readNote: (path) => invoke<NoteDetail>('read_note', { path }),

  saveNote: (path, content) => invoke<void>('save_note', { path, content }),

  saveImage: (notePath, fileName, data) =>
    invoke<string>('save_note_image', { notePath, fileName, data }),

  saveExport: (path, data, binary) =>
    invoke<void>('save_export', { path, data, binary }),

  readAsset: (notePath, source) =>
    invoke<NoteAsset>('read_note_asset', { notePath, source }),

  searchNotes: (query) => invoke<SearchResults>('search_notes', { query }),

  createFile: (parent, name) => invoke<string>('create_file', { parent, name }),

  createFolder: (parent, name) => invoke<string>('create_folder', { parent, name }),

  renameEntry: (path, name) => invoke<string>('rename_entry', { path, name }),

  deleteEntry: (path) => invoke<void>('delete_entry', { path }),
};
