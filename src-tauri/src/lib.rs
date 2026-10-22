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
            commands::create_note,
            commands::update_note,
            commands::delete_note,
            commands::import_note
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
