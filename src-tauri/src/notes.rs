use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};

const MAX_DEPTH: usize = 32;
const MAX_NAME_CHARS: usize = 120;
const MAX_RELATIVE_CHARS: usize = 1024;
const MAX_ASSET_BYTES: u64 = 20 * 1024 * 1024;
const MAX_SEARCH_RESULTS: usize = 500;
const MAX_SEARCH_QUERY_CHARS: usize = 200;
const MAX_SEARCH_FILE_BYTES: u64 = 5 * 1024 * 1024;
const SEARCH_PREVIEW_BEFORE: usize = 60;
const SEARCH_PREVIEW_AFTER: usize = 140;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesState {
    pub notes_dir: Option<String>,
    pub entries: Vec<FileEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteDetail {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct NoteAsset {
    pub mime: String,
    pub data: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub path: String,
    pub name: String,
    pub line: usize,
    pub column: usize,
    pub text: String,
    pub match_start: usize,
    pub match_length: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResults {
    pub matches: Vec<SearchMatch>,
    pub truncated: bool,
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

pub fn list_entries(notes_dir: &Path) -> Result<Vec<FileEntry>, String> {
    let root = canonical_dir(notes_dir)?;
    let mut entries = Vec::new();
    let mut pending = vec![(root, String::new(), 0usize)];

    while let Some((directory, relative, depth)) = pending.pop() {
        if depth > MAX_DEPTH {
            continue;
        }

        let read_dir = match fs::read_dir(&directory) {
            Ok(value) => value,
            Err(error) if depth == 0 => return Err(format!("读取笔记文件夹失败：{error}")),
            Err(_) => continue,
        };

        for entry in read_dir {
            let entry = match entry {
                Ok(value) => value,
                Err(_) if depth > 0 => continue,
                Err(error) => return Err(format!("读取文件夹项失败：{error}")),
            };
            let file_type = match entry.file_type() {
                Ok(value) => value,
                Err(_) => continue,
            };
            if file_type.is_symlink() {
                continue;
            }

            let name = match entry.file_name().into_string() {
                Ok(value) => value,
                Err(_) => continue,
            };
            if name.starts_with('.') || validate_component(&name).is_err() {
                continue;
            }

            let path = join_relative(&relative, &name);
            if file_type.is_dir() {
                entries.push(FileEntry {
                    path: path.clone(),
                    name,
                    is_dir: true,
                });
                pending.push((entry.path(), path, depth + 1));
            } else if file_type.is_file() && is_markdown_name(&name) {
                entries.push(FileEntry {
                    path,
                    name,
                    is_dir: false,
                });
            }
        }
    }

    entries.sort_by(|a, b| {
        a.path
            .to_lowercase()
            .cmp(&b.path.to_lowercase())
            .then_with(|| a.path.cmp(&b.path))
    });
    Ok(entries)
}

pub fn read_note(notes_dir: &Path, relative: &str) -> Result<NoteDetail, String> {
    let path = resolve_existing_file(notes_dir, relative)?;
    let content = fs::read_to_string(&path).map_err(|error| format!("读取笔记失败：{error}"))?;
    Ok(NoteDetail {
        path: relative.to_string(),
        content,
    })
}

pub fn save_note(notes_dir: &Path, relative: &str, content: &str) -> Result<(), String> {
    let path = resolve_existing_file(notes_dir, relative)?;
    fs::write(&path, content).map_err(|error| format!("保存笔记失败：{error}"))
}

pub fn read_note_asset(
    notes_dir: &Path,
    note_relative: &str,
    source: &str,
) -> Result<NoteAsset, String> {    let root = canonical_dir(notes_dir)?;
    let note_path = resolve_existing_file(notes_dir, note_relative)?;
    let relative = decode_asset_source(source)?;
    let base = note_path
        .parent()
        .ok_or_else(|| "无法确定笔记所在文件夹".to_string())?;
    let target = base.join(&relative);
    let metadata =
        fs::symlink_metadata(&target).map_err(|error| format!("读取图片失败：{error}"))?;
    if metadata.file_type().is_symlink() {
        return Err("不允许访问符号链接".to_string());
    }
    if !metadata.is_file() {
        return Err("图片路径不是文件".to_string());
    }
    if metadata.len() > MAX_ASSET_BYTES {
        return Err("图片文件过大（最大 20 MB）".to_string());
    }

    let canonical =
        fs::canonicalize(&target).map_err(|error| format!("读取图片失败：{error}"))?;
    if !canonical.starts_with(&root) {
        return Err("图片路径超出笔记文件夹".to_string());
    }
    let mime = image_mime(&canonical).ok_or_else(|| "不支持的图片格式".to_string())?;
    let bytes = fs::read(&canonical).map_err(|error| format!("读取图片失败：{error}"))?;
    Ok(NoteAsset {
        mime: mime.to_string(),
        data: BASE64.encode(bytes),
    })
}

pub fn search_notes(notes_dir: &Path, query: &str) -> Result<SearchResults, String> {
    let needle = query.trim();
    if needle.is_empty() {
        return Ok(SearchResults {
            matches: Vec::new(),
            truncated: false,
        });
    }
    if needle.chars().count() > MAX_SEARCH_QUERY_CHARS {
        return Err("搜索关键词过长".to_string());
    }

    let root = canonical_dir(notes_dir)?;
    let needle_lower = needle.to_lowercase();
    let needle_len = needle.chars().count();
    let entries = list_entries(notes_dir)?;
    let mut matches = Vec::new();
    let mut truncated = false;

    'files: for entry in entries.iter().filter(|entry| !entry.is_dir) {
        let path = root.join(&entry.path);
        let metadata = match fs::metadata(&path) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if metadata.len() > MAX_SEARCH_FILE_BYTES {
            continue;
        }
        let content = match fs::read_to_string(&path) {
            Ok(value) => value,
            Err(_) => continue,
        };

        for (line_index, line) in content.lines().enumerate() {
            let lower = line.to_lowercase();
            let byte_index = match lower.find(&needle_lower) {
                Some(value) => value,
                None => continue,
            };
            let char_index = lower[..byte_index].chars().count();
            let line_chars: Vec<char> = line.chars().collect();
            if char_index >= line_chars.len() {
                continue;
            }

            let start = char_index.saturating_sub(SEARCH_PREVIEW_BEFORE);
            let end = (char_index + needle_len + SEARCH_PREVIEW_AFTER).min(line_chars.len());
            let mut text: String = line_chars[start..end].iter().collect();
            let leading_ellipsis = start > 0;
            if leading_ellipsis {
                text.insert(0, '…');
            }
            if end < line_chars.len() {
                text.push('…');
            }

            matches.push(SearchMatch {
                path: entry.path.clone(),
                name: entry.name.clone(),
                line: line_index + 1,
                column: char_index + 1,
                text,
                match_start: char_index - start + usize::from(leading_ellipsis),
                match_length: needle_len,
            });
            if matches.len() >= MAX_SEARCH_RESULTS {
                truncated = true;
                break 'files;
            }
        }
    }

    Ok(SearchResults { matches, truncated })
}

pub fn create_file(notes_dir: &Path, parent: &str, name: &str) -> Result<String, String> {
    let root = canonical_dir(notes_dir)?;
    let parent_components = validate_relative(parent, true)?;
    let parent_path = resolve_existing_dir(&root, &parent_components)?;
    let file_name = normalize_file_name(name)?;
    ensure_no_conflict(&parent_path, &file_name, None)?;

    let parent_relative = parent_components.join("/");
    let relative = join_relative(&parent_relative, &file_name);
    let target = parent_path.join(&file_name);
    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                format!("“{file_name}”已存在")
            } else {
                format!("创建文件失败：{error}")
            }
        })?;
    Ok(relative)
}

