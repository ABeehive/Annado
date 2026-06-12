use crate::parser::{self, derive_project_name, derive_project_name_with_pattern, extract_wikilinks, Task, WhenValue, RecurringTemplate, RecurrenceType, IntervalUnit};
use chrono::{Local, Months, NaiveDate};
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use walkdir::WalkDir;

fn default_areas_pattern() -> String { "Areas".to_string() }
fn default_daily_notes_folder() -> String { "00. Daily Notes".to_string() }
fn default_daily_notes_format() -> String { "YYYY/MM-MMMM/YYYY-MM-DD".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderPaths {
    pub recurring_templates: String,
    pub projects_pattern: String,
    #[serde(default = "default_areas_pattern")]
    pub areas_pattern: String,
    pub persons_pattern: String,
    #[serde(default = "default_daily_notes_folder")]
    pub daily_notes_folder: String,
    #[serde(default = "default_daily_notes_format")]
    pub daily_notes_format: String,
}

impl Default for FolderPaths {
    fn default() -> Self {
        FolderPaths {
            recurring_templates: "12. System/recurring-tasks".to_string(),
            projects_pattern: "Projects".to_string(),
            areas_pattern: "Areas".to_string(),
            persons_pattern: "Persons".to_string(),
            daily_notes_folder: default_daily_notes_folder(),
            daily_notes_format: default_daily_notes_format(),
        }
    }
}

#[derive(Deserialize)]
struct ObsidianDailyNotesConfig {
    #[serde(default)]
    folder: String,
    #[serde(default)]
    format: String,
}

/// Convert a moment.js date format string to a chrono format string.
/// Tokens are replaced longest-first to avoid partial matches (e.g. MMMM before MM).
fn moment_to_chrono(fmt: &str) -> String {
    let replacements: &[(&str, &str)] = &[
        ("YYYY", "%Y"),
        ("YY",   "%y"),
        ("MMMM", "%B"),
        ("MMM",  "%b"),
        ("MM",   "%m"),
        ("M",    "%m"),
        ("DD",   "%d"),
        ("D",    "%d"),
        ("dddd", "%A"),
        ("ddd",  "%a"),
    ];
    let mut result = fmt.to_string();
    for (token, chrono) in replacements {
        result = result.replace(token, chrono);
    }
    result
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Milestone {
    pub name: String,
    pub start: Option<String>,
    pub end: Option<String>,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMetadata {
    pub description: Option<String>,
    pub deadline: Option<String>,
    pub start_date: Option<String>,
    pub ranking: Option<String>,
    pub persons: Vec<String>,
    pub up: Option<String>,  // Parent project from frontmatter
    pub milestones: Vec<Milestone>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub depth: usize,
    pub parent_folder: Option<String>,
    pub metadata: ProjectMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonInfo {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersonMetadata {
    pub name: Option<String>,
    pub organisation: Option<String>,
    pub relationship: Option<String>,
    pub languages: Vec<String>,
    pub projects: Vec<String>,
}

fn is_hidden_path(path: &Path) -> bool {
    path.components().any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
}

/// For tasks with no project derived from a Projects folder, try to derive from an Areas folder.
fn apply_areas_project(tasks: &mut [Task], areas_pattern: &str) {
    if areas_pattern.is_empty() { return; }
    for task in tasks.iter_mut() {
        if task.projects.is_empty() {
            if let Some(area) = derive_project_name_with_pattern(&task.file_path, areas_pattern) {
                task.projects = vec![area];
            }
        }
    }
}

fn resolve_wikilinks(tasks: &mut [Task], person_names: &std::collections::HashSet<String>, project_names: &std::collections::HashSet<String>) {
    for task in tasks.iter_mut() {
        let wikilinks = extract_wikilinks(&task.title);
        for link in wikilinks {
            if person_names.contains(&link) {
                if !task.persons.contains(&link) {
                    task.persons.push(link.clone());
                }
            } else if project_names.contains(&link) {
                if !task.projects.contains(&link) {
                    task.projects.push(link.clone());
                }
            }
        }
    }
}

/// Walk the vault once and collect the person/project names used for wiki-link
/// resolution. The watcher caches the result and only refreshes it when a file
/// inside one of the relevant folders changes.
fn collect_wikilink_names(
    vault_root: &Path,
    persons_pattern: &str,
    projects_pattern: &str,
    areas_pattern: &str,
    excluded_paths: &[String],
) -> (std::collections::HashSet<String>, std::collections::HashSet<String>) {
    let mut person_names = std::collections::HashSet::new();
    let mut project_names = std::collections::HashSet::new();
    for entry in WalkDir::new(vault_root)
        .max_depth(5)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let file_path = entry.path();
        if !file_path.is_file() || !file_path.extension().map_or(false, |ext| ext == "md") {
            continue;
        }
        if is_hidden_path(file_path) {
            continue;
        }
        if Vault::is_path_excluded(file_path, vault_root, excluded_paths) {
            continue;
        }
        let path_str = file_path.to_string_lossy();
        if let Some(name) = file_path.file_stem().and_then(|s| s.to_str()) {
            if !name.is_empty() && !name.starts_with('.') {
                if path_str.contains(persons_pattern) && !name.contains(persons_pattern) {
                    person_names.insert(name.to_string());
                } else if path_str.contains(projects_pattern) && !name.contains(projects_pattern) {
                    project_names.insert(name.to_string());
                } else if !areas_pattern.is_empty() && path_str.contains(areas_pattern) && !name.contains(areas_pattern) {
                    project_names.insert(name.to_string());
                }
            }
        }
    }
    (person_names, project_names)
}

/// Append a marker like `@completed(2026-06-10)` to specific 1-based lines of a file.
fn append_marker_to_lines(file_path: &Path, line_numbers: &[usize], marker: &str) {
    if let Ok(content) = fs::read_to_string(file_path) {
        let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
        for ln in line_numbers {
            if *ln >= 1 && *ln <= lines.len() {
                lines[*ln - 1] = format!("{} {}", lines[*ln - 1], marker);
            }
        }
        let _ = fs::write(file_path, lines.join("\n"));
    }
}

/// Accumulate changed markdown paths from a watch event. Directory-level changes
/// (create/rename/delete of folders) can move many files at once without emitting
/// per-file events, so they request a full rescan instead.
fn collect_changed_paths(
    res: Result<Event, notify::Error>,
    changed: &mut std::collections::HashSet<PathBuf>,
    needs_full_rescan: &mut bool,
) {
    match res {
        Ok(event) => {
            for p in event.paths {
                if is_hidden_path(&p) || p.to_string_lossy().ends_with(".md.lock") {
                    continue;
                }
                if p.extension().map_or(false, |ext| ext == "md") {
                    changed.insert(p);
                } else if p.extension().is_none() {
                    *needs_full_rescan = true;
                }
            }
        }
        Err(e) => eprintln!("Watch error: {:?}", e),
    }
}

pub struct Vault {
    pub path: PathBuf,
    pub folder_paths: FolderPaths,
    pub excluded_paths: Vec<String>,
    pub is_obsidian_vault: bool,
    tasks: Arc<RwLock<HashMap<String, Task>>>,
    watcher: Option<RecommendedWatcher>,
}

impl Vault {
    pub fn new(path: PathBuf) -> Self {
        let is_obsidian = path.join(".obsidian").is_dir();
        Vault {
            path,
            folder_paths: FolderPaths::default(),
            excluded_paths: Vec::new(),
            is_obsidian_vault: is_obsidian,
            tasks: Arc::new(RwLock::new(HashMap::new())),
            watcher: None,
        }
    }

    pub fn new_with_folder_paths(path: PathBuf, folder_paths: FolderPaths, is_obsidian_vault: bool) -> Self {
        Vault {
            path,
            folder_paths,
            excluded_paths: Vec::new(),
            is_obsidian_vault,
            tasks: Arc::new(RwLock::new(HashMap::new())),
            watcher: None,
        }
    }

    pub fn set_folder_paths(&mut self, folder_paths: FolderPaths) {
        self.folder_paths = folder_paths;
    }

    pub fn set_is_obsidian_vault(&mut self, value: bool) {
        self.is_obsidian_vault = value;
    }

    pub fn set_excluded_paths(&mut self, excluded_paths: Vec<String>) {
        self.excluded_paths = excluded_paths;
    }

    /// Validate that a file path is within the vault directory.
    /// Returns the path if valid, or an error if it escapes the vault.
    fn validate_path_in_vault(&self, file_path: &str) -> Result<std::path::PathBuf, String> {
        let path = std::path::PathBuf::from(file_path);
        let canonical_vault = self.path.canonicalize()
            .map_err(|e| format!("Failed to resolve vault path: {}", e))?;
        let canonical_file = path.canonicalize()
            .map_err(|_| "File does not exist or path is invalid".to_string())?;
        if !canonical_file.starts_with(&canonical_vault) {
            return Err("Path is outside the vault".to_string());
        }
        Ok(canonical_file)
    }

    /// Parse YAML frontmatter from content. Returns (parsed YAML, body after frontmatter).
    fn parse_frontmatter(content: &str) -> Option<(serde_yml::Value, &str)> {
        if !content.starts_with("---") {
            return None;
        }
        let rest = &content[3..];
        let end_idx = rest.find("---")?;
        let yaml_content = &rest[..end_idx];
        let body = &rest[end_idx + 3..];
        let yaml: serde_yml::Value = serde_yml::from_str(yaml_content).ok()?;
        Some((yaml, body))
    }

    /// Check if a file's YAML frontmatter contains `annado_exclude: true`
    pub fn has_annado_exclude(content: &str) -> bool {
        let Some((yaml, _)) = Self::parse_frontmatter(content) else {
            return false;
        };
        if let serde_yml::Value::Mapping(map) = yaml {
            if let Some(val) = map.get(&serde_yml::Value::String("annado_exclude".to_string())) {
                return val.as_bool().unwrap_or(false);
            }
        }
        false
    }

    /// Check if a file path matches any exclusion entry.
    /// Handles both file paths (`Shopping List.md`) and folder prefixes (`Lists/`).
    pub fn is_path_excluded(file_path: &Path, vault_root: &Path, excluded_paths: &[String]) -> bool {
        let relative = match file_path.strip_prefix(vault_root) {
            Ok(r) => r.to_string_lossy().to_string(),
            Err(_) => return false,
        };
        for pattern in excluded_paths {
            if pattern.ends_with('/') {
                // Folder prefix match
                if relative.starts_with(pattern) || relative.starts_with(&pattern[..pattern.len() - 1]) {
                    return true;
                }
            } else {
                // Exact file path match
                if relative == *pattern {
                    return true;
                }
                // Also match without .md extension
                let with_md = format!("{}.md", pattern);
                if relative == with_md {
                    return true;
                }
                // Also match as folder prefix (user may omit trailing '/')
                let folder_prefix = format!("{}/", pattern);
                if relative.starts_with(&folder_prefix) {
                    return true;
                }
            }
        }
        false
    }

    pub fn scan(&self) -> Vec<Task> {
        let today = Local::now().date_naive();
        let mut all_tasks: Vec<Task> = Vec::new();

        // Get valid persons and projects for wiki-link resolution
        let persons = self.get_all_persons();
        let person_names: std::collections::HashSet<String> = persons.iter().map(|p| p.name.clone()).collect();
        let projects = self.get_all_projects();
        let project_names: std::collections::HashSet<String> = projects.iter().map(|p| p.name.clone()).collect();

        for entry in WalkDir::new(&self.path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            // Only process .md files
            if path.extension().map_or(false, |ext| ext == "md") {
                // Skip hidden files and folders
                if is_hidden_path(path) {
                    continue;
                }

                // Skip recurring-tasks folder (contains templates, not task instances)
                let path_str = path.to_string_lossy();
                if path_str.contains(&self.folder_paths.recurring_templates) {
                    continue;
                }

                // Skip excluded paths
                if Self::is_path_excluded(path, &self.path, &self.excluded_paths) {
                    continue;
                }

                if let Ok(content) = fs::read_to_string(path) {
                    // Skip files with annado_exclude: true in frontmatter
                    if Self::has_annado_exclude(&content) {
                        continue;
                    }

                    let file_path = path.to_string_lossy().to_string();
                    let mut tasks = parser::parse_file(&content, &file_path, today);

                    apply_areas_project(&mut tasks, &self.folder_paths.areas_pattern);
                    resolve_wikilinks(&mut tasks, &person_names, &project_names);
                    all_tasks.extend(tasks);
                }
            }
        }

        // Update internal cache
        {
            let mut task_map = self.tasks.write();
            task_map.clear();
            for task in &all_tasks {
                task_map.insert(task.id.clone(), task.clone());
            }
        }

        // Normalize symbolic dates (@when(today), @when(tomorrow)) by persisting actual dates
        self.normalize_symbolic_dates(&all_tasks, today);

        all_tasks
    }

    /// Normalize symbolic dates in files by replacing @when(today) and @when(tomorrow) with actual dates
    fn normalize_symbolic_dates(&self, tasks: &[Task], _today: NaiveDate) {
        for task in tasks {
            // Read the original file line to check for symbolic dates
            if let Ok(content) = fs::read_to_string(&task.file_path) {
                let lines: Vec<&str> = content.lines().collect();
                if task.line_number > 0 && task.line_number <= lines.len() {
                    let line = lines[task.line_number - 1];
                    // Check if line contains @when(today) or @when(tomorrow)
                    if line.contains("@when(today)") || line.contains("@when(tomorrow)") {
                        // Update the task to persist the actual date
                        let _ = self.update_task(task.clone());
                    }
                }
            }
        }
    }

    pub fn get_tasks(&self) -> Vec<Task> {
        self.tasks.read().values().cloned().collect()
    }

    pub fn get_task(&self, id: &str) -> Option<Task> {
        self.tasks.read().get(id).cloned()
    }

    pub fn update_task(&self, updated_task: Task) -> Result<(), String> {
        let today = Local::now().date_naive();

        // Validate file path is within vault
        self.validate_path_in_vault(&updated_task.file_path)?;

        // Read the file
        let content = fs::read_to_string(&updated_task.file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        let lines: Vec<&str> = content.lines().collect();

        // Find the line and update it
        let line_index = updated_task.line_number - 1;
        if line_index >= lines.len() {
            return Err("Line number out of bounds".to_string());
        }

        // Get project names for format_task_line
        let projects = self.get_all_projects();
        let project_names: std::collections::HashSet<String> =
            projects.iter().map(|p| p.name.clone()).collect();

        let mut new_lines: Vec<String> = lines.iter().map(|s| s.to_string()).collect();
        let file_project = derive_project_name(&updated_task.file_path);
        new_lines[line_index] = parser::format_task_line(
            &updated_task,
            today,
            file_project.as_deref(),
            &project_names,
        );

        // Handle notes: find and replace existing notes below the task
        let task_indent = updated_task.indent_level;
        let notes_indent = task_indent + 4; // Notes are indented 4 spaces more than the task

        // Find the range of existing indented content (notes/checklist) below the task
        let mut end_of_content = line_index + 1;
        while end_of_content < new_lines.len() {
            let line = &new_lines[end_of_content];
            let trimmed = line.trim_start();
            let line_indent = line.len() - trimmed.len();

            // Stop if we hit a line that's not indented more than the task
            // (unless it's an empty line, which we skip)
            if trimmed.is_empty() {
                end_of_content += 1;
                continue;
            }

            // If this is a task line at same or less indent, stop
            if line_indent <= task_indent && trimmed.starts_with("- [") {
                break;
            }

            // If line is not indented enough, stop
            if line_indent <= task_indent && !trimmed.is_empty() {
                break;
            }

            // This is indented content (notes or checklist), continue
            end_of_content += 1;
        }

        // Remove trailing empty lines from the range
        while end_of_content > line_index + 1 && new_lines[end_of_content - 1].trim().is_empty() {
            end_of_content -= 1;
        }

        // Remove old notes/indented content (but keep checklist items - lines starting with "- [")
        let mut lines_to_remove: Vec<usize> = Vec::new();
        for i in (line_index + 1)..end_of_content {
            let trimmed = new_lines[i].trim_start();
            // Only remove non-checklist lines (notes)
            if !trimmed.starts_with("- [") {
                lines_to_remove.push(i);
            }
        }
        // Remove in reverse order to maintain indices
        for i in lines_to_remove.into_iter().rev() {
            new_lines.remove(i);
        }

        // Insert new notes if present
        if !updated_task.notes.is_empty() {
            let indent_str = " ".repeat(notes_indent);
            let note_lines: Vec<String> = updated_task.notes
                .lines()
                .map(|line| format!("{}{}", indent_str, line))
                .collect();

            // Find where to insert (right after the task line)
            let insert_pos = line_index + 1;
            for (i, note_line) in note_lines.into_iter().enumerate() {
                new_lines.insert(insert_pos + i, note_line);
            }
        }

        // Write back to file
        let new_content = new_lines.join("\n");
        fs::write(&updated_task.file_path, new_content)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        // Update cache
        {
            let mut task_map = self.tasks.write();
            task_map.insert(updated_task.id.clone(), updated_task);
        }

        Ok(())
    }

    pub fn toggle_checklist_item(&self, task_id: &str, item_index: usize) -> Result<Task, String> {
        let task = self.get_task(task_id)
            .ok_or_else(|| "Task not found".to_string())?;

        if item_index >= task.checklist.len() {
            return Err(format!("Checklist index {} out of range (task has {} items)", item_index, task.checklist.len()));
        }

        // Validate file path is within vault
        self.validate_path_in_vault(&task.file_path)?;

        let content = fs::read_to_string(&task.file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        let mut lines: Vec<String> = content.split('\n').map(String::from).collect();

        // line_number is 1-based
        let task_line_index = task.line_number.saturating_sub(1);
        let task_indent = lines.get(task_line_index)
            .map(|l| l.len() - l.trim_start().len())
            .unwrap_or(0);

        // Scan forward from the task line for indented checklist lines
        let mut checklist_count = 0usize;
        let mut target_line: Option<usize> = None;

        for i in (task_line_index + 1)..lines.len() {
            let line = &lines[i];
            let trimmed = line.trim_start();
            let line_indent = line.len() - trimmed.len();

            // Stop if we hit a line at the same or lesser indent (and it's not blank)
            if line_indent <= task_indent && !trimmed.is_empty() {
                break;
            }

            // Check if this is a checklist line
            if trimmed.starts_with("- [x] ") || trimmed.starts_with("- [ ] ") || trimmed.starts_with("- [X] ") {
                if checklist_count == item_index {
                    target_line = Some(i);
                    break;
                }
                checklist_count += 1;
            }
        }

        let target = target_line.ok_or_else(|| format!("Could not find checklist item {} in file", item_index))?;

        // Toggle the checkbox on the target line
        let line = &lines[target];
        let new_line = if line.contains("- [ ] ") {
            line.replacen("- [ ] ", "- [x] ", 1)
        } else {
            // Handle both - [x] and - [X]
            line.replacen("- [x] ", "- [ ] ", 1)
                .replacen("- [X] ", "- [ ] ", 1)
        };
        lines[target] = new_line;

        // Write back to file
        let new_content = lines.join("\n");
        fs::write(&task.file_path, new_content)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        // Update the cached task's checklist
        let mut updated_task = task;
        updated_task.checklist[item_index].completed = !updated_task.checklist[item_index].completed;
        {
            let mut task_map = self.tasks.write();
            task_map.insert(updated_task.id.clone(), updated_task.clone());
        }

        Ok(updated_task)
    }

    pub fn rename_checklist_item(&self, task_id: &str, item_index: usize, new_title: &str) -> Result<Task, String> {
        let task = self.get_task(task_id)
            .ok_or_else(|| "Task not found".to_string())?;

        if item_index >= task.checklist.len() {
            return Err(format!("Checklist index {} out of range (task has {} items)", item_index, task.checklist.len()));
        }

        self.validate_path_in_vault(&task.file_path)?;

        let content = fs::read_to_string(&task.file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        let mut lines: Vec<String> = content.split('\n').map(String::from).collect();

        let task_line_index = task.line_number.saturating_sub(1);
        let task_indent = lines.get(task_line_index)
            .map(|l| l.len() - l.trim_start().len())
            .unwrap_or(0);

        let mut checklist_count = 0usize;
        let mut target_line: Option<usize> = None;

        for i in (task_line_index + 1)..lines.len() {
            let line = &lines[i];
            let trimmed = line.trim_start();
            let line_indent = line.len() - trimmed.len();

            if line_indent <= task_indent && !trimmed.is_empty() {
                break;
            }

            if trimmed.starts_with("- [x] ") || trimmed.starts_with("- [ ] ") || trimmed.starts_with("- [X] ") {
                if checklist_count == item_index {
                    target_line = Some(i);
                    break;
                }
                checklist_count += 1;
            }
        }

        let target = target_line.ok_or_else(|| format!("Could not find checklist item {} in file", item_index))?;

        let line = &lines[target];
        let indent = &line[..line.len() - line.trim_start().len()];
        let prefix = if line.contains("- [ ] ") { "- [ ] " } else { "- [x] " };
        lines[target] = format!("{}{}{}", indent, prefix, new_title);

        let new_content = lines.join("\n");
        fs::write(&task.file_path, new_content)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        let mut updated_task = task;
        updated_task.checklist[item_index].title = new_title.to_string();
        {
            let mut task_map = self.tasks.write();
            task_map.insert(updated_task.id.clone(), updated_task.clone());
        }

        Ok(updated_task)
    }

    pub fn delete_checklist_item(&self, task_id: &str, item_index: usize) -> Result<Task, String> {
        let task = self.get_task(task_id)
            .ok_or_else(|| "Task not found".to_string())?;

        if item_index >= task.checklist.len() {
            return Err(format!("Checklist index {} out of range (task has {} items)", item_index, task.checklist.len()));
        }

        self.validate_path_in_vault(&task.file_path)?;

        let content = fs::read_to_string(&task.file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        let mut lines: Vec<String> = content.split('\n').map(String::from).collect();

        let task_line_index = task.line_number.saturating_sub(1);
        let task_indent = lines.get(task_line_index)
            .map(|l| l.len() - l.trim_start().len())
            .unwrap_or(0);

        let mut checklist_count = 0usize;
        let mut target_line: Option<usize> = None;

        for i in (task_line_index + 1)..lines.len() {
            let line = &lines[i];
            let trimmed = line.trim_start();
            let line_indent = line.len() - trimmed.len();

            if line_indent <= task_indent && !trimmed.is_empty() {
                break;
            }

            if trimmed.starts_with("- [x] ") || trimmed.starts_with("- [ ] ") || trimmed.starts_with("- [X] ") {
                if checklist_count == item_index {
                    target_line = Some(i);
                    break;
                }
                checklist_count += 1;
            }
        }

        let target = target_line.ok_or_else(|| format!("Could not find checklist item {} in file", item_index))?;
        lines.remove(target);

        let new_content = lines.join("\n");
        fs::write(&task.file_path, new_content)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        let mut updated_task = task;
        updated_task.checklist.remove(item_index);
        {
            let mut task_map = self.tasks.write();
            task_map.insert(updated_task.id.clone(), updated_task.clone());
        }

        Ok(updated_task)
    }

    pub fn create_task(&self, title: &str, when: WhenValue) -> Result<Task, String> {
        let today = Local::now().date_naive();

        // Normalize WhenValue: convert Tomorrow to actual date
        let when = when.normalize(today);

        // Determine which file to write to
        let file_path = self.get_daily_note_path(today);

        // Ensure the file exists
        self.ensure_daily_note_exists(&file_path, today)?;

        // Read current content
        let content = fs::read_to_string(&file_path).unwrap_or_default();

        // Count lines to determine the new line number
        let line_count = content.lines().count();
        let new_line_number = line_count + 1;

        // Create the task
        let task = Task {
            id: Task::generate_id(&file_path.to_string_lossy(), new_line_number),
            title: title.to_string(),
            notes: String::new(),
            when: when.clone(),
            deadline: None,
            tags: Vec::new(),
            checklist: Vec::new(),
            completed: false,
            completed_date: None,
            created_date: Some(today.format("%Y-%m-%d").to_string()),
            file_path: file_path.to_string_lossy().to_string(),
            line_number: new_line_number,
            projects: Vec::new(),
            indent_level: 0,
            priority: None,
            persons: Vec::new(),
            recurring_template_id: None,
            duration_minutes: None,
            scheduled_time: None,
        };

        // Format and append to file
        let file_project = derive_project_name(&file_path.to_string_lossy());
        // Get project names for format_task_line
        let projects = self.get_all_projects();
        let project_names: std::collections::HashSet<String> =
            projects.iter().map(|p| p.name.clone()).collect();
        let task_line = parser::format_task_line(&task, today, file_project.as_deref(), &project_names);
        let new_content = if content.ends_with('\n') || content.is_empty() {
            format!("{}{}\n", content, task_line)
        } else {
            format!("{}\n{}\n", content, task_line)
        };

        fs::write(&file_path, new_content)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        // Add to cache
        {
            let mut task_map = self.tasks.write();
            task_map.insert(task.id.clone(), task.clone());
        }

        Ok(task)
    }

    fn read_obsidian_daily_notes_config(&self) -> Option<ObsidianDailyNotesConfig> {
        let path = self.path.join(".obsidian").join("daily-notes.json");
        let content = fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }

    fn get_daily_note_path(&self, date: NaiveDate) -> PathBuf {
        let (folder, format) = if self.is_obsidian_vault {
            match self.read_obsidian_daily_notes_config() {
                Some(cfg) if !cfg.format.is_empty() => (
                    cfg.folder.trim_end_matches('/').to_string(),
                    cfg.format,
                ),
                _ => (
                    self.folder_paths.daily_notes_folder.clone(),
                    self.folder_paths.daily_notes_format.clone(),
                ),
            }
        } else {
            (
                self.folder_paths.daily_notes_folder.clone(),
                self.folder_paths.daily_notes_format.clone(),
            )
        };

        let chrono_fmt = moment_to_chrono(&format);
        let date_path = date.format(&chrono_fmt).to_string();
        self.path.join(&folder).join(format!("{}.md", date_path))
    }

    fn ensure_daily_note_exists(&self, path: &Path, date: NaiveDate) -> Result<(), String> {
        if path.exists() {
            return Ok(());
        }

        // Create parent directories
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directories: {}", e))?;
        }

        // Create the daily note with frontmatter
        let frontmatter = format!(
            "---\ndate: {}\n---\n\n# {}\n\n## Tasks\n\n",
            date.format("%Y-%m-%d"),
            date.format("%A, %B %e, %Y")
        );

        fs::write(path, frontmatter)
            .map_err(|e| format!("Failed to create daily note: {}", e))?;

        Ok(())
    }

    pub fn start_watching<F>(&mut self, callback: F) -> Result<(), String>
    where
        F: Fn(Vec<Task>) + Send + 'static,
    {
        let (tx, rx) = mpsc::channel::<Result<Event, notify::Error>>();

        let path = self.path.clone();
        let tasks_ref = Arc::clone(&self.tasks);
        let persons_pattern = self.folder_paths.persons_pattern.clone();
        let projects_pattern = self.folder_paths.projects_pattern.clone();
        let areas_pattern = self.folder_paths.areas_pattern.clone();
        let recurring_templates = self.folder_paths.recurring_templates.clone();
        let excluded_paths = self.excluded_paths.clone();

        // Watcher thread: debounce a burst of events, then re-parse only the
        // changed files and diff them into the cache (no full-vault rescans).
        thread::spawn(move || {
            use std::collections::{HashMap as StdHashMap, HashSet as StdHashSet};
            use std::time::{Duration, Instant};

            let debounce_duration = Duration::from_millis(250);
            // Task IDs first seen without @created, with the time they were first observed.
            // We only write @created back after 2 s of stability to avoid interfering with
            // active editing in Obsidian.
            let mut pending_created: StdHashMap<String, Instant> = StdHashMap::new();
            let created_delay = Duration::from_secs(2);

            let (mut person_names, mut project_names) =
                collect_wikilink_names(&path, &persons_pattern, &projects_pattern, &areas_pattern, &excluded_paths);

            loop {
                // Block until something changes, then drain everything that arrives
                // within the debounce window so a burst of saves is processed once.
                let first = match rx.recv() {
                    Ok(res) => res,
                    Err(_) => break, // watcher dropped
                };

                let mut changed: StdHashSet<PathBuf> = StdHashSet::new();
                let mut needs_full_rescan = false;
                collect_changed_paths(first, &mut changed, &mut needs_full_rescan);

                let deadline = Instant::now() + debounce_duration;
                while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
                    match rx.recv_timeout(remaining) {
                        Ok(res) => collect_changed_paths(res, &mut changed, &mut needs_full_rescan),
                        Err(_) => break,
                    }
                }

                if changed.is_empty() && !needs_full_rescan {
                    continue;
                }

                let today = Local::now().date_naive();
                let today_str = today.format("%Y-%m-%d").to_string();

                // Refresh wiki-link name sets only when a project/person/area file changed
                let names_dirty = needs_full_rescan
                    || changed.iter().any(|p| {
                        let s = p.to_string_lossy();
                        s.contains(&persons_pattern)
                            || s.contains(&projects_pattern)
                            || (!areas_pattern.is_empty() && s.contains(&areas_pattern))
                    });
                if names_dirty {
                    let (pn, prn) =
                        collect_wikilink_names(&path, &persons_pattern, &projects_pattern, &areas_pattern, &excluded_paths);
                    person_names = pn;
                    project_names = prn;
                }

                if needs_full_rescan {
                    // Folder created/renamed/deleted: reconcile everything once
                    changed.clear();
                    for entry in WalkDir::new(&path)
                        .follow_links(false)
                        .into_iter()
                        .filter_map(|e| e.ok())
                    {
                        if entry.path().extension().map_or(false, |ext| ext == "md") {
                            changed.insert(entry.path().to_path_buf());
                        }
                    }
                    let existing: StdHashSet<String> =
                        changed.iter().map(|p| p.to_string_lossy().to_string()).collect();
                    tasks_ref.write().retain(|_, t| existing.contains(&t.file_path));
                }

                // Re-parse only the changed files and diff them into the cache
                for file_path in &changed {
                    let file_path_str = file_path.to_string_lossy().to_string();

                    let parsed: Option<Vec<Task>> = if !file_path.exists()
                        || is_hidden_path(file_path)
                        || file_path_str.contains(&recurring_templates)
                        || Vault::is_path_excluded(file_path, &path, &excluded_paths)
                    {
                        None // deleted, moved away, or excluded: just drop its tasks
                    } else if let Ok(content) = fs::read_to_string(file_path) {
                        if Vault::has_annado_exclude(&content) {
                            None
                        } else {
                            let mut tasks = parser::parse_file(&content, &file_path_str, today);
                            apply_areas_project(&mut tasks, &areas_pattern);
                            resolve_wikilinks(&mut tasks, &person_names, &project_names);
                            Some(tasks)
                        }
                    } else {
                        None
                    };

                    let mut file_tasks = parsed.unwrap_or_default();

                    // Stamp @completed(today) on tasks checked off in Obsidian, and queue
                    // @created stamping for brand-new tasks (after the stability delay)
                    {
                        let cached = tasks_ref.read();
                        let now = Instant::now();
                        let mut completed_lines: Vec<usize> = Vec::new();
                        for task in file_tasks.iter_mut() {
                            if task.completed && task.completed_date.is_none() {
                                if let Some(prev) = cached.get(&task.id) {
                                    if !prev.completed {
                                        task.completed_date = Some(today_str.clone());
                                        completed_lines.push(task.line_number);
                                    }
                                }
                            }
                            if task.created_date.is_none()
                                && !cached.contains_key(&task.id)
                                && !pending_created.contains_key(&task.id)
                            {
                                pending_created.insert(task.id.clone(), now);
                            }
                        }
                        drop(cached);
                        if !completed_lines.is_empty() {
                            append_marker_to_lines(
                                file_path,
                                &completed_lines,
                                &format!("@completed({})", today_str),
                            );
                        }
                    }

                    // Replace this file's tasks in the cache
                    {
                        let mut task_map = tasks_ref.write();
                        task_map.retain(|_, t| t.file_path != file_path_str);
                        for task in &file_tasks {
                            task_map.insert(task.id.clone(), task.clone());
                        }
                    }
                }

                // Flush @created stamps for tasks that have been stable for >= 2 s
                {
                    let now = Instant::now();
                    let cache = tasks_ref.read();
                    pending_created.retain(|id, _| cache.contains_key(id));
                    let ready: Vec<(String, usize, String)> = pending_created
                        .iter()
                        .filter(|(_, t)| now.duration_since(**t) >= created_delay)
                        .filter_map(|(id, _)| {
                            cache.get(id).map(|t| (t.file_path.clone(), t.line_number, id.clone()))
                        })
                        .collect();
                    drop(cache);

                    if !ready.is_empty() {
                        let mut by_file: StdHashMap<String, Vec<usize>> = StdHashMap::new();
                        for (fp, line, _) in &ready {
                            by_file.entry(fp.clone()).or_default().push(*line);
                        }
                        for (fp, lines) in &by_file {
                            append_marker_to_lines(
                                Path::new(fp),
                                lines,
                                &format!("@created({})", today_str),
                            );
                        }
                        let mut cache = tasks_ref.write();
                        for (_, _, id) in &ready {
                            if let Some(t) = cache.get_mut(id) {
                                t.created_date = Some(today_str.clone());
                            }
                            pending_created.remove(id);
                        }
                    }
                }

                callback(tasks_ref.read().values().cloned().collect());
            }
        });

        let mut watcher = RecommendedWatcher::new(tx, Config::default())
            .map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher
            .watch(&self.path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {}", e))?;

        self.watcher = Some(watcher);
        Ok(())
    }

    /// Parse project metadata from YAML frontmatter
    fn parse_project_metadata(path: &Path) -> ProjectMetadata {
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return ProjectMetadata::default(),
        };

        let Some((yaml, body_content)) = Self::parse_frontmatter(&content) else {
            // No frontmatter, try to get description from first paragraph
            let mut metadata = ProjectMetadata::default();
            metadata.description = Self::extract_first_paragraph(&content);
            return metadata;
        };

        let mut metadata = ProjectMetadata::default();

        if let serde_yml::Value::Mapping(map) = yaml {
            // Extract description from frontmatter first
            for key in &["description", "desc", "summary"] {
                if let Some(val) = map.get(&serde_yml::Value::String(key.to_string())) {
                    metadata.description = Self::yaml_to_string(val);
                    break;
                }
            }

            // Extract deadline (prefer date_deadline, then fallbacks)
            for key in &["date_deadline", "deadline", "due", "due_date"] {
                if let Some(val) = map.get(&serde_yml::Value::String(key.to_string())) {
                    metadata.deadline = Self::yaml_to_string(val);
                    break;
                }
            }

            // Extract start date (prefer date_start, then fallbacks)
            for key in &["date_start", "start", "start_date", "started"] {
                if let Some(val) = map.get(&serde_yml::Value::String(key.to_string())) {
                    metadata.start_date = Self::yaml_to_string(val);
                    break;
                }
            }

            // Extract ranking/priority
            for key in &["ranking", "priority", "rank"] {
                if let Some(val) = map.get(&serde_yml::Value::String(key.to_string())) {
                    metadata.ranking = Self::yaml_to_string(val);
                    break;
                }
            }

            // Extract persons (could be array or single value)
            for key in &["persons", "person", "people", "assigned", "assignee"] {
                if let Some(val) = map.get(&serde_yml::Value::String(key.to_string())) {
                    metadata.persons = Self::extract_persons(val);
                    if !metadata.persons.is_empty() {
                        break;
                    }
                }
            }

            // Extract parent project (up field) - handles wiki-link format [[Parent Project]]
            if let Some(val) = map.get(&serde_yml::Value::String("up".to_string())) {
                if let Some(s) = Self::yaml_to_string(val) {
                    metadata.up = Some(Self::parse_wikilink(&s));
                }
            }

            // Extract milestones
            if let Some(val) = map.get(&serde_yml::Value::String("milestones".to_string())) {
                if let serde_yml::Value::Sequence(seq) = val {
                    for item in seq {
                        if let Ok(milestone) = serde_yml::from_value::<Milestone>(item.clone()) {
                            metadata.milestones.push(milestone);
                        }
                    }
                }
            }
        }

        // If no description in frontmatter, get first paragraph from body
        if metadata.description.is_none() {
            metadata.description = Self::extract_first_paragraph(body_content);
        }

        metadata
    }

    /// Extract the first non-empty paragraph from content (skipping headings)
    fn extract_first_paragraph(content: &str) -> Option<String> {
        let mut paragraph = String::new();

        for line in content.lines() {
            let trimmed = line.trim();

            // Skip empty lines at the start
            if trimmed.is_empty() {
                if !paragraph.is_empty() {
                    // End of paragraph
                    break;
                }
                continue;
            }

            // Skip headings
            if trimmed.starts_with('#') {
                if !paragraph.is_empty() {
                    break;
                }
                continue;
            }

            // Skip task items
            if trimmed.starts_with("- [") {
                if !paragraph.is_empty() {
                    break;
                }
                continue;
            }

            // Add to paragraph
            if !paragraph.is_empty() {
                paragraph.push(' ');
            }
            paragraph.push_str(trimmed);
        }

        if paragraph.is_empty() {
            None
        } else {
            Some(paragraph)
        }
    }

    /// Convert YAML value to string
    fn yaml_to_string(val: &serde_yml::Value) -> Option<String> {
        match val {
            serde_yml::Value::String(s) => Some(s.clone()),
            serde_yml::Value::Number(n) => Some(n.to_string()),
            serde_yml::Value::Bool(b) => Some(b.to_string()),
            _ => None,
        }
    }

    /// Extract person names from YAML value, cleaning up Obsidian link format
    fn extract_persons(val: &serde_yml::Value) -> Vec<String> {
        let mut persons = Vec::new();

        let values: Vec<&serde_yml::Value> = match val {
            serde_yml::Value::Sequence(seq) => seq.iter().collect(),
            _ => vec![val],
        };

        for v in values {
            if let Some(s) = Self::yaml_to_string(v) {
                // Clean up the person string
                // Remove [[ ]] wikilinks
                let cleaned = s.trim_start_matches("[[").trim_end_matches("]]");
                // Take only the last part after / (e.g., "01. Persons/Jane Doe" -> "Jane Doe")
                let name = cleaned.rsplit('/').next().unwrap_or(cleaned);
                // Remove any leading numbers like "01. "
                let name = if let Some(idx) = name.find(". ") {
                    &name[idx + 2..]
                } else {
                    name
                };
                if !name.is_empty() {
                    persons.push(name.to_string());
                }
            }
        }

        persons
    }

    /// Get all projects from the Projects folder structure (including nested)
    /// Returns ProjectInfo with depth calculated from folder nesting:
    /// - Projects/Foo.md → depth 0
    /// - Projects/Area/Foo.md → depth 1
    /// - Projects/Area/Sub/Foo.md → depth 2
    pub fn get_all_projects(&self) -> Vec<ProjectInfo> {
        let mut projects: Vec<ProjectInfo> = Vec::new();
        let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();
        let projects_pattern = &self.folder_paths.projects_pattern;
        let areas_pattern = &self.folder_paths.areas_pattern;

        for entry in WalkDir::new(&self.path)
            .max_depth(5)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            let path_str = path.to_string_lossy();

            // Skip hidden files/folders
            if is_hidden_path(path) {
                continue;
            }

            // Respect the excluded-paths setting (e.g. an Archived subfolder)
            if Self::is_path_excluded(path, &self.path, &self.excluded_paths) {
                continue;
            }

            // Only process items inside a Projects or Areas folder
            let in_projects = path_str.contains(projects_pattern.as_str());
            let in_areas = !areas_pattern.is_empty() && path_str.contains(areas_pattern.as_str());
            if !in_projects && !in_areas {
                continue;
            }

            // Use whichever pattern matched to find the root folder index
            let active_pattern = if in_projects { projects_pattern.as_str() } else { areas_pattern.as_str() };

            // Find the Projects/Areas folder index in the path
            let parts: Vec<&str> = path_str.split('/').collect();
            let mut projects_idx: Option<usize> = None;

            for (i, part) in parts.iter().enumerate() {
                if part.contains(active_pattern) && !part.ends_with(".md") {
                    projects_idx = Some(i);
                    break;
                }
            }

            if let Some(idx) = projects_idx {
                // For .md files inside the Projects folder
                if path.is_file() && path.extension().map_or(false, |e| e == "md") {
                    let file_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");

                    // Skip the main Projects/Areas index file
                    if file_name.contains(active_pattern) || file_name.starts_with('.') {
                        continue;
                    }

                    // Calculate depth: number of folders between Projects and the file
                    // Projects/Foo.md → parts.len() = idx + 2 → depth = 0
                    // Projects/Area/Foo.md → parts.len() = idx + 3 → depth = 1
                    let depth = if parts.len() > idx + 2 {
                        parts.len() - idx - 2
                    } else {
                        0
                    };

                    // Get parent folder name (the folder directly containing this project)
                    // Projects/Area/Foo.md → parent_folder = "Area"
                    let parent_folder = if depth > 0 && parts.len() > idx + 1 {
                        Some(parts[parts.len() - 2].to_string())
                    } else {
                        None
                    };

                    // Add as a project if not already present
                    if !file_name.is_empty() && !seen_names.contains(file_name) {
                        seen_names.insert(file_name.to_string());

                        // Parse metadata from project file
                        let metadata = Self::parse_project_metadata(path);

                        projects.push(ProjectInfo {
                            name: file_name.to_string(),
                            path: path_str.to_string(),
                            depth,
                            parent_folder,
                            metadata,
                        });
                    }
                }
            }
        }

        // Sort by path to maintain hierarchical order
        projects.sort_by(|a, b| a.path.cmp(&b.path));
        projects
    }

    /// Get all persons from the "01. Persons" or "Persons" folder
    /// Returns PersonInfo for each .md file (name derived from filename)
    pub fn get_all_persons(&self) -> Vec<PersonInfo> {
        let mut persons: Vec<PersonInfo> = Vec::new();
        let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();
        let persons_pattern = &self.folder_paths.persons_pattern;

        for entry in WalkDir::new(&self.path)
            .max_depth(3)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            let path_str = path.to_string_lossy();

            // Skip hidden files/folders
            if is_hidden_path(path) {
                continue;
            }

            // Respect the excluded-paths setting
            if Self::is_path_excluded(path, &self.path, &self.excluded_paths) {
                continue;
            }

            // Only process items inside a Persons folder
            if !path_str.contains(persons_pattern) {
                continue;
            }

            // Find the Persons folder index in the path
            let parts: Vec<&str> = path_str.split('/').collect();
            let mut persons_idx: Option<usize> = None;

            for (i, part) in parts.iter().enumerate() {
                if part.contains(persons_pattern) && !part.ends_with(".md") {
                    persons_idx = Some(i);
                    break;
                }
            }

            if persons_idx.is_some() {
                // For .md files inside the Persons folder
                if path.is_file() && path.extension().map_or(false, |e| e == "md") {
                    let file_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");

                    // Skip index files or hidden files
                    if file_name.contains(persons_pattern) || file_name.starts_with('.') {
                        continue;
                    }

                    // Add as a person if not already present
                    if !file_name.is_empty() && !seen_names.contains(file_name) {
                        seen_names.insert(file_name.to_string());

                        persons.push(PersonInfo {
                            name: file_name.to_string(),
                            path: path_str.to_string(),
                        });
                    }
                }
            }
        }

        // Sort by name alphabetically
        persons.sort_by(|a, b| a.name.cmp(&b.name));
        persons
    }

    /// Find the person file for a given person name
    pub fn find_person_file(&self, person_name: &str) -> Option<PathBuf> {
        let persons_pattern = &self.folder_paths.persons_pattern;

        for entry in WalkDir::new(&self.path)
            .max_depth(3)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            let path_str = path.to_string_lossy();

            // Only process items inside a Persons folder
            if !path_str.contains(persons_pattern) {
                continue;
            }

            // Skip hidden files/folders
            if is_hidden_path(path) {
                continue;
            }

            // Check if this is the person file
            if path.is_file() && path.extension().map_or(false, |e| e == "md") {
                let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                if file_stem == person_name {
                    return Some(path.to_path_buf());
                }
            }
        }
        None
    }

    /// Parse person metadata from YAML frontmatter
    fn parse_person_metadata(path: &Path) -> PersonMetadata {
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return PersonMetadata::default(),
        };

        let Some((yaml, _)) = Self::parse_frontmatter(&content) else {
            return PersonMetadata::default();
        };

        let mut metadata = PersonMetadata::default();

        if let serde_yml::Value::Mapping(map) = yaml {
            // Extract name
            if let Some(val) = map.get(&serde_yml::Value::String("name".to_string())) {
                metadata.name = Self::yaml_to_string(val);
            }

            // Extract organisation (check multiple spellings)
            for key in &["organisation", "organization", "org", "company"] {
                if let Some(val) = map.get(&serde_yml::Value::String(key.to_string())) {
                    metadata.organisation = Self::yaml_to_string(val);
                    break;
                }
            }

            // Extract relationship
            for key in &["relationship", "relation", "type"] {
                if let Some(val) = map.get(&serde_yml::Value::String(key.to_string())) {
                    metadata.relationship = Self::yaml_to_string(val);
                    break;
                }
            }

            // Extract languages (could be array or single value)
            for key in &["languages", "language", "lang"] {
                if let Some(val) = map.get(&serde_yml::Value::String(key.to_string())) {
                    metadata.languages = Self::extract_string_array(val);
                    if !metadata.languages.is_empty() {
                        break;
                    }
                }
            }

            // Extract projects (could be array or single value, often wiki-links)
            for key in &["projects", "project"] {
                if let Some(val) = map.get(&serde_yml::Value::String(key.to_string())) {
                    metadata.projects = Self::extract_wikilink_array(val);
                    if !metadata.projects.is_empty() {
                        break;
                    }
                }
            }
        }

        metadata
    }

    /// Extract a string array from a YAML value
    fn extract_string_array(val: &serde_yml::Value) -> Vec<String> {
        match val {
            serde_yml::Value::Sequence(seq) => {
                seq.iter()
                    .filter_map(|v| Self::yaml_to_string(v))
                    .collect()
            }
            serde_yml::Value::String(s) => {
                // Single string - check if comma-separated
                s.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            }
            _ => Vec::new(),
        }
    }

    /// Extract wiki-link references as names (strips [[path/to/name]] to just "name")
    fn extract_wikilink_array(val: &serde_yml::Value) -> Vec<String> {
        Self::extract_string_array(val)
            .into_iter()
            .map(|s| Self::parse_wikilink(&s))
            .collect()
    }

    /// Parse a wiki-link and extract the display name
    /// "[[path/to/Project Name]]" -> "Project Name"
    /// "Project Name" -> "Project Name"
    fn parse_wikilink(s: &str) -> String {
        let trimmed = s.trim();
        // Check if it's a wiki-link
        if trimmed.starts_with("[[") && trimmed.ends_with("]]") {
            let inner = &trimmed[2..trimmed.len() - 2];
            // Get the last part after any slashes (the actual name)
            inner.rsplit('/').next().unwrap_or(inner).to_string()
        } else {
            trimmed.to_string()
        }
    }

    /// Get person metadata by name
    pub fn get_person_metadata(&self, person_name: &str) -> PersonMetadata {
        match self.find_person_file(person_name) {
            Some(path) => Self::parse_person_metadata(&path),
            None => PersonMetadata::default(),
        }
    }

    /// Find the project file for a given project name
    /// Looks for patterns like:
    /// - 02. Projects/ProjectName/ProjectName.md
    /// - 02. Projects/ProjectName.md
    /// - Projects/ProjectName/ProjectName.md
    pub fn find_project_file(&self, project_name: &str) -> Option<PathBuf> {
        let projects_pattern = &self.folder_paths.projects_pattern;
        let areas_pattern = &self.folder_paths.areas_pattern;

        // Search for folders/files containing the projects or areas pattern
        for entry in WalkDir::new(&self.path)
            .max_depth(4)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            let path_str = path.to_string_lossy();

            // Check if this is in a Projects or Areas folder
            let in_projects = path_str.contains(projects_pattern.as_str());
            let in_areas = !areas_pattern.is_empty() && path_str.contains(areas_pattern.as_str());
            if !in_projects && !in_areas {
                continue;
            }

            // Skip hidden files/folders
            if is_hidden_path(path) {
                continue;
            }

            // Check if this is the project file
            if path.is_file() && path.extension().map_or(false, |e| e == "md") {
                let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");

                // Check if filename matches project name
                if file_stem == project_name {
                    return Some(path.to_path_buf());
                }

                // Also check parent folder name (for ProjectName/ProjectName.md pattern)
                if let Some(parent) = path.parent() {
                    if let Some(parent_name) = parent.file_name().and_then(|s| s.to_str()) {
                        if parent_name == project_name && file_stem == project_name {
                            return Some(path.to_path_buf());
                        }
                    }
                }
            }
        }

        None
    }

    /// Update project metadata in the project file's YAML frontmatter
    pub fn update_project_metadata(&self, project_name: &str, metadata: &ProjectMetadata) -> Result<(), String> {
        let project_file = self.find_project_file(project_name)
            .ok_or_else(|| format!("Could not find project file for: {}", project_name))?;

        let content = fs::read_to_string(&project_file)
            .map_err(|e| format!("Failed to read project file: {}", e))?;

        let new_content = if content.starts_with("---") {
            // Update existing frontmatter
            let rest = &content[3..];
            if let Some(end_idx) = rest.find("---") {
                let yaml_content = &rest[..end_idx];
                let body = &rest[end_idx + 3..];

                // Parse existing YAML
                let mut yaml: serde_yml::Value = serde_yml::from_str(yaml_content)
                    .unwrap_or(serde_yml::Value::Mapping(serde_yml::Mapping::new()));

                if let serde_yml::Value::Mapping(ref mut map) = yaml {
                    // Update fields
                    Self::set_yaml_field(map, "description", &metadata.description);
                    Self::set_yaml_field(map, "date_deadline", &metadata.deadline);
                    Self::set_yaml_field(map, "date_start", &metadata.start_date);
                    Self::set_yaml_field(map, "ranking", &metadata.ranking);
                    Self::set_yaml_field(map, "up", &metadata.up);

                    // Remove legacy field names (to avoid duplicates)
                    for legacy_key in &["deadline", "due", "due_date"] {
                        map.remove(&serde_yml::Value::String(legacy_key.to_string()));
                    }
                    for legacy_key in &["start", "start_date", "started"] {
                        map.remove(&serde_yml::Value::String(legacy_key.to_string()));
                    }

                    // Update persons
                    if !metadata.persons.is_empty() {
                        let persons: Vec<serde_yml::Value> = metadata.persons
                            .iter()
                            .map(|p| serde_yml::Value::String(p.clone()))
                            .collect();
                        map.insert(
                            serde_yml::Value::String("persons".to_string()),
                            serde_yml::Value::Sequence(persons),
                        );
                    } else {
                        map.remove(&serde_yml::Value::String("persons".to_string()));
                    }

                    // Update milestones
                    if !metadata.milestones.is_empty() {
                        let milestones_value = serde_yml::to_value(&metadata.milestones)
                            .unwrap_or(serde_yml::Value::Sequence(vec![]));
                        map.insert(
                            serde_yml::Value::String("milestones".to_string()),
                            milestones_value,
                        );
                    } else {
                        map.remove(&serde_yml::Value::String("milestones".to_string()));
                    }
                }

                let new_yaml = serde_yml::to_string(&yaml)
                    .map_err(|e| format!("Failed to serialize YAML: {}", e))?;

                format!("---\n{}---{}", new_yaml, body)
            } else {
                return Err("Invalid frontmatter format".to_string());
            }
        } else {
            // Create new frontmatter
            let mut map = serde_yml::Mapping::new();
            Self::set_yaml_field(&mut map, "description", &metadata.description);
            Self::set_yaml_field(&mut map, "date_deadline", &metadata.deadline);
            Self::set_yaml_field(&mut map, "date_start", &metadata.start_date);
            Self::set_yaml_field(&mut map, "ranking", &metadata.ranking);
            Self::set_yaml_field(&mut map, "up", &metadata.up);

            if !metadata.persons.is_empty() {
                let persons: Vec<serde_yml::Value> = metadata.persons
                    .iter()
                    .map(|p| serde_yml::Value::String(p.clone()))
                    .collect();
                map.insert(
                    serde_yml::Value::String("persons".to_string()),
                    serde_yml::Value::Sequence(persons),
                );
            }

            if !metadata.milestones.is_empty() {
                let milestones_value = serde_yml::to_value(&metadata.milestones)
                    .unwrap_or(serde_yml::Value::Sequence(vec![]));
                map.insert(
                    serde_yml::Value::String("milestones".to_string()),
                    milestones_value,
                );
            }

            let yaml = serde_yml::Value::Mapping(map);
            let yaml_str = serde_yml::to_string(&yaml)
                .map_err(|e| format!("Failed to serialize YAML: {}", e))?;

            format!("---\n{}---\n\n{}", yaml_str, content)
        };

        fs::write(&project_file, new_content)
            .map_err(|e| format!("Failed to write project file: {}", e))?;

        Ok(())
    }

    /// Set a field in the YAML mapping, removing it if the value is None
    fn set_yaml_field(map: &mut serde_yml::Mapping, key: &str, value: &Option<String>) {
        let key = serde_yml::Value::String(key.to_string());
        if let Some(v) = value {
            map.insert(key, serde_yml::Value::String(v.clone()));
        } else {
            map.remove(&key);
        }
    }

    /// Set or remove `annado_exclude: true` in a file's YAML frontmatter
    pub fn set_annado_exclude_frontmatter(&self, relative_path: &str, exclude: bool) -> Result<(), String> {
        let file_path = self.path.join(relative_path);

        // Guard against path traversal
        let canonical_vault = self.path.canonicalize()
            .map_err(|e| format!("Failed to resolve vault path: {}", e))?;
        let canonical_file = file_path.canonicalize()
            .map_err(|_| "File does not exist or path is invalid".to_string())?;
        if !canonical_file.starts_with(&canonical_vault) {
            return Err("Path is outside the vault".to_string());
        }

        // Silently skip directories and non-existent files
        if !file_path.is_file() {
            return Ok(());
        }

        let content = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        let new_content = if content.starts_with("---") {
            let rest = &content[3..];
            if let Some(end_idx) = rest.find("---") {
                let yaml_content = &rest[..end_idx];
                let body = &rest[end_idx + 3..];

                let mut yaml: serde_yml::Value = serde_yml::from_str(yaml_content)
                    .unwrap_or(serde_yml::Value::Mapping(serde_yml::Mapping::new()));

                if let serde_yml::Value::Mapping(ref mut map) = yaml {
                    let key = serde_yml::Value::String("annado_exclude".to_string());
                    if exclude {
                        map.insert(key, serde_yml::Value::Bool(true));
                    } else {
                        map.remove(&key);
                    }
                }

                let new_yaml = serde_yml::to_string(&yaml)
                    .map_err(|e| format!("Failed to serialize YAML: {}", e))?;

                format!("---\n{}---{}", new_yaml, body)
            } else {
                return Err("Invalid frontmatter format".to_string());
            }
        } else if exclude {
            // No frontmatter exists, prepend new block
            format!("---\nannado_exclude: true\n---\n{}", content)
        } else {
            // No frontmatter and exclude=false, nothing to do
            return Ok(());
        };

        fs::write(&file_path, new_content)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        Ok(())
    }

    /// Get the path to the recurring tasks folder
    pub fn get_recurring_folder_path(&self) -> PathBuf {
        self.path.join(&self.folder_paths.recurring_templates)
    }

    /// Ensure the recurring tasks folder exists
    fn ensure_recurring_folder_exists(&self) -> Result<(), String> {
        let folder = self.get_recurring_folder_path();
        if !folder.exists() {
            fs::create_dir_all(&folder)
                .map_err(|e| format!("Failed to create recurring tasks folder: {}", e))?;
        }
        Ok(())
    }

    /// Parse a recurring template from a file
    fn parse_recurring_template(path: &Path) -> Option<RecurringTemplate> {
        let content = fs::read_to_string(path).ok()?;

        let (yaml, body_raw) = Self::parse_frontmatter(&content)?;
        let body = body_raw.trim();
        let map = yaml.as_mapping()?;

        let template_id = map.get(&serde_yml::Value::String("template_id".to_string()))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())?;

        let recurrence_type_str = map.get(&serde_yml::Value::String("recurrence_type".to_string()))
            .and_then(|v| v.as_str())
            .unwrap_or("fixed");
        let recurrence_type = match recurrence_type_str {
            "after_completion" => RecurrenceType::AfterCompletion,
            _ => RecurrenceType::Fixed,
        };

        let interval = map.get(&serde_yml::Value::String("interval".to_string()))
            .and_then(|v| v.as_u64())
            .unwrap_or(1) as u32;

        let interval_unit_str = map.get(&serde_yml::Value::String("interval_unit".to_string()))
            .and_then(|v| v.as_str())
            .unwrap_or("days");
        let interval_unit = match interval_unit_str {
            "weeks" => IntervalUnit::Weeks,
            _ => IntervalUnit::Days,
        };

        let start_date = map.get(&serde_yml::Value::String("start_date".to_string()))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let last_generated = map.get(&serde_yml::Value::String("last_generated".to_string()))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let last_completed = map.get(&serde_yml::Value::String("last_completed".to_string()))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Parse the task line from body
        let mut title = String::new();
        let mut notes = String::new();
        let mut projects = Vec::new();
        let mut priority = None;
        let mut tags = Vec::new();

        for (i, line) in body.lines().enumerate() {
            if let Some(parsed) = parser::parse_task_line(line) {
                // Extract task properties
                let (_, content_after_when) = parser::extract_when(&parsed.content, Local::now().date_naive());
                let (_, content_after_due) = parser::extract_due(&content_after_when);
                let (explicit_project, content_after_project) = parser::extract_project(&content_after_due);
                let (task_priority, content_after_priority) = parser::extract_priority(&content_after_project);
                let (task_tags, task_title) = parser::extract_tags(&content_after_priority);

                title = task_title.trim().to_string();
                priority = task_priority;
                tags = task_tags;

                // Extract projects from wikilinks
                let wikilinks = extract_wikilinks(&parsed.content);
                projects = wikilinks;

                if let Some(proj) = explicit_project {
                    if !projects.contains(&proj) {
                        projects.push(proj);
                    }
                }

                // Check for notes (indented lines after task)
                for note_line in body.lines().skip(i + 1) {
                    if note_line.starts_with("    ") || note_line.starts_with("\t") {
                        if !notes.is_empty() {
                            notes.push('\n');
                        }
                        notes.push_str(note_line.trim());
                    } else if !note_line.trim().is_empty() {
                        break;
                    }
                }
                break;
            }
        }

        Some(RecurringTemplate {
            template_id,
            title,
            notes,
            recurrence_type,
            interval,
            interval_unit,
            start_date,
            last_generated,
            last_completed,
            file_path: path.to_string_lossy().to_string(),
            projects,
            priority,
            tags,
        })
    }

    /// Get all recurring templates
    pub fn get_all_recurring_templates(&self) -> Vec<RecurringTemplate> {
        let folder = self.get_recurring_folder_path();
        if !folder.exists() {
            return Vec::new();
        }

        let mut templates = Vec::new();
        if let Ok(entries) = fs::read_dir(&folder) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.extension().map_or(false, |ext| ext == "md") {
                    if let Some(template) = Self::parse_recurring_template(&path) {
                        templates.push(template);
                    }
                }
            }
        }
        templates
    }

    /// Generate a unique template ID
    fn generate_template_id() -> String {
        use sha2::{Digest, Sha256};
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let mut hasher = Sha256::new();
        hasher.update(format!("{}", timestamp));
        let result = hasher.finalize();
        hex::encode(&result[..6]) // 12-character hex string
    }

    /// Create a new recurring template
    pub fn create_recurring_template(
        &self,
        title: &str,
        notes: Option<&str>,
        recurrence_type: RecurrenceType,
        interval: u32,
        interval_unit: IntervalUnit,
        start_date: Option<&str>,
        project: Option<&str>,
        priority: Option<u8>,
        tags: Vec<String>,
    ) -> Result<RecurringTemplate, String> {
        self.ensure_recurring_folder_exists()?;

        let template_id = Self::generate_template_id();
        let filename = format!("{}.md", sanitize_filename(&title));
        let file_path = self.get_recurring_folder_path().join(&filename);

        let recurrence_type_str = match recurrence_type {
            RecurrenceType::Fixed => "fixed",
            RecurrenceType::AfterCompletion => "after_completion",
        };

        let interval_unit_str = match interval_unit {
            IntervalUnit::Days => "days",
            IntervalUnit::Weeks => "weeks",
            IntervalUnit::Months => "months",
            IntervalUnit::Years => "years",
        };

        // Build the task line
        let mut task_parts = vec![title.to_string()];
        if let Some(proj) = project {
            task_parts.push(format!("[[{}]]", proj));
        }
        if let Some(p) = priority {
            task_parts.push(format!("!({})", p));
        }
        for tag in &tags {
            task_parts.push(format!("#{}", tag));
        }

        let task_line = format!("- [ ] {}", task_parts.join(" "));
        let notes_content = notes.map(|n| format!("    {}", n.replace('\n', "\n    "))).unwrap_or_default();

        // Build YAML frontmatter
        let start_date_line = start_date.map(|d| format!("start_date: {}\n", d)).unwrap_or_default();

        let content = format!(
            "---\nrecurrence_type: {}\ninterval: {}\ninterval_unit: {}\n{}template_id: {}\nannado_exclude: true\n---\n\n{}\n{}",
            recurrence_type_str,
            interval,
            interval_unit_str,
            start_date_line,
            template_id,
            task_line,
            if notes_content.is_empty() { String::new() } else { format!("\n{}", notes_content) }
        );

        fs::write(&file_path, content)
            .map_err(|e| format!("Failed to create recurring template: {}", e))?;

        // Create the first instance immediately (atomically with template creation)
        let instance_date = start_date
            .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
            .unwrap_or_else(|| Local::now().date_naive());

        let template_for_instance = RecurringTemplate {
            template_id: template_id.clone(),
            title: title.to_string(),
            notes: notes.unwrap_or("").to_string(),
            recurrence_type: recurrence_type.clone(),
            interval,
            interval_unit: interval_unit.clone(),
            start_date: start_date.map(|s| s.to_string()),
            last_generated: None,
            last_completed: None,
            file_path: file_path.to_string_lossy().to_string(),
            projects: project.map(|p| vec![p.to_string()]).unwrap_or_default(),
            priority,
            tags: tags.clone(),
        };

        // Create instance (ignore error if already exists - shouldn't happen for new template)
        let _ = self.create_recurring_instance(&template_for_instance, instance_date);

        // Update last_generated in the template file
        let date_str = instance_date.format("%Y-%m-%d").to_string();
        self.update_template_last_generated(&template_for_instance, &date_str)?;

        Ok(RecurringTemplate {
            template_id,
            title: title.to_string(),
            notes: notes.unwrap_or("").to_string(),
            recurrence_type,
            interval,
            interval_unit,
            start_date: start_date.map(|s| s.to_string()),
            last_generated: Some(date_str),
            last_completed: None,
            file_path: file_path.to_string_lossy().to_string(),
            projects: project.map(|p| vec![p.to_string()]).unwrap_or_default(),
            priority,
            tags,
        })
    }

    /// Update an existing recurring template
    pub fn update_recurring_template(
        &self,
        template_id: &str,
        title: Option<&str>,
        notes: Option<&str>,
        recurrence_type: Option<RecurrenceType>,
        interval: Option<u32>,
        interval_unit: Option<IntervalUnit>,
        start_date: Option<&str>,
        project: Option<&str>,
        priority: Option<Option<u8>>,
        tags: Option<Vec<String>>,
    ) -> Result<RecurringTemplate, String> {
        // Find the template
        let templates = self.get_all_recurring_templates();
        let template = templates.iter()
            .find(|t| t.template_id == template_id)
            .ok_or("Template not found")?;

        let file_path = PathBuf::from(&template.file_path);

        // Update values
        let new_title = title.unwrap_or(&template.title);
        let new_notes = notes.unwrap_or(&template.notes);
        let new_recurrence_type = recurrence_type.clone().unwrap_or(template.recurrence_type.clone());
        let new_interval = interval.unwrap_or(template.interval);
        let new_interval_unit = interval_unit.clone().unwrap_or(template.interval_unit.clone());
        let new_start_date = start_date.map(|s| s.to_string()).or_else(|| template.start_date.clone());
        let new_priority = priority.unwrap_or(template.priority);
        let new_tags = tags.clone().unwrap_or(template.tags.clone());
        let new_projects = if let Some(proj) = project {
            if proj.is_empty() {
                Vec::new()
            } else {
                vec![proj.to_string()]
            }
        } else {
            template.projects.clone()
        };

        let recurrence_type_str = match new_recurrence_type {
            RecurrenceType::Fixed => "fixed",
            RecurrenceType::AfterCompletion => "after_completion",
        };

        let interval_unit_str = match new_interval_unit {
            IntervalUnit::Days => "days",
            IntervalUnit::Weeks => "weeks",
            IntervalUnit::Months => "months",
            IntervalUnit::Years => "years",
        };

        // Build the task line
        let mut task_parts = vec![new_title.to_string()];
        for proj in &new_projects {
            task_parts.push(format!("[[{}]]", proj));
        }
        if let Some(p) = new_priority {
            task_parts.push(format!("!({})", p));
        }
        for tag in &new_tags {
            task_parts.push(format!("#{}", tag));
        }

        let task_line = format!("- [ ] {}", task_parts.join(" "));
        let notes_content = if new_notes.is_empty() {
            String::new()
        } else {
            format!("\n    {}", new_notes.replace('\n', "\n    "))
        };

        // Preserve last_generated and last_completed
        let mut yaml_lines = vec![
            "---".to_string(),
            format!("recurrence_type: {}", recurrence_type_str),
            format!("interval: {}", new_interval),
            format!("interval_unit: {}", interval_unit_str),
        ];
        if let Some(ref sd) = new_start_date {
            yaml_lines.push(format!("start_date: {}", sd));
        }
        if let Some(ref lg) = template.last_generated {
            yaml_lines.push(format!("last_generated: {}", lg));
        }
        if let Some(ref lc) = template.last_completed {
            yaml_lines.push(format!("last_completed: {}", lc));
        }
        yaml_lines.push(format!("template_id: {}", template_id));
        yaml_lines.push("---".to_string());

        let content = format!(
            "{}\n\n{}{}",
            yaml_lines.join("\n"),
            task_line,
            notes_content
        );

        fs::write(&file_path, content)
            .map_err(|e| format!("Failed to update recurring template: {}", e))?;

        Ok(RecurringTemplate {
            template_id: template_id.to_string(),
            title: new_title.to_string(),
            notes: new_notes.to_string(),
            recurrence_type: new_recurrence_type,
            interval: new_interval,
            interval_unit: new_interval_unit,
            start_date: new_start_date,
            last_generated: template.last_generated.clone(),
            last_completed: template.last_completed.clone(),
            file_path: file_path.to_string_lossy().to_string(),
            projects: new_projects,
            priority: new_priority,
            tags: new_tags,
        })
    }

    /// Delete a recurring template
    pub fn delete_recurring_template(&self, template_id: &str) -> Result<(), String> {
        let templates = self.get_all_recurring_templates();
        let template = templates.iter()
            .find(|t| t.template_id == template_id)
            .ok_or("Template not found")?;

        fs::remove_file(&template.file_path)
            .map_err(|e| format!("Failed to delete recurring template: {}", e))?;

        Ok(())
    }

    /// Check if an instance should be generated for a template today
    fn should_generate_instance(&self, template: &RecurringTemplate, today: NaiveDate) -> bool {
        // For first generation (never generated before), always create the instance immediately
        // The instance will use start_date as its when date (handled in generate_recurring_instances)
        // so it appears in Upcoming view if start_date is in the future
        if template.last_generated.is_none() {
            return true;
        }

        // For subsequent generations, follow normal recurrence logic
        // (start_date only affects the first instance, not subsequent ones)
        match template.recurrence_type {
            RecurrenceType::Fixed => {
                // Generate if enough time has passed since last generation
                if let Some(ref last_gen) = template.last_generated {
                    if let Ok(last_date) = NaiveDate::parse_from_str(last_gen, "%Y-%m-%d") {
                        let next_date = self.calculate_next_date(last_date, template.interval, &template.interval_unit);
                        today >= next_date
                    } else {
                        true
                    }
                } else {
                    true // Should not reach here due to early return above
                }
            }
            RecurrenceType::AfterCompletion => {
                // Only generate if the previous instance was completed
                match &template.last_completed {
                    None => {
                        // If never completed, don't generate another instance
                        false
                    }
                    Some(last_comp) => {
                        if let Ok(last_date) = NaiveDate::parse_from_str(last_comp, "%Y-%m-%d") {
                            let next_date = self.calculate_next_date(last_date, template.interval, &template.interval_unit);
                            today >= next_date
                        } else {
                            false
                        }
                    }
                }
            }
        }
    }

    /// Calculate the next date based on interval and unit
    fn calculate_next_date(&self, from_date: NaiveDate, interval: u32, unit: &IntervalUnit) -> NaiveDate {
        match unit {
            IntervalUnit::Days => from_date + chrono::Duration::days(interval as i64),
            IntervalUnit::Weeks => from_date + chrono::Duration::weeks(interval as i64),
            IntervalUnit::Months => from_date
                .checked_add_months(Months::new(interval))
                .unwrap_or(from_date),
            IntervalUnit::Years => from_date
                .checked_add_months(Months::new(interval * 12))
                .unwrap_or(from_date),
        }
    }

    /// Update the last_generated field in a template file
    /// Set (or insert) a scalar field inside a template file's YAML frontmatter.
    /// Edits the frontmatter lines directly so the rest of the file, key order,
    /// and formatting stay untouched.
    fn update_template_yaml_field(file_path: &str, field: &str, value: &str) -> Result<(), String> {
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read template: {}", e))?;

        let mut lines: Vec<String> = content.lines().map(String::from).collect();
        if lines.first().map(|l| l.trim() != "---").unwrap_or(true) {
            return Err("Template has no frontmatter".to_string());
        }
        let end = lines
            .iter()
            .enumerate()
            .skip(1)
            .find(|(_, l)| l.trim() == "---")
            .map(|(i, _)| i)
            .ok_or("Template frontmatter is not closed")?;

        let prefix = format!("{}:", field);
        if let Some(line) = lines[1..end].iter_mut().find(|l| l.trim_start().starts_with(&prefix)) {
            *line = format!("{} {}", prefix, value);
        } else {
            lines.insert(end, format!("{} {}", prefix, value));
        }

        fs::write(file_path, lines.join("\n"))
            .map_err(|e| format!("Failed to update template: {}", e))
    }

    fn update_template_last_generated(&self, template: &RecurringTemplate, date: &str) -> Result<(), String> {
        Self::update_template_yaml_field(&template.file_path, "last_generated", date)
    }

    /// Update the last_completed field in a template file
    pub fn update_template_last_completed(&self, template_id: &str, date: &str) -> Result<(), String> {
        let templates = self.get_all_recurring_templates();
        let template = templates.iter()
            .find(|t| t.template_id == template_id)
            .ok_or("Template not found")?;
        Self::update_template_yaml_field(&template.file_path, "last_completed", date)
    }

    /// Generate recurring task instances for today
    pub fn generate_recurring_instances(&self) -> Result<Vec<Task>, String> {
        let today = Local::now().date_naive();
        let templates = self.get_all_recurring_templates();
        // Use cached tasks (not scan()) to avoid race conditions
        let existing_tasks = self.get_tasks();
        let mut created_tasks = Vec::new();

        for template in templates {
            if self.should_generate_instance(&template, today) {
                // Check if an uncompleted instance already exists for this template
                // This prevents duplicates even if the function is called multiple times
                let already_exists = existing_tasks.iter().any(|t| {
                    t.recurring_template_id.as_ref() == Some(&template.template_id) && !t.completed
                });

                if already_exists {
                    continue; // Skip, uncompleted instance already exists
                }

                // For first generation, use start_date if set; otherwise use today
                let instance_date = if template.last_generated.is_none() {
                    if let Some(ref start_date_str) = template.start_date {
                        NaiveDate::parse_from_str(start_date_str, "%Y-%m-%d").unwrap_or(today)
                    } else {
                        today
                    }
                } else {
                    today
                };

                // Create an instance in the daily note
                // create_recurring_instance will return an error if instance already exists in file
                match self.create_recurring_instance(&template, instance_date) {
                    Ok(task) => {
                        created_tasks.push(task);

                        // Update last_generated
                        let date_str = instance_date.format("%Y-%m-%d").to_string();
                        self.update_template_last_generated(&template, &date_str)?;
                    }
                    Err(e) if e.contains("already exists") => {
                        // Instance already exists in file, skip silently
                        continue;
                    }
                    Err(e) => return Err(e),
                }
            }
        }

        Ok(created_tasks)
    }

    /// Create a single recurring task instance
    fn create_recurring_instance(&self, template: &RecurringTemplate, date: NaiveDate) -> Result<Task, String> {
        let file_path = self.get_daily_note_path(date);
        self.ensure_daily_note_exists(&file_path, date)?;

        // Use file-based lock to prevent concurrent instance creation
        let lock_path = file_path.with_extension("md.lock");
        let lock_file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&lock_path);

        let _lock_guard = match lock_file {
            Ok(_f) => Some(()),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                return Err(format!("Instance creation already in progress for {}", date));
            }
            Err(_e) => {
                // If we can't create lock (e.g., permissions), proceed without lock
                // This is a fallback to avoid blocking on non-critical errors
                None
            }
        };

        // Ensure lock is cleaned up on function exit
        struct LockCleanup<'a>(&'a Path);
        impl<'a> Drop for LockCleanup<'a> {
            fn drop(&mut self) {
                let _ = fs::remove_file(self.0);
            }
        }
        let _cleanup = LockCleanup(&lock_path);

        let content = fs::read_to_string(&file_path).unwrap_or_default();

        // Check if this template's instance already exists in this file
        // This prevents duplicates even with concurrent calls
        let recurring_marker = format!("@recurring({})", template.template_id);
        if content.contains(&recurring_marker) {
            // Instance already exists, return a dummy task (will be filtered by caller)
            return Err(format!("Instance for template {} already exists", template.template_id));
        }

        let line_count = content.lines().count();
        let new_line_number = line_count + 1;

        // Build task line with all metadata
        let mut parts = vec![template.title.clone()];
        parts.push(format!("@when({})", date.format("%Y-%m-%d")));

        for project in &template.projects {
            parts.push(format!("[[{}]]", project));
        }

        if let Some(p) = template.priority {
            parts.push(format!("!({})", p));
        }

        for tag in &template.tags {
            parts.push(format!("#{}", tag));
        }

        parts.push(format!("@recurring({})", template.template_id));

        let task_line = format!("- [ ] {}", parts.join(" "));

        // Add notes as indented lines after the task
        let task_with_notes = if !template.notes.is_empty() {
            let indented_notes = template.notes
                .lines()
                .map(|line| format!("    {}", line))
                .collect::<Vec<_>>()
                .join("\n");
            format!("{}\n{}", task_line, indented_notes)
        } else {
            task_line
        };

        let new_content = if content.ends_with('\n') || content.is_empty() {
            format!("{}{}\n", content, task_with_notes)
        } else {
            format!("{}\n{}\n", content, task_with_notes)
        };

        fs::write(&file_path, new_content)
            .map_err(|e| format!("Failed to write task: {}", e))?;

        let task = Task {
            id: Task::generate_id(&file_path.to_string_lossy(), new_line_number),
            title: template.title.clone(),
            notes: template.notes.clone(),
            when: WhenValue::Date(date.format("%Y-%m-%d").to_string()),
            deadline: None,
            tags: template.tags.clone(),
            checklist: Vec::new(),
            completed: false,
            completed_date: None,
            created_date: Some(date.format("%Y-%m-%d").to_string()),
            file_path: file_path.to_string_lossy().to_string(),
            line_number: new_line_number,
            projects: template.projects.clone(),
            indent_level: 0,
            priority: template.priority,
            persons: Vec::new(),
            recurring_template_id: Some(template.template_id.clone()),
            duration_minutes: None,
            scheduled_time: None,
        };

        // Add to cache so subsequent get_tasks() calls include this instance
        {
            let mut task_map = self.tasks.write();
            task_map.insert(task.id.clone(), task.clone());
        }

        Ok(task)
    }

    fn find_or_create_projects_root(&self) -> Result<PathBuf, String> {
        let projects_pattern = &self.folder_paths.projects_pattern;
        for entry in WalkDir::new(&self.path).max_depth(2).follow_links(false).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_dir() && !is_hidden_path(path) {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.contains(projects_pattern.as_str()) {
                        return Ok(path.to_path_buf());
                    }
                }
            }
        }
        let root = self.path.join(projects_pattern.as_str());
        fs::create_dir_all(&root).map_err(|e| format!("Failed to create projects folder: {}", e))?;
        Ok(root)
    }

    fn find_or_create_persons_root(&self) -> Result<PathBuf, String> {
        let persons_pattern = &self.folder_paths.persons_pattern;
        for entry in WalkDir::new(&self.path).max_depth(2).follow_links(false).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_dir() && !is_hidden_path(path) {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.contains(persons_pattern.as_str()) {
                        return Ok(path.to_path_buf());
                    }
                }
            }
        }
        let root = self.path.join(persons_pattern.as_str());
        fs::create_dir_all(&root).map_err(|e| format!("Failed to create persons folder: {}", e))?;
        Ok(root)
    }

    fn replace_wikilink_across_vault(&self, old_name: &str, new_name: &str) -> Result<(), String> {
        let old_link = format!("[[{}]]", old_name);
        let new_link = format!("[[{}]]", new_name);
        for entry in WalkDir::new(&self.path).follow_links(false).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |e| e == "md") && !is_hidden_path(path) {
                if let Ok(content) = fs::read_to_string(path) {
                    if content.contains(&old_link) {
                        let _ = fs::write(path, content.replace(&old_link, &new_link));
                    }
                }
            }
        }
        Ok(())
    }

    pub fn create_project_file(
        &self,
        name: &str,
        parent_folder: Option<&str>,
        description: Option<&str>,
        deadline: Option<&str>,
        persons: &[String],
        milestones: &[Milestone],
    ) -> Result<ProjectInfo, String> {
        let safe_name = sanitize_filename(name);
        if safe_name.is_empty() {
            return Err("Project name is empty after sanitization".to_string());
        }

        let projects_root = self.find_or_create_projects_root()?;

        let target_path = if let Some(parent) = parent_folder {
            let safe_parent = sanitize_filename(parent);
            let parent_dir = projects_root.join(&safe_parent);
            fs::create_dir_all(&parent_dir)
                .map_err(|e| format!("Failed to create parent folder: {}", e))?;
            parent_dir.join(format!("{}.md", safe_name))
        } else {
            projects_root.join(format!("{}.md", safe_name))
        };

        if target_path.exists() {
            return Err(format!("Project '{}' already exists", safe_name));
        }

        let mut yaml_lines: Vec<String> = Vec::new();
        if let Some(desc) = description {
            if !desc.trim().is_empty() {
                yaml_lines.push(format!("description: {}", desc.trim()));
            }
        }
        if let Some(dl) = deadline {
            if !dl.trim().is_empty() {
                yaml_lines.push(format!("date_deadline: {}", dl.trim()));
            }
        }
        if !persons.is_empty() {
            yaml_lines.push("persons:".to_string());
            for p in persons {
                if self.is_obsidian_vault {
                    yaml_lines.push(format!("  - \"[[{}]]\"", p));
                } else {
                    yaml_lines.push(format!("  - \"{}\"", p));
                }
            }
        }
        if !milestones.is_empty() {
            yaml_lines.push("milestones:".to_string());
            for m in milestones {
                yaml_lines.push(format!("  - name: {}", m.name));
                if let Some(ref end) = m.end {
                    yaml_lines.push(format!("    end: {}", end));
                }
                yaml_lines.push("    completed: false".to_string());
            }
        }

        let content = if yaml_lines.is_empty() {
            format!("# {}\n", safe_name)
        } else {
            format!("---\n{}\n---\n\n# {}\n", yaml_lines.join("\n"), safe_name)
        };

        fs::write(&target_path, &content)
            .map_err(|e| format!("Failed to create project file: {}", e))?;

        let depth = if parent_folder.is_some() { 1 } else { 0 };
        let metadata = Self::parse_project_metadata(&target_path);

        Ok(ProjectInfo {
            name: safe_name,
            path: target_path.to_string_lossy().to_string(),
            depth,
            parent_folder: parent_folder.map(sanitize_filename),
            metadata,
        })
    }

    pub fn rename_project_file(&self, old_name: &str, new_name: &str) -> Result<ProjectInfo, String> {
        let safe_new_name = sanitize_filename(new_name);
        if safe_new_name.is_empty() {
            return Err("New project name is empty".to_string());
        }

        let old_path = self.find_project_file(old_name)
            .ok_or_else(|| format!("Project '{}' not found", old_name))?;

        let parent_dir = old_path.parent().ok_or("Could not get parent directory")?;
        let new_path = parent_dir.join(format!("{}.md", safe_new_name));

        if new_path.exists() {
            return Err(format!("Project '{}' already exists", safe_new_name));
        }

        fs::rename(&old_path, &new_path)
            .map_err(|e| format!("Failed to rename project file: {}", e))?;

        self.replace_wikilink_across_vault(old_name, &safe_new_name)?;

        let projects_pattern = &self.folder_paths.projects_pattern;
        let path_str = new_path.to_string_lossy();
        let parts: Vec<&str> = path_str.split('/').collect();
        let projects_idx = parts.iter().position(|p| p.contains(projects_pattern.as_str()) && !p.ends_with(".md"));
        let depth = if let Some(idx) = projects_idx {
            if parts.len() > idx + 2 { parts.len() - idx - 2 } else { 0 }
        } else { 0 };
        let parent_folder = if depth > 0 { parts.get(parts.len().saturating_sub(2)).map(|s| s.to_string()) } else { None };

        let metadata = Self::parse_project_metadata(&new_path);

        Ok(ProjectInfo {
            name: safe_new_name,
            path: new_path.to_string_lossy().to_string(),
            depth,
            parent_folder,
            metadata,
        })
    }

    pub fn create_person_file(
        &self,
        name: &str,
        organisation: Option<&str>,
        relationship: Option<&str>,
        languages: &[String],
        projects: &[String],
    ) -> Result<PersonInfo, String> {
        let safe_name = sanitize_filename(name);
        if safe_name.is_empty() {
            return Err("Person name is empty after sanitization".to_string());
        }

        let persons_root = self.find_or_create_persons_root()?;
        let target_path = persons_root.join(format!("{}.md", safe_name));

        if target_path.exists() {
            return Err(format!("Person '{}' already exists", safe_name));
        }

        let mut yaml_lines: Vec<String> = Vec::new();
        if let Some(org) = organisation {
            if !org.trim().is_empty() {
                yaml_lines.push(format!("organisation: {}", org.trim()));
            }
        }
        if let Some(rel) = relationship {
            if !rel.trim().is_empty() {
                yaml_lines.push(format!("relationship: {}", rel.trim()));
            }
        }
        if !languages.is_empty() {
            yaml_lines.push("languages:".to_string());
            for lang in languages {
                yaml_lines.push(format!("  - {}", lang));
            }
        }
        if !projects.is_empty() {
            yaml_lines.push("projects:".to_string());
            for proj in projects {
                if self.is_obsidian_vault {
                    yaml_lines.push(format!("  - \"[[{}]]\"", proj));
                } else {
                    yaml_lines.push(format!("  - \"{}\"", proj));
                }
            }
        }

        let content = if yaml_lines.is_empty() {
            format!("# {}\n", safe_name)
        } else {
            format!("---\n{}\n---\n\n# {}\n", yaml_lines.join("\n"), safe_name)
        };

        fs::write(&target_path, &content)
            .map_err(|e| format!("Failed to create person file: {}", e))?;

        Ok(PersonInfo {
            name: safe_name,
            path: target_path.to_string_lossy().to_string(),
        })
    }

    pub fn rename_person_file(&self, old_name: &str, new_name: &str) -> Result<PersonInfo, String> {
        let safe_new_name = sanitize_filename(new_name);
        if safe_new_name.is_empty() {
            return Err("New person name is empty".to_string());
        }

        let old_path = self.find_person_file(old_name)
            .ok_or_else(|| format!("Person '{}' not found", old_name))?;

        let parent_dir = old_path.parent().ok_or("Could not get parent directory")?;
        let new_path = parent_dir.join(format!("{}.md", safe_new_name));

        if new_path.exists() {
            return Err(format!("Person '{}' already exists", safe_new_name));
        }

        fs::rename(&old_path, &new_path)
            .map_err(|e| format!("Failed to rename person file: {}", e))?;

        self.replace_wikilink_across_vault(old_name, &safe_new_name)?;

        Ok(PersonInfo {
            name: safe_new_name,
            path: new_path.to_string_lossy().to_string(),
        })
    }
}

