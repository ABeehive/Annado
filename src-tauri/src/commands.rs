use crate::calendar::{self, CalendarEvent, CalendarInfo};
use crate::parser::{self, IntervalUnit, RecurrenceType, RecurringTemplate, Task, WhenValue};
use crate::vault::{
    FolderPaths, Milestone, PersonInfo, PersonMetadata, ProjectInfo, ProjectMetadata, Vault,
};
use chrono::Local;
use parking_lot::RwLock;
use serde::{Deserialize, Deserializer, Serialize};
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter, Manager};

static VAULT: OnceLock<RwLock<Option<Vault>>> = OnceLock::new();

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub vault_path: Option<String>,
    pub folder_paths: FolderPaths,
    #[serde(default)]
    pub excluded_paths: Vec<String>,
    #[serde(default)]
    pub is_obsidian_vault: bool,
    #[serde(default = "default_editor_type")]
    pub editor_type: String,
    #[serde(default)]
    pub editor_custom_command: String,
}

fn default_editor_type() -> String {
    "system".to_string()
}

#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

fn get_config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("config.json"))
}

fn load_config(app: &AppHandle) -> AppConfig {
    // Try to load from new config.json
    if let Some(config_path) = get_config_path(app) {
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                return config;
            }
        }
    }

    // Fall back to legacy vault_path.txt migration
    if let Ok(app_dir) = app.path().app_config_dir() {
        let legacy_path = app_dir.join("vault_path.txt");
        if let Ok(vault_path) = std::fs::read_to_string(&legacy_path) {
            let vault_path_buf = PathBuf::from(vault_path.trim());
            let config = AppConfig {
                is_obsidian_vault: vault_path_buf.join(".obsidian").is_dir(),
                editor_type: default_editor_type(),
                editor_custom_command: String::new(),
                vault_path: Some(vault_path.trim().to_string()),
                folder_paths: FolderPaths::default(),
                excluded_paths: Vec::new(),
            };
            // Save migrated config and remove legacy file
            if let Some(config_path) = get_config_path(app) {
                if let Some(parent) = config_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::write(
                    &config_path,
                    serde_json::to_string_pretty(&config).unwrap_or_default(),
                );
                let _ = std::fs::remove_file(&legacy_path);
            }
            return config;
        }
    }

    AppConfig::default()
}

fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let config_path = get_config_path(app).ok_or("Failed to get config path")?;
    if let Some(parent) = config_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    std::fs::write(&config_path, content).map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}

fn get_vault_lock() -> &'static RwLock<Option<Vault>> {
    VAULT.get_or_init(|| RwLock::new(None))
}

fn with_vault<T>(f: impl FnOnce(&Vault) -> T) -> Result<T, String> {
    let lock = get_vault_lock().read();
    let vault = lock.as_ref().ok_or("Vault not initialized".to_string())?;
    Ok(f(vault))
}

fn with_vault_result<T>(f: impl FnOnce(&Vault) -> Result<T, String>) -> Result<T, String> {
    let lock = get_vault_lock().read();
    let vault = lock.as_ref().ok_or("Vault not initialized".to_string())?;
    f(vault)
}