pub fn create_folder(notes_dir: &Path, parent: &str, name: &str) -> Result<String, String> {
    let root = canonical_dir(notes_dir)?;
    let parent_components = validate_relative(parent, true)?;
    let parent_path = resolve_existing_dir(&root, &parent_components)?;
    let folder_name = normalize_folder_name(name)?;
    ensure_no_conflict(&parent_path, &folder_name, None)?;

    let parent_relative = parent_components.join("/");
    let relative = join_relative(&parent_relative, &folder_name);
    fs::create_dir(parent_path.join(&folder_name))
        .map_err(|error| format!("创建文件夹失败：{error}"))?;
    Ok(relative)
}

pub fn rename_entry(notes_dir: &Path, relative: &str, name: &str) -> Result<String, String> {
    let root = canonical_dir(notes_dir)?;
    let components = validate_relative(relative, false)?;
    let old_name = components
        .last()
        .cloned()
        .ok_or_else(|| "路径不能为空".to_string())?;
    let parent_components = &components[..components.len() - 1];
    let parent_path = resolve_existing_dir(&root, parent_components)?;
    let (old_path, is_dir) = resolve_existing_entry(&root, relative)?;

    let new_name = if is_dir {
        normalize_folder_name(name)?
    } else {
        normalize_file_name(name)?
    };
    if new_name == old_name {
        return Ok(relative.to_string());
    }
    ensure_no_conflict(&parent_path, &new_name, Some(&old_name))?;

    let target = parent_path.join(&new_name);
    if old_name.to_lowercase() == new_name.to_lowercase() {
        let temporary = parent_path.join(format!(
            ".{new_name}.rename-{}",
            std::process::id()
        ));
        fs::rename(&old_path, &temporary)
            .map_err(|error| format!("重命名失败：{error}"))?;
        if let Err(error) = fs::rename(&temporary, &target) {
            let _ = fs::rename(&temporary, &old_path);
            return Err(format!("重命名失败：{error}"));
        }
    } else {
        fs::rename(&old_path, &target).map_err(|error| format!("重命名失败：{error}"))?;
    }

    let parent_relative = parent_components.join("/");
    Ok(join_relative(&parent_relative, &new_name))
}