/// Sanitize a string for use as a filename
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
        .trim()
        .to_string()
}

impl Vault {
    /// Delete a task by removing its line from the markdown file
    pub fn delete_task(&self, task_id: &str) -> Result<(), String> {
        // Find the task by ID to get file path and line number
        let task = self.get_task(task_id).ok_or("Task not found")?;

        // Validate file path is within vault
        self.validate_path_in_vault(&task.file_path)?;

        // Read the file
        let content = fs::read_to_string(&task.file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        let lines: Vec<&str> = content.lines().collect();
        let line_index = task.line_number - 1;

        if line_index >= lines.len() {
            return Err("Line number out of bounds".to_string());
        }

        // Find the range of lines to remove (task line + any indented content below it)
        let task_indent = task.indent_level;
        let mut end_of_content = line_index + 1;

        while end_of_content < lines.len() {
            let line = lines[end_of_content];
            let trimmed = line.trim_start();
            let line_indent = line.len() - trimmed.len();

            // Empty lines - continue checking
            if trimmed.is_empty() {
                end_of_content += 1;
                continue;
            }

            // If this is a task line at same or less indent, stop
            if line_indent <= task_indent && trimmed.starts_with("- [") {
                break;
            }

            // If line is not indented more than the task, stop
            if line_indent <= task_indent {
                break;
            }

            // This is indented content (notes or checklist), include it
            end_of_content += 1;
        }

        // Remove trailing empty lines from the range
        while end_of_content > line_index + 1 && lines[end_of_content - 1].trim().is_empty() {
            end_of_content -= 1;
        }

        // Create new content without the task and its associated content
        let mut new_lines: Vec<&str> = Vec::new();
        for (i, line) in lines.iter().enumerate() {
            if i < line_index || i >= end_of_content {
                new_lines.push(line);
            }
        }

        // Write back to file
        let new_content = new_lines.join("\n");
        fs::write(&task.file_path, new_content)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        // Remove from cache
        {
            let mut task_map = self.tasks.write();
            task_map.remove(task_id);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_path_excluded_folder_without_trailing_slash() {
        // Settings entry format: folder path with no trailing slash
        let vault = Path::new("/Users/demo/Vault");
        let excluded = vec!["02. Projects/Archived".to_string()];

        let archived_project =
            Path::new("/Users/demo/Vault/02. Projects/Archived/Old Project.md");
        assert!(Vault::is_path_excluded(archived_project, vault, &excluded));

        let nested =
            Path::new("/Users/demo/Vault/02. Projects/Archived/2024/Older.md");
        assert!(Vault::is_path_excluded(nested, vault, &excluded));

        let active_project =
            Path::new("/Users/demo/Vault/02. Projects/Current Project.md");
        assert!(!Vault::is_path_excluded(active_project, vault, &excluded));

        // Prefix must match whole folder names, not partial ones like "Archived Extra"...
        let similar =
            Path::new("/Users/demo/Vault/02. Projects/ArchivedExtra/P.md");
        // Documents current behavior: bare pattern also matches as plain prefix
        // via the trailing-slash variant only, so this must NOT be excluded.
        assert!(!Vault::is_path_excluded(similar, vault, &excluded));
    }

    #[test]
    fn test_is_path_excluded_exact_file_and_md_variant() {
        let vault = Path::new("/v");
        let excluded = vec!["Shopping List".to_string()];
        assert!(Vault::is_path_excluded(Path::new("/v/Shopping List.md"), vault, &excluded));
        assert!(!Vault::is_path_excluded(Path::new("/v/Shopping.md"), vault, &excluded));
    }
}