/// Deserialize a nested Option so that JSON `null` maps to `Some(None)` (= "clear this field")
/// while an absent key maps to `None` (= "don't update"). Standard serde maps both to `None`.
fn deserialize_optional_nullable<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    // If this function is called, the key was present in JSON.
    // Deserialize the inner value: null → None, value → Some(value).
    Ok(Some(Option::deserialize(deserializer)?))
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskUpdatePayload {
    pub id: String,
    pub title: Option<String>,
    pub notes: Option<String>,
    pub when: Option<WhenValue>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub deadline: Option<Option<String>>, // None = not updated, Some(None) = remove, Some(Some(s)) = set
    pub tags: Option<Vec<String>>,
    pub completed: Option<bool>,
    pub projects: Option<Vec<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub priority: Option<Option<u8>>, // None = not updated, Some(None) = remove, Some(Some(n)) = set to n
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub duration_minutes: Option<Option<u32>>, // None = not updated, Some(None) = remove, Some(Some(n)) = set
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub scheduled_time: Option<Option<String>>, // None = not updated, Some(None) = remove, Some(Some(s)) = set
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskPayload {
    pub title: String,
    pub when: Option<WhenValue>,
}

#[tauri::command]
pub fn set_vault_path(path: String, app: AppHandle) -> Result<Vec<Task>, String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Err("Path does not exist".to_string());
    }

    if !path_buf.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    // Reject symlinks (check before canonicalize, which resolves them)
    if path_buf.read_link().is_ok() {
        return Err("Symbolic links are not supported as vault paths".to_string());
    }

    // Canonicalize the path to resolve any ../ components
    let path_buf = path_buf
        .canonicalize()
        .map_err(|e| format!("Failed to resolve path: {}", e))?;
    let path = path_buf.to_string_lossy().to_string();

    // Verify write permission
    let test_file = path_buf.join(".annado_write_test");
    std::fs::write(&test_file, "")
        .map_err(|_| "No write permission to this directory".to_string())?;
    let _ = std::fs::remove_file(&test_file);

    // Load existing config to preserve folder_paths
    let mut config = load_config(&app);
    config.vault_path = Some(path.clone());

    // Auto-detect Obsidian vault (overrides saved value when vault path changes)
    config.is_obsidian_vault = path_buf.join(".obsidian").is_dir();

    let mut vault = Vault::new_with_folder_paths(
        path_buf,
        config.folder_paths.clone(),
        config.is_obsidian_vault,
    );
    vault.set_excluded_paths(config.excluded_paths.clone());
    let tasks = vault.scan();

    // NOTE: We do NOT call generate_recurring_instances() here because:
    // 1. React Strict Mode causes useEffect to run twice, calling set_vault_path twice
    // 2. Instance generation already happens atomically during template creation
    // 3. This prevents race conditions that cause duplicate instances

    // Start watching for changes
    let app_handle = app.clone();
    vault.start_watching(move |updated_tasks| {
        // Emit event to frontend when files change
        if let Err(e) = app_handle.emit("tasks-updated", &updated_tasks) {
            eprintln!("Failed to emit tasks-updated event: {}", e);
        }
    })?;

    // Store the vault
    {
        let mut vault_lock = get_vault_lock().write();
        *vault_lock = Some(vault);
    }

    // Save config
    let _ = save_config(&app, &config);

    Ok(tasks)
}

#[tauri::command]
pub fn get_vault_path(app: AppHandle) -> Option<String> {
    load_config(&app).vault_path
}

#[tauri::command]
pub fn get_tasks() -> Result<Vec<Task>, String> {
    with_vault(|vault| vault.get_tasks())
}

#[tauri::command]
pub fn get_task(id: String) -> Result<Option<Task>, String> {
    with_vault(|vault| vault.get_task(&id))
}