pub fn entry_path(notes_dir: &Path, relative: &str) -> Result<PathBuf, String> {
    let root = canonical_dir(notes_dir)?;
    resolve_existing_entry(&root, relative).map(|(path, _)| path)
}

fn canonical_dir(path: &Path) -> Result<PathBuf, String> {
    let canonical =
        fs::canonicalize(path).map_err(|error| format!("读取笔记文件夹失败：{error}"))?;
    if !canonical.is_dir() {
        return Err("笔记路径不是文件夹".to_string());
    }
    Ok(canonical)
}

fn resolve_existing_file(notes_dir: &Path, relative: &str) -> Result<PathBuf, String> {
    let root = canonical_dir(notes_dir)?;
    let (path, is_dir) = resolve_existing_entry(&root, relative)?;
    if is_dir {
        return Err("笔记路径不是文件".to_string());
    }
    Ok(path)
}

fn resolve_existing_entry(root: &Path, relative: &str) -> Result<(PathBuf, bool), String> {
    let components = validate_relative(relative, false)?;
    let name = components
        .last()
        .ok_or_else(|| "路径不能为空".to_string())?;
    let parent = resolve_existing_dir(root, &components[..components.len() - 1])?;
    let target = parent.join(name);
    let metadata = fs::symlink_metadata(&target)
        .map_err(|error| format!("读取条目信息失败：{error}"))?;
    let file_type = metadata.file_type();

    if file_type.is_symlink() {
        return Err("不允许访问符号链接".to_string());
    }
    if !file_type.is_dir()
        && !(file_type.is_file() && is_markdown_name(name))
    {
        return Err("条目不是文件夹或 Markdown 文件".to_string());
    }

    let canonical = fs::canonicalize(&target)
        .map_err(|error| format!("读取条目信息失败：{error}"))?;
    if !canonical.starts_with(root) {
        return Err("路径超出笔记文件夹".to_string());
    }
    Ok((canonical, file_type.is_dir()))
}

fn resolve_existing_dir(root: &Path, components: &[String]) -> Result<PathBuf, String> {
    let mut current = root.to_path_buf();
    for component in components {
        current.push(component);
        let metadata = fs::symlink_metadata(&current)
            .map_err(|error| format!("读取文件夹失败：{error}"))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err("路径不是有效文件夹".to_string());
        }
    }

    let canonical = fs::canonicalize(&current)
        .map_err(|error| format!("读取文件夹失败：{error}"))?;
    if !canonical.starts_with(root) {
        return Err("路径超出笔记文件夹".to_string());
    }
    Ok(canonical)
}

fn validate_relative(value: &str, allow_empty: bool) -> Result<Vec<String>, String> {
    if value.is_empty() {
        return if allow_empty {
            Ok(Vec::new())
        } else {
            Err("路径不能为空".to_string())
        };
    }
    if value.chars().count() > MAX_RELATIVE_CHARS {
        return Err("路径过长".to_string());
    }
    if value.starts_with('/')
        || value.ends_with('/')
        || value.contains('\\')
        || value.contains(':')
    {
        return Err("路径无效".to_string());
    }

    let mut components = Vec::new();
    for part in value.split('/') {
        if part.is_empty() {
            return Err("路径无效".to_string());
        }
        validate_component(part)?;
        components.push(part.to_string());
    }
    Ok(components)
}

