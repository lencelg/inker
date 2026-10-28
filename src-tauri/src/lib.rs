mod commands;
mod notes;
mod settings;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(watcher::NotesWatcher::default())
        .setup(|app| {
            let handle = app.handle().clone();
            if let Ok(settings) = settings::load_settings(&handle) {
                if let Some(value) = settings.notes_dir {
                    if let Ok(notes_dir) = notes::ensure_notes_dir(&value) {
                        let _ = notes::cleanup_stale_temp_files(&notes_dir);
                        if let Err(error) = watcher::watch_notes(&handle, &notes_dir) {
                            eprintln!("{error}");
                        }
                    }
                }
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_state,
            commands::choose_notes_dir,
            commands::refresh_notes,
            commands::read_note,
            commands::save_note,
            commands::save_note_image,
            commands::save_export,
            commands::read_note_asset,
            commands::read_image,
            commands::search_notes,
            commands::create_file,
            commands::create_folder,
            commands::rename_entry,
            commands::delete_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