#[tauri::command]
pub fn update_task(payload: TaskUpdatePayload) -> Result<Task, String> {
    let vault_lock = get_vault_lock().read();
    let vault = vault_lock.as_ref().ok_or("Vault not initialized")?;

    let mut task = vault.get_task(&payload.id).ok_or("Task not found")?;

    // Apply updates
    let title_changed = payload.title.is_some();
    if let Some(title) = payload.title {
        task.title = title;
    }

    // Reconcile projects with wiki-links in title when title changed but projects not explicitly set
    if title_changed && payload.projects.is_none() {
        let projects = vault.get_all_projects();
        let project_names: std::collections::HashSet<String> =
            projects.iter().map(|p| p.name.clone()).collect();

        // Get file's implicit project
        let file_project = parser::derive_project_name(&task.file_path);

        // Extract projects from wiki-links in new title
        let mut new_projects = parser::extract_projects_from_wikilinks(&task.title, &project_names);

        // Include file's implicit project if task is in a project file
        if let Some(ref fp) = file_project {
            if !new_projects.contains(fp) {
                new_projects.insert(0, fp.clone());
            }
        }

        task.projects = new_projects;
    }

    if let Some(notes) = payload.notes {
        task.notes = notes;
    }
    if let Some(when) = payload.when {
        // Normalize WhenValue: convert Tomorrow to actual date
        let today = Local::now().date_naive();
        task.when = when.normalize(today);
    }
    if let Some(deadline) = payload.deadline {
        task.deadline = deadline;
    }
    if let Some(tags) = payload.tags {
        task.tags = tags;
    }
    if let Some(completed) = payload.completed {
        task.completed = completed;
    }
    if let Some(projects) = payload.projects.clone() {
        task.projects = projects;
    }
    if let Some(priority) = payload.priority {
        task.priority = priority;
    }
    if let Some(duration_minutes) = payload.duration_minutes {
        // Zero means "remove" (JS sends 0 because null becomes None and is skipped)
        task.duration_minutes = duration_minutes.filter(|&d| d > 0);
    }
    if let Some(scheduled_time) = payload.scheduled_time {
        // Empty string means "remove" (JS sends "" because null becomes None and is skipped)
        task.scheduled_time = scheduled_time.filter(|s| !s.is_empty());
    }

    vault.update_task(task.clone())?;

    Ok(task)
}

#[tauri::command]
pub fn create_task(payload: CreateTaskPayload) -> Result<Task, String> {
    let when = payload.when.unwrap_or(WhenValue::Inbox);
    with_vault_result(|vault| vault.create_task(&payload.title, when))
}

#[tauri::command]
pub fn toggle_task_complete(id: String) -> Result<Task, String> {
    let vault_lock = get_vault_lock().read();
    let vault = vault_lock.as_ref().ok_or("Vault not initialized")?;

    let mut task = vault.get_task(&id).ok_or("Task not found")?;
    task.completed = !task.completed;

    // Set or clear completed_date
    if task.completed {
        let today = Local::now().date_naive();
        task.completed_date = Some(today.format("%Y-%m-%d").to_string());
    } else {
        task.completed_date = None;
    }

    vault.update_task(task.clone())?;

    // If completing a recurring task instance, update the template's last_completed
    if task.completed {
        if let Some(ref template_id) = task.recurring_template_id {
            let today = Local::now().date_naive();
            let date_str = today.format("%Y-%m-%d").to_string();
            let _ = vault.update_template_last_completed(template_id, &date_str);
        }
    }

    Ok(task)
}

#[tauri::command]
pub fn toggle_checklist_item(task_id: String, item_index: usize) -> Result<Task, String> {
    with_vault_result(|vault| vault.toggle_checklist_item(&task_id, item_index))
}

#[tauri::command]
pub fn rename_checklist_item(
    task_id: String,
    item_index: usize,
    new_title: String,
) -> Result<Task, String> {
    with_vault_result(|vault| vault.rename_checklist_item(&task_id, item_index, &new_title))
}

#[tauri::command]
pub fn delete_checklist_item(task_id: String, item_index: usize) -> Result<Task, String> {
    with_vault_result(|vault| vault.delete_checklist_item(&task_id, item_index))
}

#[tauri::command]
pub fn rescan_vault() -> Result<Vec<Task>, String> {
    with_vault(|vault| vault.scan())
}

#[tauri::command]
pub fn get_all_projects() -> Result<Vec<ProjectInfo>, String> {
    with_vault(|vault| vault.get_all_projects())
}

