use crate::notes::{
    create_note as create_note_file, ensure_notes_dir, import_note as import_note_file, list_notes,
    note_path, read_note as read_note_file, update_note as update_note_file, CreateNoteInput,
    NoteDetail, NoteMeta, NotesState, UpdateNoteInput,
};
use crate::settings::{load_settings, save_settings, Settings};
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[tauri::command]
pub fn get_state(app: AppHandle) -> Result<NotesState, String> {
    current_state(&app)
}

#[tauri::command]
pub fn choose_notes_dir(app: AppHandle, path: String) -> Result<NotesState, String> {
    let notes_dir = ensure_notes_dir(&path)?;
    save_settings(
        &app,
        &Settings {
            notes_dir: Some(notes_dir.display().to_string()),
        },
    )?;
    state_for_dir(&notes_dir)
}

#[tauri::command]
pub fn refresh_notes(app: AppHandle) -> Result<NotesState, String> {
    current_state(&app)
}

#[tauri::command]
pub fn read_note(app: AppHandle, filename: String) -> Result<NoteDetail, String> {
    read_note_file(&require_notes_dir(&app)?, &filename)
}

#[tauri::command]
pub fn create_note(app: AppHandle, input: CreateNoteInput) -> Result<NoteMeta, String> {
    create_note_file(&require_notes_dir(&app)?, input)
}

#[tauri::command]
pub fn update_note(app: AppHandle, input: UpdateNoteInput) -> Result<NoteMeta, String> {
    update_note_file(&require_notes_dir(&app)?, input)
}

#[tauri::command]
pub fn delete_note(app: AppHandle, filename: String) -> Result<(), String> {
    let path = note_path(&require_notes_dir(&app)?, &filename)?;
    trash::delete(&path).map_err(|error| format!("移到回收站失败：{error}"))
}

#[tauri::command]
pub fn import_note(app: AppHandle, source: String) -> Result<NoteMeta, String> {
    import_note_file(&require_notes_dir(&app)?, &source)
}

fn current_state(app: &AppHandle) -> Result<NotesState, String> {
    let settings = load_settings(app)?;
    match settings.notes_dir {
        Some(value) => {
            let notes_dir = ensure_notes_dir(&value)?;
            state_for_dir(&notes_dir)
        }
        None => Ok(NotesState {
            notes_dir: None,
            notes: Vec::new(),
        }),
    }
}

fn state_for_dir(notes_dir: &Path) -> Result<NotesState, String> {
    Ok(NotesState {
        notes_dir: Some(notes_dir.display().to_string()),
        notes: list_notes(notes_dir)?,
    })
}

fn require_notes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let settings = load_settings(app)?;
    let value = settings
        .notes_dir
        .ok_or_else(|| "请先选择笔记文件夹".to_string())?;
    ensure_notes_dir(&value)
}
