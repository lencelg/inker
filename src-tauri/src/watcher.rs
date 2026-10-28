use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager};

pub const NOTES_CHANGED_EVENT: &str = "notes-changed";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesChangedEvent {
    pub kind: String,
    pub paths: Vec<String>,
}

#[derive(Default)]
pub struct NotesWatcher {
    inner: Mutex<Option<WatchedDir>>,
    last_error: Mutex<Option<String>>,
}

struct WatchedDir {
    path: PathBuf,
    _watcher: RecommendedWatcher,
}

pub fn watch_notes(app: &AppHandle, path: &Path) -> Result<(), String> {
    app.state::<NotesWatcher>().watch(app.clone(), path)
}

pub fn last_error(app: &AppHandle) -> Option<String> {
    app.state::<NotesWatcher>()
        .last_error
        .lock()
        .ok()
        .and_then(|error| error.clone())
}

fn build_watcher<F>(mut handler: F) -> Result<RecommendedWatcher, String>
where
    F: FnMut(notify::Event) + Send + 'static,
{
    notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else {
            return;
        };
        if matches!(event.kind, EventKind::Access(_)) {
            return;
        }
        handler(event);
    })
    .map_err(|error| format!("监听文件变化失败：{error}"))
}

fn event_kind_label(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "create",
        EventKind::Modify(_) => "modify",
        EventKind::Remove(_) => "remove",
        EventKind::Access(_) => "access",
        _ => "other",
    }
}

fn relative_event_path(root: &Path, path: &Path) -> Option<String> {
    let relative = path.strip_prefix(root).ok()?;
    if relative.as_os_str().is_empty() {
        return None;
    }

    let mut parts = Vec::new();
    for component in relative.components() {
        let part = component.as_os_str().to_string_lossy();
        if part.is_empty() || part.starts_with('.') || part.contains(".inker-tmp-") {
            return None;
        }
        parts.push(part.to_string());
    }

    (!parts.is_empty()).then(|| parts.join("/"))
}

fn notes_changed_payload(root: &Path, event: &notify::Event) -> Option<NotesChangedEvent> {
    let kind = event_kind_label(&event.kind);
    if kind == "access" {
        return None;
    }

    let mut paths = event
        .paths
        .iter()
        .filter_map(|path| relative_event_path(root, path))
        .collect::<Vec<_>>();
    paths.sort();
    paths.dedup();
    if paths.is_empty() {
        return None;
    }

    Some(NotesChangedEvent {
        kind: kind.to_string(),
        paths,
    })
}

impl NotesWatcher {
    fn set_last_error(&self, error: Option<String>) {
        if let Ok(mut last_error) = self.last_error.lock() {
            *last_error = error;
        }
    }

    fn watch(&self, app: AppHandle, path: &Path) -> Result<(), String> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| "无法锁定文件监听器".to_string())?;

        if guard.as_ref().is_some_and(|watched| watched.path == path) {
            self.set_last_error(None);
            return Ok(());
        }

        let root = path.to_path_buf();
        let mut watcher = match build_watcher(move |event| {
            if let Some(payload) = notes_changed_payload(&root, &event) {
                let _ = app.emit(NOTES_CHANGED_EVENT, payload);
            }
        }) {
            Ok(watcher) => watcher,
            Err(error) => {
                *guard = None;
                self.set_last_error(Some(error.clone()));
                return Err(error);
            }
        };

        if let Err(error) = watcher.watch(path, RecursiveMode::Recursive) {
            let message = format!("监听文件变化失败：{error}");
            *guard = None;
            self.set_last_error(Some(message.clone()));
            return Err(message);
        }

        *guard = Some(WatchedDir {
            path: path.to_path_buf(),
            _watcher: watcher,
        });
        self.set_last_error(None);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, sync::mpsc, time::Duration};

    #[test]
    fn payload_uses_relative_paths_and_ignores_temp_files() {
        let root = Path::new("/notes");
        let event = notify::Event {
            kind: EventKind::Modify(notify::event::ModifyKind::Any),
            paths: vec![
                root.join("a.md"),
                root.join("sub/b.md"),
                root.join(".a.md.inker-tmp-1-2"),
                root.join(".hidden/c.md"),
                root.join("assets/pic.png"),
            ],
            attrs: Default::default(),
        };

        let payload = notes_changed_payload(root, &event).unwrap();

        assert_eq!(payload.kind, "modify");
        assert_eq!(payload.paths, vec!["a.md", "assets/pic.png", "sub/b.md"]);
    }

    #[test]
    fn reports_non_access_file_changes() {
        let directory = tempfile::tempdir().unwrap();
        let (sender, receiver) = mpsc::channel();
        let mut watcher = build_watcher(move |_| {
            let _ = sender.send(());
        })
        .unwrap();

        watcher
            .watch(directory.path(), RecursiveMode::Recursive)
            .unwrap();
        fs::write(directory.path().join("note.md"), "content").unwrap();

        receiver
            .recv_timeout(Duration::from_secs(5))
            .expect("filesystem event");
    }
}