#[tauri::command]
pub fn get_all_persons() -> Result<Vec<PersonInfo>, String> {
    with_vault(|vault| vault.get_all_persons())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagInfo {
    pub name: String,
    pub count: usize,
}

#[tauri::command]
pub fn get_all_tags() -> Result<Vec<TagInfo>, String> {
    with_vault(|vault| {
        let tasks = vault.get_tasks();
        // Tags are case-insensitive for identity (like Obsidian): group case
        // variants under a lowercase key, summing their counts, while tracking how
        // often each exact casing was seen so we can pick a canonical display.
        let mut groups: std::collections::HashMap<
            String,
            (usize, std::collections::HashMap<String, usize>),
        > = std::collections::HashMap::new();
        for task in &tasks {
            if task.completed {
                continue;
            }
            for tag in &task.tags {
                let entry = groups
                    .entry(tag.to_lowercase())
                    .or_insert((0, std::collections::HashMap::new()));
                entry.0 += 1;
                *entry.1.entry(tag.clone()).or_insert(0) += 1;
            }
        }
        let mut tags: Vec<TagInfo> = groups
            .into_iter()
            .map(|(_key, (count, casings))| {
                // Canonical casing = most frequently used variant, tie-broken by the
                // lexicographically smallest string (deterministic).
                let name = casings
                    .into_iter()
                    .max_by(|a, b| a.1.cmp(&b.1).then_with(|| b.0.cmp(&a.0)))
                    .map(|(name, _)| name)
                    .unwrap_or_default();
                TagInfo { name, count }
            })
            .collect();
        tags.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        tags
    })
}

#[tauri::command]
pub fn get_person_metadata(person_name: String) -> Result<PersonMetadata, String> {
    with_vault(|vault| vault.get_person_metadata(&person_name))
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectMetadataPayload {
    pub project_name: String,
    pub description: Option<String>,
    pub deadline: Option<String>,
    pub start_date: Option<String>,
    pub ranking: Option<String>,
    pub persons: Vec<String>,
    pub up: Option<String>,
    pub milestones: Vec<Milestone>,
}

#[tauri::command]
pub fn update_project_metadata(payload: UpdateProjectMetadataPayload) -> Result<(), String> {
    let metadata = ProjectMetadata {
        description: payload.description,
        deadline: payload.deadline,
        start_date: payload.start_date,
        ranking: payload.ranking,
        persons: payload.persons,
        up: payload.up,
        milestones: payload.milestones,
    };
    with_vault_result(|vault| vault.update_project_metadata(&payload.project_name, &metadata))
}

// Recurring template commands

#[tauri::command]
pub fn get_all_recurring_templates() -> Result<Vec<RecurringTemplate>, String> {
    with_vault(|vault| vault.get_all_recurring_templates())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecurringTemplatePayload {
    pub title: String,
    pub notes: Option<String>,
    pub recurrence_type: RecurrenceType,
    pub interval: u32,
    pub interval_unit: IntervalUnit,
    pub start_date: Option<String>,
    pub project: Option<String>,
    pub priority: Option<u8>,
    pub tags: Option<Vec<String>>,
}

#[tauri::command]
pub fn create_recurring_template(
    payload: CreateRecurringTemplatePayload,
) -> Result<RecurringTemplate, String> {
    with_vault_result(|vault| {
        vault.create_recurring_template(
            &payload.title,
            payload.notes.as_deref(),
            payload.recurrence_type,
            payload.interval,
            payload.interval_unit,
            payload.start_date.as_deref(),
            payload.project.as_deref(),
            payload.priority,
            payload.tags.unwrap_or_default(),
        )
    })
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecurringTemplatePayload {
    pub template_id: String,
    pub title: Option<String>,
    pub notes: Option<String>,
    pub recurrence_type: Option<RecurrenceType>,
    pub interval: Option<u32>,
    pub interval_unit: Option<IntervalUnit>,
    pub start_date: Option<String>,
    pub project: Option<String>,
    pub priority: Option<Option<u8>>,
    pub tags: Option<Vec<String>>,
}

#[tauri::command]
pub fn update_recurring_template(
    payload: UpdateRecurringTemplatePayload,
) -> Result<RecurringTemplate, String> {
    with_vault_result(|vault| {
        vault.update_recurring_template(
            &payload.template_id,
            payload.title.as_deref(),
            payload.notes.as_deref(),
            payload.recurrence_type,
            payload.interval,
            payload.interval_unit,
            payload.start_date.as_deref(),
            payload.project.as_deref(),
            payload.priority,
            payload.tags,
        )
    })
}

#[tauri::command]
pub fn delete_recurring_template(template_id: String) -> Result<(), String> {
    with_vault_result(|vault| vault.delete_recurring_template(&template_id))
}

#[tauri::command]
pub fn generate_recurring_instances() -> Result<Vec<Task>, String> {
    with_vault_result(|vault| vault.generate_recurring_instances())
}

#[tauri::command]
pub fn get_folder_paths(app: AppHandle) -> FolderPaths {
    load_config(&app).folder_paths
}

#[tauri::command]
pub fn set_folder_paths(folder_paths: FolderPaths, app: AppHandle) -> Result<Vec<Task>, String> {
    let mut folder_paths = folder_paths;

    // Reject path traversal in folder paths
    if folder_paths.recurring_templates.contains("..") {
        return Err("Folder path must not contain '..'".to_string());
    }
    folder_paths.task_marker_tag = folder_paths
        .task_marker_tag
        .trim()
        .trim_start_matches('#')
        .to_string();
    if !folder_paths.task_marker_tag.is_empty()
        && !folder_paths
            .task_marker_tag
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_')
    {
        return Err(
            "Task marker tag may only contain letters, numbers, or underscores".to_string(),
        );
    }

    // Update config
    let mut config = load_config(&app);
    config.folder_paths = folder_paths.clone();
    save_config(&app, &config)?;

    // Update vault's folder paths and rescan
    let mut vault_lock = get_vault_lock().write();
    if let Some(ref mut vault) = *vault_lock {
        vault.set_folder_paths(folder_paths);
        Ok(vault.scan())
    } else {
        Err("Vault not initialized".to_string())
    }
}

#[tauri::command]
pub fn get_is_obsidian_vault(app: AppHandle) -> bool {
    load_config(&app).is_obsidian_vault
}

#[tauri::command]
pub fn set_is_obsidian_vault(value: bool, app: AppHandle) -> Result<(), String> {
    let mut config = load_config(&app);
    config.is_obsidian_vault = value;
    save_config(&app, &config)?;

    let mut vault_lock = get_vault_lock().write();
    if let Some(ref mut vault) = *vault_lock {
        vault.set_is_obsidian_vault(value);
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorConfig {
    pub editor_type: String,
    pub editor_custom_command: String,
}

#[tauri::command]
pub fn get_editor_config(app: AppHandle) -> EditorConfig {
    let config = load_config(&app);
    EditorConfig {
        editor_type: config.editor_type,
        editor_custom_command: config.editor_custom_command,
    }
}

#[tauri::command]
pub fn set_editor_config(
    editor_type: String,
    editor_custom_command: String,
    app: AppHandle,
) -> Result<(), String> {
    let mut config = load_config(&app);
    config.editor_type = editor_type;
    config.editor_custom_command = editor_custom_command;
    save_config(&app, &config)
}

fn parse_command_template(command: &str) -> Result<Vec<String>, String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;

    for c in command.chars() {
        match c {
            '"' | '\'' if quote == Some(c) => quote = None,
            '"' | '\'' if quote.is_none() => quote = Some(c),
            c if c.is_whitespace() && quote.is_none() => {
                if !current.is_empty() {
                    args.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(c),
        }
    }

    if let Some(open_quote) = quote {
        return Err(format!("Unclosed quote in custom command: {}", open_quote));
    }

    if !current.is_empty() {
        args.push(current);
    }

    Ok(args)
}

fn build_custom_command_args(
    custom_command: &str,
    file_path: &str,
    line_number: usize,
) -> Result<Vec<String>, String> {
    let args = parse_command_template(custom_command.trim())?;
    if args.is_empty() {
        return Err("Empty custom command".to_string());
    }

    Ok(args
        .into_iter()
        .map(|arg| {
            arg.replace("{file}", file_path)
                .replace("{line}", &line_number.to_string())
        })
        .collect())
}

fn open_with_system(file_path: &str) -> Result<(), String> {
    tauri_plugin_opener::open_path(file_path, None::<&str>)
        .map_err(|e| format!("Failed to open file: {}", e))
}

#[cfg(target_os = "macos")]
fn sublime_app_name() -> &'static str {
    "Sublime Text"
}

#[cfg(target_os = "windows")]
fn sublime_app_name() -> &'static str {
    "sublime_text"
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn sublime_app_name() -> &'static str {
    "sublime_text"
}

fn open_with_sublime(file_path: &str) -> Result<(), String> {
    tauri_plugin_opener::open_path(file_path, Some(sublime_app_name()))
        .map_err(|e| format!("Failed to open in Sublime Text: {}", e))
}

#[tauri::command]
pub fn open_file_in_editor(
    file_path: String,
    line_number: usize,
    editor_type: String,
    custom_command: String,
) -> Result<(), String> {
    match editor_type.as_str() {
        "sublime" => {
            open_with_sublime(&file_path)?;
        }
        "custom" if !custom_command.is_empty() => {
            let command_args = build_custom_command_args(&custom_command, &file_path, line_number)?;
            let (program, args) = command_args
                .split_first()
                .ok_or_else(|| "Empty custom command".to_string())?;

            std::process::Command::new(program)
                .args(args)
                .spawn()
                .map_err(|e| format!("Failed to run custom command: {}", e))?;
        }
        _ => {
            open_with_system(&file_path)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod editor_command_tests {
    use super::build_custom_command_args;

    #[test]
    fn custom_command_keeps_windows_path_with_spaces_as_one_arg() {
        let args = build_custom_command_args(
            "code --goto {file}:{line}",
            r"C:\Users\Me\Vault With Spaces\Task File.md",
            42,
        )
        .unwrap();

        assert_eq!(
            args,
            vec![
                "code",
                "--goto",
                r"C:\Users\Me\Vault With Spaces\Task File.md:42"
            ]
        );
    }

    #[test]
    fn custom_command_supports_quoted_program_and_placeholders() {
        let args = build_custom_command_args(
            r#""C:\Program Files\Editor\editor.exe" --line "{line}" "{file}""#,
            r"C:\Users\Me\Vault With Spaces\Task File.md",
            7,
        )
        .unwrap();

        assert_eq!(
            args,
            vec![
                r"C:\Program Files\Editor\editor.exe",
                "--line",
                "7",
                r"C:\Users\Me\Vault With Spaces\Task File.md"
            ]
        );
    }

    #[test]
    fn custom_command_rejects_unclosed_quote() {
        let err = build_custom_command_args(
            r#"code --goto "{file}:{line}"#,
            r"C:\Users\Me\Task File.md",
            1,
        )
        .unwrap_err();

        assert!(err.contains("Unclosed quote"));
    }
}

#[tauri::command]
pub fn delete_task(id: String) -> Result<(), String> {
    with_vault_result(|vault| vault.delete_task(&id))
}

#[tauri::command]
pub fn get_excluded_paths(app: AppHandle) -> Vec<String> {
    load_config(&app).excluded_paths
}

#[tauri::command]
pub fn set_excluded_paths(
    excluded_paths: Vec<String>,
    app: AppHandle,
) -> Result<Vec<Task>, String> {
    // Update config
    let mut config = load_config(&app);
    config.excluded_paths = excluded_paths.clone();
    save_config(&app, &config)?;

    // Update vault's excluded paths and rescan
    let mut vault_lock = get_vault_lock().write();
    if let Some(ref mut vault) = *vault_lock {
        vault.set_excluded_paths(excluded_paths);
        Ok(vault.scan())
    } else {
        Err("Vault not initialized".to_string())
    }
}

#[tauri::command]
pub fn set_annado_exclude_in_file(relative_path: String, exclude: bool) -> Result<(), String> {
    with_vault_result(|vault| vault.set_annado_exclude_frontmatter(&relative_path, exclude))
}

// Project / Person creation and rename commands

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneInput {
    pub name: String,
    pub end: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectPayload {
    pub name: String,
    pub parent_folder: Option<String>,
    pub description: Option<String>,
    pub deadline: Option<String>,
    #[serde(default)]
    pub persons: Vec<String>,
    #[serde(default)]
    pub milestones: Vec<MilestoneInput>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameProjectPayload {
    pub old_name: String,
    pub new_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePersonPayload {
    pub name: String,
    pub organisation: Option<String>,
    pub relationship: Option<String>,
    #[serde(default)]
    pub languages: Vec<String>,
    #[serde(default)]
    pub projects: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenamePersonPayload {
    pub old_name: String,
    pub new_name: String,
}

#[tauri::command]
pub fn create_project(payload: CreateProjectPayload) -> Result<ProjectInfo, String> {
    let milestones: Vec<Milestone> = payload
        .milestones
        .iter()
        .map(|m| Milestone {
            name: m.name.clone(),
            start: None,
            end: m.end.clone(),
            completed: false,
        })
        .collect();
    with_vault_result(|vault| {
        vault.create_project_file(
            &payload.name,
            payload.parent_folder.as_deref(),
            payload.description.as_deref(),
            payload.deadline.as_deref(),
            &payload.persons,
            &milestones,
        )
    })
}

#[tauri::command]
pub fn rename_project(payload: RenameProjectPayload) -> Result<ProjectInfo, String> {
    with_vault_result(|vault| vault.rename_project_file(&payload.old_name, &payload.new_name))
}

#[tauri::command]
pub fn create_person(payload: CreatePersonPayload) -> Result<PersonInfo, String> {
    with_vault_result(|vault| {
        vault.create_person_file(
            &payload.name,
            payload.organisation.as_deref(),
            payload.relationship.as_deref(),
            &payload.languages,
            &payload.projects,
        )
    })
}

#[tauri::command]
pub fn rename_person(payload: RenamePersonPayload) -> Result<PersonInfo, String> {
    with_vault_result(|vault| vault.rename_person_file(&payload.old_name, &payload.new_name))
}

// Calendar commands

#[tauri::command]
pub fn get_calendars() -> Result<Vec<CalendarInfo>, String> {
    calendar::fetch_calendars()
}

#[tauri::command]
pub fn get_calendar_events(
    calendar_names: Vec<String>,
    start_date: String,
    end_date: String,
) -> Result<Vec<CalendarEvent>, String> {
    calendar::fetch_events(calendar_names, start_date, end_date)
}

#[tauri::command]
pub fn check_calendar_access() -> Result<bool, String> {
    calendar::check_calendar_permission()
}

#[tauri::command]
pub fn open_calendar_at_date(date: String) -> Result<(), String> {
    calendar::open_calendar_at_date(date)
}

#[tauri::command]
pub fn delete_calendar_event(event_id: String) -> Result<(), String> {
    calendar::delete_event(event_id)
}

// ── Tray / notifications ──────────────────────────────────────────────────────

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        w.show().map_err(|e| e.to_string())?;
        w.unminimize().ok();
        w.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_task_in_main(id: String, app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        w.show().map_err(|e| e.to_string())?;
        w.unminimize().ok();
        w.set_focus().map_err(|e| e.to_string())?;
    }
    app.emit_to("main", "tray-open-task", id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_notification_prefs(app: AppHandle) -> crate::notification_scheduler::NotificationPrefs {
    crate::notification_scheduler::load_notification_prefs(&app)
}

#[tauri::command]
pub fn save_notification_prefs(
    prefs: crate::notification_scheduler::NotificationPrefs,
    app: AppHandle,
) -> Result<(), String> {
    crate::notification_scheduler::save_notification_prefs(&app, &prefs)
}

#[tauri::command]
pub fn set_tray_enabled(enabled: bool, app: AppHandle) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_visible(enabled)
            .map_err(|e: tauri::Error| e.to_string())?;
    }
    let mut prefs = crate::notification_scheduler::load_notification_prefs(&app);
    prefs.tray_enabled = enabled;
    crate::notification_scheduler::save_notification_prefs(&app, &prefs)
}

#[tauri::command]
pub fn send_test_notification(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title("Annado")
        .body("Notifications are working!")
        .show()
        .map_err(|e| e.to_string())
}
