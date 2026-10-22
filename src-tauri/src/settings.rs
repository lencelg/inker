use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Settings {
    #[serde(rename = "notesDir", default)]
    pub notes_dir: Option<String>,
}

pub fn load_settings(app: &AppHandle) -> Result<Settings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(Settings::default());
    }
    let raw = fs::read_to_string(&path).map_err(|error| format!("读取设置失败：{error}"))?;
    serde_json::from_str(&raw).map_err(|error| format!("解析设置失败：{error}"))
}

pub fn save_settings(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建配置目录失败：{error}"))?;
    }
    let raw = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("序列化设置失败：{error}"))?;
    fs::write(&path, raw).map_err(|error| format!("写入设置失败：{error}"))
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("无法获取配置目录：{error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("创建配置目录失败：{error}"))?;
    Ok(dir.join("settings.json"))
}
