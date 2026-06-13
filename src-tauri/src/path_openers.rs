//! "Open / Open with…" support backed by the `path-opener` crate.
//!
//! Detection (`detect_installed_apps`) spawns a `which`/app-bundle check per
//! known app, so we run it once and cache the result. Per-path filtering
//! (directory vs. file extension) and the "default app" choice live on the
//! frontend, which holds the cached opener list with its metadata.

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use path_opener::{detect_installed_apps, FileSupport, PathOpener};
use serde::Serialize;
use std::path::Path;

/// Cached registry walk. Populated lazily on first request, cleared by
/// [`refresh_path_openers`].
static OPENERS: Lazy<Mutex<Option<Vec<PathOpener>>>> = Lazy::new(|| Mutex::new(None));

/// What the frontend needs to build "Open with…" menus and pick a default.
///
/// `file_support` is re-serialized straight from the crate enum, so the TS
/// side sees `{ kind: "any" | "not_supported" | "extensions", extensions?: [] }`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenerInfo {
    pub app_id: String,
    pub name: String,
    pub accepts_directories: bool,
    pub file_support: FileSupport,
}

fn available_infos() -> Vec<OpenerInfo> {
    let mut guard = OPENERS.lock();
    if guard.is_none() {
        *guard = Some(detect_installed_apps());
    }
    guard
        .as_ref()
        .map(|openers| {
            openers
                .iter()
                .filter(|o| o.is_available)
                .map(|o| OpenerInfo {
                    app_id: o.app_id.clone(),
                    name: o.name.clone(),
                    accepts_directories: o.accepts_directories,
                    file_support: o.file_support.clone(),
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Available apps on this machine that can open file/directory paths.
#[tauri::command]
pub fn detect_path_openers() -> Vec<OpenerInfo> {
    available_infos()
}

/// Re-scan the system (e.g. after the user installs/removes an app) and return
/// the refreshed list.
#[tauri::command]
pub fn refresh_path_openers() -> Vec<OpenerInfo> {
    *OPENERS.lock() = None;
    available_infos()
}

/// Open `path` with a specific detected app (`app_id` from [`detect_path_openers`]).
///
/// Honors per-app launch quirks — notably Obsidian's `obsidian://` URI scheme
/// and vault lookup, which the crate handles internally.
#[tauri::command]
pub fn open_path_with(path: String, app_id: String) -> Result<(), String> {
    path_opener::open(Path::new(&path), &app_id)
        .map_err(|e| format!("Failed to open {path} with {app_id}: {e}"))
}

/// Open `path` with the OS default handler (the "double-click" behavior).
#[tauri::command]
pub fn open_path_default(path: String) -> Result<(), String> {
    path_opener::open_default(&path)
        .map_err(|e| format!("Failed to open {path}: {e}"))
}
