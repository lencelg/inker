use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    time::SystemTime,
};

const NOTE_EXTENSION: &str = ".md";
const MAX_TITLE_CHARS: usize = 60;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteMeta {
    pub filename: String,
    pub title: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteDetail {
    pub note: NoteMeta,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesState {
    pub notes_dir: Option<String>,
    pub notes: Vec<NoteMeta>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteInput {
    pub title: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNoteInput {
    pub filename: String,
    pub title: String,
    pub content: String,
}

pub fn ensure_notes_dir(value: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(value);
    if !path.is_absolute() {
        return Err("笔记文件夹必须是绝对路径".to_string());
    }
    fs::create_dir_all(&path).map_err(|error| format!("创建笔记文件夹失败：{error}"))?;
    if !path.is_dir() {
        return Err("所选路径不是文件夹".to_string());
    }
    Ok(path)
}

pub fn list_notes(notes_dir: &Path) -> Result<Vec<NoteMeta>, String> {
    let mut notes = Vec::new();
    let entries =
        fs::read_dir(notes_dir).map_err(|error| format!("读取笔记文件夹失败：{error}"))?;

    for entry in entries {
        let entry = entry.map_err(|error| format!("读取文件夹项失败：{error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("读取文件类型失败：{error}"))?;
        if !file_type.is_file() {
            continue;
        }

        let filename = entry.file_name().to_string_lossy().to_string();
        if filename.starts_with('.') || !filename.to_ascii_lowercase().ends_with(NOTE_EXTENSION) {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|error| format!("读取笔记信息失败：{error}"))?;
        notes.push(meta_from_metadata(&filename, &metadata));
    }

    notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(notes)
}

pub fn read_note(notes_dir: &Path, filename: &str) -> Result<NoteDetail, String> {
    let path = note_path(notes_dir, filename)?;
    let content = fs::read_to_string(&path).map_err(|error| format!("读取笔记失败：{error}"))?;
    let metadata = fs::metadata(&path).map_err(|error| format!("读取笔记信息失败：{error}"))?;
    Ok(NoteDetail {
        note: meta_from_metadata(filename, &metadata),
        content,
    })
}

pub fn get_note_meta(notes_dir: &Path, filename: &str) -> Result<NoteMeta, String> {
    let path = note_path(notes_dir, filename)?;
    let metadata = fs::metadata(&path).map_err(|error| format!("读取笔记信息失败：{error}"))?;
    Ok(meta_from_metadata(filename, &metadata))
}

pub fn create_note(notes_dir: &Path, input: CreateNoteInput) -> Result<NoteMeta, String> {
    let title = resolve_title(&input.title, &input.content);
    let filename = unique_filename(notes_dir, &title, None)?;
    fs::write(notes_dir.join(&filename), input.content.as_bytes())
        .map_err(|error| format!("写入笔记失败：{error}"))?;
    get_note_meta(notes_dir, &filename)
}

pub fn update_note(notes_dir: &Path, input: UpdateNoteInput) -> Result<NoteMeta, String> {
    let path = note_path(notes_dir, &input.filename)?;
    fs::write(&path, input.content.as_bytes()).map_err(|error| format!("写入笔记失败：{error}"))?;

    let title = resolve_title(&input.title, &input.content);
    let current_title = title_from_filename(&input.filename);
    let mut filename = input.filename.clone();

    if current_title.to_lowercase() != title.to_lowercase() {
        let target = unique_filename(notes_dir, &title, Some(&input.filename))?;
        if target.to_lowercase() != input.filename.to_lowercase() {
            fs::rename(&path, notes_dir.join(&target))
                .map_err(|error| format!("重命名笔记失败：{error}"))?;
            filename = target;
        }
    }

    get_note_meta(notes_dir, &filename)
}

pub fn import_note(notes_dir: &Path, source_value: &str) -> Result<NoteMeta, String> {
    let source = PathBuf::from(source_value);
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase())
        .unwrap_or_default();

    if extension != "md" && extension != "markdown" {
        return Err("请选择 .md 或 .markdown 文件".to_string());
    }

    let metadata = fs::metadata(&source).map_err(|error| format!("读取导入文件失败：{error}"))?;
    if !metadata.is_file() {
        return Err("请选择文件而不是文件夹".to_string());
    }

    if source.parent() == Some(notes_dir) && extension == "md" {
        let filename = source
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .ok_or_else(|| "导入文件名无效".to_string())?;
        return get_note_meta(notes_dir, &filename);
    }

    let base_title = source
        .file_stem()
        .and_then(|value| value.to_str())
        .map(normalize_title)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Untitled".to_string());
    let filename = unique_filename(notes_dir, &base_title, None)?;
    fs::copy(&source, notes_dir.join(&filename))
        .map_err(|error| format!("复制导入文件失败：{error}"))?;
    get_note_meta(notes_dir, &filename)
}

pub fn note_path(notes_dir: &Path, filename: &str) -> Result<PathBuf, String> {
    if filename.is_empty()
        || filename.contains('\0')
        || filename.contains(':')
        || filename.contains('/')
        || filename.contains('\\')
        || filename.starts_with('.')
        || !filename.to_ascii_lowercase().ends_with(NOTE_EXTENSION)
    {
        return Err("笔记文件名无效".to_string());
    }

    let path = notes_dir.join(filename);
    if path.parent() != Some(notes_dir) {
        return Err("笔记路径无效".to_string());
    }
    Ok(path)
}

fn resolve_title(value: &str, content: &str) -> String {
    let explicit = normalize_title(value);
    if !explicit.is_empty() {
        return explicit;
    }

    let derived = derive_title(content);
    if derived.is_empty() {
        "Untitled".to_string()
    } else {
        derived
    }
}

fn derive_title(content: &str) -> String {
    let mut fallback: Option<&str> = None;

    for line in content.lines() {
        if fallback.is_none() && !line.trim().is_empty() {
            fallback = Some(line.trim());
        }
        if let Some(heading) = heading_text(line) {
            return normalize_title(heading);
        }
    }

    fallback.map(normalize_title).unwrap_or_default()
}

fn heading_text(line: &str) -> Option<&str> {
    let leading_spaces = line.chars().take_while(|value| *value == ' ').count();
    if leading_spaces > 3 {
        return None;
    }

    let trimmed = &line[leading_spaces..];
    let hashes = trimmed.chars().take_while(|value| *value == '#').count();
    if hashes == 0 || hashes > 6 {
        return None;
    }

    let rest = &trimmed[hashes..];
    if rest
        .chars()
        .next()
        .is_some_and(|value| value.is_whitespace())
        && !rest.trim().is_empty()
    {
        Some(rest.trim())
    } else {
        None
    }
}

fn normalize_title(value: &str) -> String {
    let mut cleaned = String::with_capacity(value.len());
    for character in value.chars() {
        if character.is_control() {
            continue;
        }
        if matches!(
            character,
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|'
        ) {
            cleaned.push(' ');
        } else {
            cleaned.push(character);
        }
    }

    let collapsed = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = collapsed.trim_matches(|character: char| character == '.' || character == ' ');
    let mut title: String = trimmed.chars().take(MAX_TITLE_CHARS).collect();
    title = title.trim().trim_matches('.').trim().to_string();

    if is_windows_reserved(&title) {
        title.push('_');
    }
    title
}

fn is_windows_reserved(value: &str) -> bool {
    matches!(
        value.to_ascii_lowercase().as_str(),
        "con"
            | "prn"
            | "aux"
            | "nul"
            | "com1"
            | "com2"
            | "com3"
            | "com4"
            | "com5"
            | "com6"
            | "com7"
            | "com8"
            | "com9"
            | "lpt1"
            | "lpt2"
            | "lpt3"
            | "lpt4"
            | "lpt5"
            | "lpt6"
            | "lpt7"
            | "lpt8"
            | "lpt9"
    )
}

fn unique_filename(notes_dir: &Path, base: &str, ignore: Option<&str>) -> Result<String, String> {
    let mut taken = HashSet::new();
    let ignore = ignore.map(|value| value.to_lowercase());

    for entry in fs::read_dir(notes_dir).map_err(|error| format!("读取笔记文件夹失败：{error}"))?
    {
        let entry = entry.map_err(|error| format!("读取文件夹项失败：{error}"))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if ignore
            .as_ref()
            .is_some_and(|value| value == &name.to_lowercase())
        {
            continue;
        }
        taken.insert(name.to_lowercase());
    }

    let mut filename = format!("{base}{NOTE_EXTENSION}");
    let mut index = 2;
    while taken.contains(&filename.to_lowercase()) {
        filename = format!("{base} {index}{NOTE_EXTENSION}");
        index += 1;
    }
    Ok(filename)
}

fn title_from_filename(filename: &str) -> String {
    filename[..filename.len() - NOTE_EXTENSION.len()].to_string()
}

fn meta_from_metadata(filename: &str, metadata: &fs::Metadata) -> NoteMeta {
    let updated = metadata.modified().ok();
    let created = metadata.created().ok().or(updated);

    NoteMeta {
        filename: filename.to_string(),
        title: title_from_filename(filename),
        size_bytes: metadata.len(),
        created_at: created.map(to_rfc3339).unwrap_or_default(),
        updated_at: updated.map(to_rfc3339).unwrap_or_default(),
    }
}

fn to_rfc3339(time: SystemTime) -> String {
    let datetime: DateTime<Utc> = time.into();
    datetime.to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn normalizes_and_deduplicates_titles() {
        assert_eq!(normalize_title("  My: Note?  "), "My Note");
        assert_eq!(normalize_title("con"), "con_");
        assert_eq!(normalize_title(".."), "");

        let dir = tempdir().unwrap();
        let first = create_note(
            dir.path(),
            CreateNoteInput {
                title: String::new(),
                content: "# First note\n".to_string(),
            },
        )
        .unwrap();
        assert_eq!(first.filename, "First note.md");

        let second = create_note(
            dir.path(),
            CreateNoteInput {
                title: "First note".to_string(),
                content: "body".to_string(),
            },
        )
        .unwrap();
        assert_eq!(second.filename, "First note 2.md");
    }

    #[test]
    fn rejects_path_traversal() {
        let dir = tempdir().unwrap();
        assert!(note_path(dir.path(), "../evil.md").is_err());
        assert!(note_path(dir.path(), "nested/evil.md").is_err());
        assert!(note_path(dir.path(), ".hidden.md").is_err());
        assert!(note_path(dir.path(), "note.txt").is_err());
    }

    #[test]
    fn creates_reads_renames_and_imports_notes() {
        let dir = tempdir().unwrap();
        let notes_dir = dir.path();

        let created = create_note(
            notes_dir,
            CreateNoteInput {
                title: "Hello".to_string(),
                content: "# Hello\n\nBody".to_string(),
            },
        )
        .unwrap();
        assert_eq!(created.filename, "Hello.md");
        assert!(notes_dir.join("Hello.md").exists());

        let detail = read_note(notes_dir, &created.filename).unwrap();
        assert_eq!(detail.note.title, "Hello");
        assert_eq!(detail.content, "# Hello\n\nBody");

        let renamed = update_note(
            notes_dir,
            UpdateNoteInput {
                filename: created.filename.clone(),
                title: "Renamed".to_string(),
                content: "# Renamed\n".to_string(),
            },
        )
        .unwrap();
        assert_eq!(renamed.filename, "Renamed.md");
        assert!(!notes_dir.join("Hello.md").exists());
        assert_eq!(
            read_note(notes_dir, "Renamed.md").unwrap().content,
            "# Renamed\n"
        );

        let source_dir = tempdir().unwrap();
        let source = source_dir.path().join("Imported.md");
        fs::write(&source, "# Imported\n").unwrap();
        let imported = import_note(notes_dir, source.to_str().unwrap()).unwrap();
        assert_eq!(imported.filename, "Imported.md");
        assert_eq!(
            read_note(notes_dir, "Imported.md").unwrap().content,
            "# Imported\n"
        );

        let notes = list_notes(notes_dir).unwrap();
        assert_eq!(notes.len(), 2);
    }
}
