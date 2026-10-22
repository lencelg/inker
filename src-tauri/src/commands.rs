use crate::notes::{
    create_file as create_file_entry, create_folder as create_folder_entry, ensure_notes_dir,
    entry_path, list_entries, read_note as read_note_file, read_note_asset as read_asset_file,
    rename_entry as rename_entry_file, save_note as save_note_file, NoteAsset, NoteDetail,
    NotesState,
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
pub fn read_note(app: AppHandle, path: String) -> Result<NoteDetail, String> {
    read_note_file(&require_notes_dir(&app)?, &path)
}

#[tauri::command]
pub fn save_note(app: AppHandle, path: String, content: String) -> Result<(), String> {
    save_note_file(&require_notes_dir(&app)?, &path, &content)
}

#[tauri::command]
pub fn read_note_asset(
    app: AppHandle,
    note_path: String,
    source: String,
) -> Result<NoteAsset, String> {
    read_asset_file(&require_notes_dir(&app)?, &note_path, &source)
}

#[tauri::command]
pub fn create_file(app: AppHandle, parent: String, name: String) -> Result<String, String> {
    create_file_entry(&require_notes_dir(&app)?, &parent, &name)
}

#[tauri::command]
pub fn create_folder(app: AppHandle, parent: String, name: String) -> Result<String, String> {
    create_folder_entry(&require_notes_dir(&app)?, &parent, &name)
}

#[tauri::command]
pub fn rename_entry(app: AppHandle, path: String, name: String) -> Result<String, String> {
    rename_entry_file(&require_notes_dir(&app)?, &path, &name)
}

#[tauri::command]
pub fn delete_entry(app: AppHandle, path: String) -> Result<(), String> {
    let target = entry_path(&require_notes_dir(&app)?, &path)?;
    trash::delete(&target).map_err(|error| format!("移到回收站失败：{error}"))
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
            entries: Vec::new(),
        }),
    }
}

fn state_for_dir(notes_dir: &Path) -> Result<NotesState, String> {
    Ok(NotesState {
        notes_dir: Some(notes_dir.display().to_string()),
        entries: list_entries(notes_dir)?,
    })
}

fn require_notes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let settings = load_settings(app)?;
    let value = settings
        .notes_dir
        .ok_or_else(|| "请先选择笔记文件夹".to_string())?;
    ensure_notes_dir(&value)
}
