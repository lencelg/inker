mod commands;
mod notes;
mod settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_state,
            commands::choose_notes_dir,
            commands::refresh_notes,
            commands::read_note,
            commands::save_note,
            commands::save_note_image,
            commands::save_export,
            commands::read_note_asset,
            commands::search_notes,
            commands::create_file,
            commands::create_folder,
            commands::rename_entry,
            commands::delete_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