fn validate_component(value: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err("名称不能为空".to_string());
    }
    if value.chars().count() > MAX_NAME_CHARS {
        return Err("名称过长".to_string());
    }
    if value.trim() != value {
        return Err("名称不能以空格开头或结尾".to_string());
    }
    if value == "." || value == ".." || value.starts_with('.') {
        return Err("名称不能以点开头".to_string());
    }
    if value.ends_with('.') {
        return Err("名称不能以点结尾".to_string());
    }
    if value
        .chars()
        .any(|character| character.is_control() || matches!(character, '/' | '\\' | ':'))
    {
        return Err("名称包含无效字符".to_string());
    }
    if is_windows_reserved(value) {
        return Err("名称是系统保留名称".to_string());
    }
    Ok(())
}

fn normalize_file_name(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    validate_component(trimmed)?;

    let extension = Path::new(trimmed)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase());
    let file_name = match extension.as_deref() {
        None => format!("{trimmed}.md"),
        Some("md") | Some("markdown") => trimmed.to_string(),
        Some(_) => return Err("文件必须使用 .md 或 .markdown 扩展名".to_string()),
    };
    validate_component(&file_name)?;
    Ok(file_name)
}

fn normalize_folder_name(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    validate_component(trimmed)?;
    Ok(trimmed.to_string())
}

fn ensure_no_conflict(
    directory: &Path,
    name: &str,
    ignore: Option<&str>,
) -> Result<(), String> {
    let wanted = name.to_lowercase();
    let ignored = ignore.map(str::to_lowercase);

    for entry in fs::read_dir(directory)
        .map_err(|error| format!("读取文件夹失败：{error}"))?
    {
        let entry = entry.map_err(|error| format!("读取文件夹项失败：{error}"))?;
        let existing = entry.file_name().to_string_lossy().to_lowercase();
        if ignored.as_deref() == Some(existing.as_str()) {
            continue;
        }
        if existing == wanted {
            return Err(format!("“{name}”已存在"));
        }
    }
    Ok(())
}

fn is_markdown_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown")
}

fn decode_asset_source(source: &str) -> Result<String, String> {
    let source = source.trim();
    if source.is_empty() {
        return Err("图片路径不能为空".to_string());
    }

    let end = source.find(['?', '#']).unwrap_or(source.len());
    let decoded = percent_decode(&source[..end])?;
    if decoded.is_empty() || decoded.chars().count() > MAX_RELATIVE_CHARS {
        return Err("图片路径无效".to_string());
    }
    if decoded.starts_with('/') || decoded.contains('\\') {
        return Err("图片路径必须是笔记内的相对路径".to_string());
    }
    if decoded
        .chars()
        .any(|character| character.is_control() || character == ':')
    {
        return Err("图片路径包含无效字符".to_string());
    }
    Ok(decoded)
}

fn percent_decode(value: &str) -> Result<String, String> {
    if !value.contains('%') {
        return Ok(value.to_string());
    }

    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len() {
                return Err("图片路径编码无效".to_string());
            }
            let hex = std::str::from_utf8(&bytes[index + 1..index + 3])
                .map_err(|_| "图片路径编码无效".to_string())?;
            let byte =
                u8::from_str_radix(hex, 16).map_err(|_| "图片路径编码无效".to_string())?;
            decoded.push(byte);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }

    String::from_utf8(decoded).map_err(|_| "图片路径编码无效".to_string())
}

fn image_mime(path: &Path) -> Option<&'static str> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    match extension.as_str() {
        "png" | "apng" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "svg" => Some("image/svg+xml"),
        "bmp" => Some("image/bmp"),
        "ico" => Some("image/x-icon"),
        "avif" => Some("image/avif"),
        _ => None,
    }
}

fn join_relative(parent: &str, name: &str) -> String {
    if parent.is_empty() {
        name.to_string()
    } else {
        format!("{parent}/{name}")
    }
}

