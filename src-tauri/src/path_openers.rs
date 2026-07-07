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

/// argv to open `path` at `line` for editors with a goto syntax. None = the app
/// has no known line syntax (caller opens without a line). The CLI shim is
/// resolved via `resolve_program` (PATH + Homebrew + app bundles); an
/// unresolvable shim also returns None so the caller falls back to a plain open.
fn goto_argv(app_id: &str, path: &str, line: usize) -> Option<Vec<String>> {
    let (shim, args): (&str, Vec<String>) = match app_id {
        "sublime-text" => ("subl", vec![format!("{path}:{line}")]),
        "zed" => ("zed", vec![format!("{path}:{line}")]),
        "vscode" => ("code", vec!["--goto".to_string(), format!("{path}:{line}")]),
        "cursor" => ("cursor", vec!["--goto".to_string(), format!("{path}:{line}")]),
        _ => return None,
    };
    let program = crate::commands::resolve_program(shim);
    if !program.contains('/') {
        return None; // shim not found anywhere — plain open is the better failure mode
    }
    Some(std::iter::once(program).chain(args).collect())
}

/// Open `path` with a specific detected app (`app_id` from [`detect_path_openers`]).
///
/// With a `line`, editors with a goto syntax open the file at that line (via
/// their CLI shim). Otherwise — and as fallback — the crate handles the launch,
/// honoring per-app quirks like Obsidian's `obsidian://` URI scheme. On macOS
/// the registry may detect an app by its .app bundle yet launch it via a CLI
/// shim (`subl`, `code`, …) that was never symlinked onto PATH; when that spawn
/// fails we fall back to `open -a <App Name> <path>`, which launches the bundle
/// directly (without line).
#[tauri::command]
pub fn open_path_with(path: String, app_id: String, line: Option<usize>) -> Result<(), String> {
    if let Some(line) = line {
        if let Some(argv) = goto_argv(&app_id, &path, line) {
            let spawned = std::process::Command::new(&argv[0]).args(&argv[1..]).spawn();
            if spawned.is_ok() {
                return Ok(());
            }
        }
    }

    let primary = match path_opener::open(Path::new(&path), &app_id) {
        Ok(()) => return Ok(()),
        Err(e) => e,
    };

    #[cfg(target_os = "macos")]
    if let Some(name) = available_infos().into_iter().find(|o| o.app_id == app_id).map(|o| o.name) {
        let opened = std::process::Command::new("open")
            .args(["-a", &name, &path])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if opened {
            return Ok(());
        }
    }

    Err(format!("Failed to open {path} with {app_id}: {primary}"))
}

/// Open `path` with the OS default handler (the "double-click" behavior).
#[tauri::command]
pub fn open_path_default(path: String) -> Result<(), String> {
    path_opener::open_default(&path)
        .map_err(|e| format!("Failed to open {path}: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn goto_argv_builds_line_syntax_per_editor_and_skips_unknown_apps() {
        // Sublime is installed on dev machines running this suite? Not necessarily —
        // so only assert the shape when the shim resolves; the None-cases are stable.
        if let Some(argv) = goto_argv("sublime-text", "/v/Note.md", 12) {
            assert!(argv[0].contains('/'), "shim must be resolved to an absolute path");
            assert_eq!(argv[1], "/v/Note.md:12");
        }
        if let Some(argv) = goto_argv("vscode", "/v/Note.md", 3) {
            assert_eq!(&argv[1..], ["--goto", "/v/Note.md:3"]);
        }

        // Apps without a goto syntax never yield argv.
        assert!(goto_argv("finder", "/v/Note.md", 1).is_none());
        assert!(goto_argv("obsidian", "/v/Note.md", 1).is_none());
    }
}