fn is_windows_reserved(value: &str) -> bool {
    let stem = value
        .split('.')
        .next()
        .unwrap_or(value)
        .to_ascii_lowercase();
    matches!(
        stem.as_str(),
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn setup() -> (tempfile::TempDir, PathBuf) {
        let temp = tempdir().unwrap();
        let root = temp.path().join("Notes");
        fs::create_dir(&root).unwrap();
        (temp, root)
    }

    #[test]
    fn lists_nested_entries_and_skips_ignored_files() {
        let (_temp, root) = setup();
        fs::create_dir(root.join("Journal")).unwrap();
        fs::create_dir(root.join("Journal/2026")).unwrap();
        fs::write(root.join("Root.md"), "# Root").unwrap();
        fs::write(root.join("Journal/Entry.md"), "").unwrap();
        fs::write(root.join("Journal/2026/Plan.markdown"), "").unwrap();
        fs::write(root.join("ignore.txt"), "").unwrap();
        fs::write(root.join(".hidden.md"), "").unwrap();

        let entries = list_entries(&root).unwrap();
        let paths: Vec<&str> = entries.iter().map(|entry| entry.path.as_str()).collect();
        assert!(paths.contains(&"Root.md"));
        assert!(paths.contains(&"Journal"));
        assert!(paths.contains(&"Journal/Entry.md"));
        assert!(paths.contains(&"Journal/2026"));
        assert!(paths.contains(&"Journal/2026/Plan.markdown"));
        assert!(!paths.contains(&"ignore.txt"));
        assert!(!paths.contains(&".hidden.md"));
    }

    #[test]
    fn creates_saves_and_reads_notes() {
        let (_temp, root) = setup();
        let folder = create_folder(&root, "", "Journal").unwrap();
        assert_eq!(folder, "Journal");

        let path = create_file(&root, "Journal", "Day 1").unwrap();
        assert_eq!(path, "Journal/Day 1.md");
        assert!(root.join("Journal/Day 1.md").exists());

        let empty = read_note(&root, &path).unwrap();
        assert_eq!(empty.path, path);
        assert_eq!(empty.content, "");

        save_note(&root, &path, "# Day 1\n\nBody").unwrap();
        assert_eq!(
            read_note(&root, &path).unwrap().content,
            "# Day 1\n\nBody"
        );

        save_note(&root, &path, "").unwrap();
        assert_eq!(read_note(&root, &path).unwrap().content, "");
    }

    #[test]
    fn reads_images_relative_to_the_note() {
        let (_temp, root) = setup();
        fs::create_dir(root.join("Assets")).unwrap();
        fs::create_dir(root.join("Journal")).unwrap();
        fs::write(root.join("Assets/cover one.svg"), "<svg></svg>").unwrap();
        fs::write(root.join("Assets/pixel.png"), [0x89, b'P', b'N', b'G']).unwrap();
        fs::write(root.join("Journal/Note.md"), "").unwrap();

        let svg =
            read_note_asset(&root, "Journal/Note.md", "../Assets/cover%20one.svg").unwrap();
        assert_eq!(svg.mime, "image/svg+xml");
        assert_eq!(BASE64.decode(svg.data).unwrap(), b"<svg></svg>");

        let png = read_note_asset(&root, "Journal/Note.md", "../Assets/pixel.png").unwrap();
        assert_eq!(png.mime, "image/png");
    }

    #[test]
    fn rejects_unsafe_or_unsupported_assets() {
        let (temp, root) = setup();
        fs::create_dir(root.join("Assets")).unwrap();
        fs::write(root.join("Note.md"), "").unwrap();
        fs::write(root.join("Assets/note.txt"), "text").unwrap();
        fs::write(temp.path().join("secret.png"), b"secret").unwrap();

        assert!(read_note_asset(&root, "Note.md", "../secret.png").is_err());
        assert!(read_note_asset(&root, "Note.md", "/etc/passwd").is_err());
        assert!(read_note_asset(&root, "Note.md", "https://example.com/a.png").is_err());
        assert!(read_note_asset(&root, "Note.md", "Assets/note.txt").is_err());
        assert!(read_note_asset(&root, "Note.md", "Assets/missing.png").is_err());
        assert!(read_note_asset(&root, "Missing.md", "Assets/note.txt").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_assets() {
        use std::os::unix::fs::symlink;

        let (temp, root) = setup();
        fs::write(root.join("Note.md"), "").unwrap();
        let outside = temp.path().join("outside.png");
        fs::write(&outside, b"secret").unwrap();
        symlink(&outside, root.join("linked.png")).unwrap();

        assert!(read_note_asset(&root, "Note.md", "linked.png").is_err());
    }

    #[test]
    fn searches_notes_case_insensitively() {
        let (_temp, root) = setup();
        fs::create_dir(root.join("Journal")).unwrap();
        fs::write(
            root.join("Journal/Note.md"),
            "Alpha\nNeedle here\nanother NEEDLE",
        )
        .unwrap();
        fs::write(root.join("Other.md"), "no match").unwrap();
        fs::write(root.join("ignore.txt"), "needle").unwrap();

        let results = search_notes(&root, "needle").unwrap();
        assert!(!results.truncated);
        assert_eq!(results.matches.len(), 2);

        let first = &results.matches[0];
        assert_eq!(first.path, "Journal/Note.md");
        assert_eq!(first.name, "Note.md");
        assert_eq!(first.line, 2);
        assert_eq!(first.column, 1);
        assert_eq!(first.text, "Needle here");
        assert_eq!(first.match_start, 0);
        assert_eq!(first.match_length, 6);

        let second = &results.matches[1];
        assert_eq!(second.line, 3);
        assert_eq!(second.column, 9);
        assert_eq!(second.match_start, 8);

        assert!(search_notes(&root, "  ").unwrap().matches.is_empty());
        assert!(search_notes(&root, &"x".repeat(201)).is_err());
    }

    #[test]
    fn search_preview_keeps_long_line_matches_visible() {
        let (_temp, root) = setup();
        let mut line = "a".repeat(100);
        line.push_str("Needle");
        line.push_str(&"b".repeat(200));
        fs::write(root.join("Long.md"), line).unwrap();

        let results = search_notes(&root, "needle").unwrap();
        let hit = &results.matches[0];
        let preview: Vec<char> = hit.text.chars().collect();
        let matched: String = preview
            .iter()
            .skip(hit.match_start)
            .take(hit.match_length)
            .collect();
        assert_eq!(matched, "Needle");
        assert!(hit.text.starts_with('…'));
        assert!(hit.text.ends_with('…'));
    }

    #[test]
    fn rejects_collisions_and_invalid_names() {
        let (_temp, root) = setup();
        create_file(&root, "", "Note").unwrap();

        assert!(create_file(&root, "", "note.md").is_err());
        assert!(create_file(&root, "", "note.txt").is_err());
        assert!(create_file(&root, "", ".hidden").is_err());
        assert!(create_file(&root, "", "con").is_err());
        create_folder(&root, "", "Journal").unwrap();
        assert!(create_folder(&root, "", "journal").is_err());
        assert!(save_note(&root, "Missing.md", "body").is_err());
    }

    #[test]
    fn renames_files_and_folders() {
        let (_temp, root) = setup();
        let file = create_file(&root, "", "Draft").unwrap();
        let renamed = rename_entry(&root, &file, "Final").unwrap();
        assert_eq!(renamed, "Final.md");
        assert!(!root.join("Draft.md").exists());

        let folder = create_folder(&root, "", "Inbox").unwrap();
        let nested = create_file(&root, &folder, "Entry").unwrap();
        let renamed_folder = rename_entry(&root, &folder, "Archive").unwrap();
        assert_eq!(renamed_folder, "Archive");
        assert!(!root.join("Inbox").exists());
        assert!(root.join("Archive/Entry.md").exists());
        assert!(read_note(&root, &nested).is_err());
    }

    #[test]
    fn rejects_path_traversal_and_root_operations() {
        let (_temp, root) = setup();
        assert!(read_note(&root, "../evil.md").is_err());
        assert!(read_note(&root, "nested/evil.md").is_err());
        assert!(create_file(&root, "..", "evil").is_err());
        assert!(create_folder(&root, "../", "evil").is_err());
        assert!(rename_entry(&root, "../evil.md", "safe").is_err());
        assert!(entry_path(&root, "").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escapes() {
        use std::os::unix::fs::symlink;

        let (temp, root) = setup();
        let outside = temp.path().join("Outside");
        fs::create_dir(&outside).unwrap();
        fs::write(outside.join("secret.md"), "secret").unwrap();
        symlink(&outside, root.join("linked")).unwrap();

        assert!(read_note(&root, "linked/secret.md").is_err());
        let entries = list_entries(&root).unwrap();
        assert!(entries.iter().all(|entry| entry.path != "linked"));
    }
}
