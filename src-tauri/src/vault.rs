use crate::parser::{self, derive_project_name, derive_project_name_with_pattern, extract_wikilinks, Task, WhenValue, RecurringTemplate, RecurrenceType, IntervalUnit};
use chrono::{Local, NaiveDate};
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

/// Canonical task order: document order (file path, then line number).
/// Stable across edits/deletes so task lists don't reshuffle in the UI.
/// This is the same key `Task::generate_id` hashes, and `(file_path, line_number)`
/// is unique per task, so the stable sort needs no further tie-break.
fn sort_tasks(tasks: &mut [Task]) {
    tasks.sort_by(|a, b| {
        a.file_path
            .cmp(&b.file_path)
            .then(a.line_number.cmp(&b.line_number))
    });
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
        // The title resolves both persons and projects.
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

        // Subtasks (checklist items) resolve persons only, so a [[Person Name]]
        // mentioned only in a subtask still surfaces the task under that contact.
        // Projects are intentionally excluded here: task.projects round-trips into
        // the title line on save (see parser::format_task_line), so adding a
        // subtask's [[Project]] would hoist it into the title and mutate the file.
        let subtask_persons: Vec<String> = task
            .checklist
            .iter()
            .flat_map(|item| extract_wikilinks(&item.title))
            .filter(|link| person_names.contains(link))
            .collect();
        for link in subtask_persons {
            if !task.persons.contains(&link) {
                task.persons.push(link);
            }
        }
    }
}

/// Layer frontmatter tags onto a file's tasks as inherited tags (post-parse,
/// like `persons`). Own line tags win: duplicates are dropped case-insensitively.
fn apply_inherited_tags(tasks: &mut [Task], content: &str, global_enabled: bool) {
    let inherit = Vault::annado_inherit_tags_override(content).unwrap_or(global_enabled);
    if !inherit {
        return;
    }
    let fm_tags = Vault::frontmatter_tags(content);
    if fm_tags.is_empty() {
        return;
    }
    for task in tasks.iter_mut() {
        task.inherited_tags = fm_tags
            .iter()
            .filter(|ft| !task.tags.iter().any(|t| t.eq_ignore_ascii_case(ft)))
            .cloned()
            .collect();
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

/// Write a created-date marker for the given (file_path, line_number) entries,
/// grouped per file. Shared by the watcher flush and the startup back-fill.
fn write_created_markers(entries: &[(String, usize)], task_format: crate::taskformat::TaskFormat, today_str: &str) {
    let Some(marker) = crate::taskformat::encode_created(&Some(today_str.to_string()), task_format) else {
        return;
    };
    let mut by_file: HashMap<String, Vec<usize>> = HashMap::new();
    for (fp, line) in entries {
        by_file.entry(fp.clone()).or_default().push(*line);
    }
    for (fp, lines) in &by_file {
        append_marker_to_lines(Path::new(fp), lines, &marker);
    }
}

/// Drop queued @created stamps whose task disappeared from the cache or already
/// carries a created-date — a scan() back-fill (settings changes rescan) can stamp
/// a task inside the watcher's 2 s stability window, and flushing it again would
/// write a second @created marker on the same line.
fn retain_unstamped_pending(
    pending: &mut HashMap<String, std::time::Instant>,
    cache: &HashMap<String, Task>,
) {
    pending.retain(|id, _| cache.get(id).map_or(false, |t| t.created_date.is_none()));
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
    // Shared so the background file-watcher reads the live value (no restart needed on change).
    task_format: Arc<RwLock<crate::taskformat::TaskFormat>>,
    task_marker: Arc<RwLock<String>>, // import marker tag ("" = import every checkbox)
    inherit_tags: Arc<RwLock<bool>>, // global tag-inheritance setting (frontmatter tags)
    recurring_template_count: Arc<RwLock<usize>>, // legacy templates found in the last scan
    tasks: Arc<RwLock<HashMap<String, Task>>>,
    watcher: Option<RecommendedWatcher>,
    // Where the last-scan timestamp lives (app config dir). None = startup
    // back-fill disabled (unit tests that don't opt in).
    state_path: Option<PathBuf>,
}

/// Report from the one-time recurrence migration (template model -> inline @repeat model).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationReport {
    pub templates: usize,
    pub new_tasks: Vec<String>,      // formatted inline recurring task lines that will be created
    pub instances_deorphaned: usize, // completed instances kept, @recurring marker stripped
    pub instances_removed: usize,    // uncompleted instances collapsed away
    pub backup_path: Option<String>,
}

/// Build a transient inline recurring task from a legacy template (used by the migration).
/// `file_path`/`line_number` are placeholders; the caller decides where to write it.
fn build_inline_recurring_task(
    template: &RecurringTemplate,
    rec: crate::recurrence::Recurrence,
    next: NaiveDate,
) -> Task {
    Task {
        id: String::new(),
        title: template.title.clone(),
        notes: template.notes.clone(),
        when: WhenValue::Date(next.format("%Y-%m-%d").to_string()),
        deadline: None,
        tags: template.tags.clone(),
        inherited_tags: Vec::new(),
        checklist: Vec::new(),
        completed: false,
        completed_date: None,
        created_date: None,
        file_path: String::new(),
        line_number: 0,
        projects: template.projects.clone(),
        indent_level: 0,
        priority: template.priority,
        persons: Vec::new(),
        recurrence: Some(rec),
        duration_minutes: None,
        scheduled_time: None,
    }
}

impl Vault {
    pub fn new_with_folder_paths(path: PathBuf, folder_paths: FolderPaths, is_obsidian_vault: bool) -> Self {
        Vault {
            path,
            folder_paths,
            excluded_paths: Vec::new(),
            is_obsidian_vault,
            task_format: Arc::new(RwLock::new(crate::taskformat::TaskFormat::Annado)),
            task_marker: Arc::new(RwLock::new(String::new())),
            inherit_tags: Arc::new(RwLock::new(false)),
            recurring_template_count: Arc::new(RwLock::new(0)),
            tasks: Arc::new(RwLock::new(HashMap::new())),
            watcher: None,
            state_path: None,
        }
    }

    pub fn set_folder_paths(&mut self, folder_paths: FolderPaths) {
        self.folder_paths = folder_paths;
    }

    /// Set where the last-scan timestamp is persisted, enabling the startup
    /// back-fill in `scan()`. Not called = back-fill stays disabled.
    pub fn set_state_path(&mut self, path: PathBuf) {
        self.state_path = Some(path);
    }

    /// Loads the last-scan timestamp, but only if it was saved for THIS vault.
    /// A single global state file is shared across all vaults a user opens; if
    /// its `vault_path` doesn't match (or is missing, e.g. an older state file),
    /// treat it as if this vault had never been scanned, so a freshly cloned or
    /// newly opened vault never inherits another vault's stale timestamp and
    /// mass-stamps its historic tasks.
    fn load_last_scan_unix(&self) -> Option<u64> {
        let p = self.state_path.as_ref()?;
        let content = fs::read_to_string(p).ok()?;
        let v: serde_json::Value = serde_json::from_str(&content).ok()?;
        let stored_vault_path = v.get("vault_path")?.as_str()?;
        if stored_vault_path != self.path.to_string_lossy() {
            return None;
        }
        v.get("last_scan_unix")?.as_u64()
    }

    fn save_last_scan_unix(&self) {
        if let Some(p) = &self.state_path {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let payload = serde_json::json!({
                "last_scan_unix": now,
                "vault_path": self.path.to_string_lossy(),
            });
            let _ = fs::write(p, payload.to_string());
        }
    }

    pub fn set_task_format(&self, task_format: crate::taskformat::TaskFormat) {
        *self.task_format.write() = task_format;
    }

    pub fn current_task_format(&self) -> crate::taskformat::TaskFormat {
        *self.task_format.read()
    }

    pub fn set_task_marker(&self, task_marker: String) {
        *self.task_marker.write() = task_marker;
    }

    pub fn current_task_marker(&self) -> String {
        self.task_marker.read().clone()
    }

    pub fn set_inherit_tags(&self, enabled: bool) {
        *self.inherit_tags.write() = enabled;
    }

    pub fn inherit_tags_enabled(&self) -> bool {
        *self.inherit_tags.read()
    }

    /// Non-hidden, non-excluded `.md` files anywhere in the vault. The single place that
    /// owns the walk + skip rules, so they can't drift between call sites.
    fn walk_md_files(&self) -> impl Iterator<Item = PathBuf> + '_ {
        WalkDir::new(&self.path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
            .map(|e| e.into_path())
            .filter(move |p| {
                p.extension().map_or(false, |x| x == "md")
                    && !is_hidden_path(p)
                    && !Self::is_path_excluded(p, &self.path, &self.excluded_paths)
            })
    }

    /// Collect raw top-level task lines across the vault (for format detection).
    pub fn collect_task_lines(&self) -> Vec<String> {
        let mut lines: Vec<String> = Vec::new();
        for path in self.walk_md_files() {
            if let Ok(content) = fs::read_to_string(&path) {
                if Self::is_recurring_template(&content) {
                    continue; // legacy template file — not real tasks
                }
                for line in content.lines() {
                    if let Some(parsed) = parser::parse_task_line(line) {
                        if parsed.indent < 4 {
                            lines.push(line.to_string());
                        }
                    }
                }
            }
        }
        lines
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

    /// Tags from a note's YAML frontmatter `tags:` property — list form or a
    /// comma-separated string — normalized without a leading '#'.
    pub fn frontmatter_tags(content: &str) -> Vec<String> {
        let Some((yaml, _)) = Self::parse_frontmatter(content) else {
            return Vec::new();
        };
        let serde_yml::Value::Mapping(map) = yaml else {
            return Vec::new();
        };
        let mut out: Vec<String> = Vec::new();
        match map.get(&serde_yml::Value::String("tags".to_string())) {
            Some(serde_yml::Value::Sequence(seq)) => {
                for v in seq {
                    if let Some(s) = v.as_str() {
                        let t = s.trim().trim_start_matches('#');
                        if !t.is_empty() {
                            out.push(t.to_string());
                        }
                    }
                }
            }
            Some(serde_yml::Value::String(s)) => {
                for part in s.split(',') {
                    let t = part.trim().trim_start_matches('#');
                    if !t.is_empty() {
                        out.push(t.to_string());
                    }
                }
            }
            _ => {}
        }
        out
    }

    /// Per-note override for tag inheritance: Some(value) when the note sets
    /// `annado_inherit_tags`, None when absent (global setting applies).
    pub fn annado_inherit_tags_override(content: &str) -> Option<bool> {
        let (yaml, _) = Self::parse_frontmatter(content)?;
        if let serde_yml::Value::Mapping(map) = yaml {
            return map
                .get(&serde_yml::Value::String("annado_inherit_tags".to_string()))
                .and_then(|v| v.as_bool());
        }
        None
    }

    /// Whether a file is a legacy recurring-task template, identified by the trio of
    /// frontmatter keys the old format always wrote together (robust against a stray
    /// `template_id:` in an unrelated note). Used to detect + skip templates regardless
    /// of which folder they live in.
    pub fn is_recurring_template(content: &str) -> bool {
        let Some((yaml, _)) = Self::parse_frontmatter(content) else {
            return false;
        };
        if let serde_yml::Value::Mapping(map) = yaml {
            let has = |k: &str| map.contains_key(&serde_yml::Value::String(k.to_string()));
            return has("template_id") && has("recurrence_type") && has("interval_unit");
        }
        false
    }

    /// Number of legacy recurring templates found in the last scan (cached; O(1) read).
    pub fn recurring_template_count(&self) -> usize {
        *self.recurring_template_count.read()
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
        let mut template_count = 0usize; // legacy recurring templates seen (content-detected)

        // Get valid persons and projects for wiki-link resolution
        let persons = self.get_all_persons();
        let person_names: std::collections::HashSet<String> = persons.iter().map(|p| p.name.clone()).collect();
        let projects = self.get_all_projects();
        let project_names: std::collections::HashSet<String> = projects.iter().map(|p| p.name.clone()).collect();

        let last_scan_unix = self.load_last_scan_unix();
        let mut backfill: Vec<(String, usize)> = Vec::new();

        for path in self.walk_md_files() {
            if let Ok(content) = fs::read_to_string(&path) {
                // Skip legacy recurring-template files (anywhere) so their body checkbox
                // isn't imported as a task; count them for the migration UI. Checked
                // BEFORE annado_exclude — a template is never a task, regardless of any
                // annado_exclude flag it carries (else such templates go uncounted).
                if Self::is_recurring_template(&content) {
                    template_count += 1;
                    continue;
                }
                // Skip files with annado_exclude: true in frontmatter
                if Self::has_annado_exclude(&content) {
                    continue;
                }

                let file_path = path.to_string_lossy().to_string();
                let mut tasks = parser::parse_file_with_marker(&content, &file_path, today, &self.current_task_marker());

                apply_areas_project(&mut tasks, &self.folder_paths.areas_pattern);
                resolve_wikilinks(&mut tasks, &person_names, &project_names);
                apply_inherited_tags(&mut tasks, &content, self.inherit_tags_enabled());

                // Startup back-fill: stamp created-dates only for files modified
                // since the previous scan, so a first run or vault import never
                // mass-stamps historic tasks.
                if let Some(last) = last_scan_unix {
                    let mtime_unix = fs::metadata(&path)
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs());
                    if mtime_unix.map_or(false, |m| m > last) {
                        let today_str = today.format("%Y-%m-%d").to_string();
                        for task in tasks.iter_mut().filter(|t| t.created_date.is_none()) {
                            backfill.push((task.file_path.clone(), task.line_number));
                            task.created_date = Some(today_str.clone());
                        }
                    }
                }

                all_tasks.extend(tasks);
            }
        }

        *self.recurring_template_count.write() = template_count;

        if !backfill.is_empty() {
            write_created_markers(&backfill, self.current_task_format(), &today.format("%Y-%m-%d").to_string());
        }
        self.save_last_scan_unix();

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

        // Return in canonical document order so the initial load matches every
        // later refresh (get_tasks / the watcher emit), which also sort.
        sort_tasks(&mut all_tasks);
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
        // HashMap iteration order is unspecified; return canonical document order
        // so the UI list is stable across refreshes.
        let mut tasks: Vec<Task> = self.tasks.read().values().cloned().collect();
        sort_tasks(&mut tasks);
        tasks
    }

    pub fn get_task(&self, id: &str) -> Option<Task> {
        self.tasks.read().get(id).cloned()
    }

    /// Insert `task`'s formatted line immediately after `after_line` (1-based) in `file_path`.
    pub fn insert_task_after(
        &self,
        file_path: &str,
        after_line: usize,
        task: &Task,
    ) -> Result<(), String> {
        self.validate_path_in_vault(file_path)?;
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
        let today = Local::now().date_naive();
        let project_names: std::collections::HashSet<String> =
            self.get_all_projects().iter().map(|p| p.name.clone()).collect();
        let file_project = derive_project_name(file_path);
        let new_line = parser::format_task_line_with_marker(task, today, file_project.as_deref(), &project_names, self.current_task_format(), &self.current_task_marker());
        let idx = after_line.min(lines.len());
        lines.insert(idx, new_line);
        fs::write(file_path, lines.join("\n"))
            .map_err(|e| format!("Failed to write file: {}", e))?;
        Ok(())
    }

    pub fn update_task(&self, mut updated_task: Task) -> Result<(), String> {
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
        new_lines[line_index] = parser::format_task_line_with_marker(
            &updated_task,
            today,
            file_project.as_deref(),
            &project_names,
            self.current_task_format(),
            &self.current_task_marker(),
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

        // Inheritance is derived from the note's frontmatter at scan time; keep
        // it across in-place updates so the pills don't flicker away.
        if let Some(prev) = self.tasks.read().get(&updated_task.id) {
            updated_task.inherited_tags = prev.inherited_tags.clone();
        }

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
        let mut task = Task {
            id: Task::generate_id(&file_path.to_string_lossy(), new_line_number),
            title: title.to_string(),
            notes: String::new(),
            when: when.clone(),
            deadline: None,
            tags: Vec::new(),
            inherited_tags: Vec::new(),
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
            recurrence: None,
            duration_minutes: None,
            scheduled_time: None,
        };

        // Resolve [[Project]]/[[Person]] wikilinks in the title at creation, the same way
        // the file-watcher does on re-scan, so a typed [[Existing Project]] is assigned
        // immediately instead of flickering through the inbox. (An unknown link is left
        // untouched in the title, where it renders as the grey dashed "create it" chip.)
        let projects = self.get_all_projects();
        let project_names: std::collections::HashSet<String> =
            projects.iter().map(|p| p.name.clone()).collect();
        let person_names: std::collections::HashSet<String> =
            self.get_all_persons().iter().map(|p| p.name.clone()).collect();
        resolve_wikilinks(std::slice::from_mut(&mut task), &person_names, &project_names);

        // Format and append to file
        let file_project = derive_project_name(&file_path.to_string_lossy());
        let task_line = parser::format_task_line_with_marker(&task, today, file_project.as_deref(), &project_names, self.current_task_format(), &self.current_task_marker());
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
        let excluded_paths = self.excluded_paths.clone();
        // Share the live cells so format/marker changes take effect without an app restart.
        let task_marker = Arc::clone(&self.task_marker);
        let task_format = Arc::clone(&self.task_format);
        let inherit_tags = Arc::clone(&self.inherit_tags);

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
                // Read the current format/marker once per event batch (live, not snapshotted).
                let task_format = *task_format.read();
                let task_marker = task_marker.read().clone();

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
                        || Vault::is_path_excluded(file_path, &path, &excluded_paths)
                    {
                        None // deleted, moved away, or excluded: just drop its tasks
                    } else if let Ok(content) = fs::read_to_string(file_path) {
                        if Vault::has_annado_exclude(&content) || Vault::is_recurring_template(&content) {
                            None
                        } else {
                            let mut tasks = parser::parse_file_with_marker(&content, &file_path_str, today, &task_marker);
                            apply_areas_project(&mut tasks, &areas_pattern);
                            resolve_wikilinks(&mut tasks, &person_names, &project_names);
                            apply_inherited_tags(&mut tasks, &content, *inherit_tags.read());
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
                                &crate::taskformat::encode_completed(&Some(today_str.clone()), task_format)
                                    .unwrap_or_default(),
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
                    retain_unstamped_pending(&mut pending_created, &cache);
                    let ready: Vec<(String, usize, String)> = pending_created
                        .iter()
                        .filter(|(_, t)| now.duration_since(**t) >= created_delay)
                        .filter_map(|(id, _)| {
                            cache.get(id).map(|t| (t.file_path.clone(), t.line_number, id.clone()))
                        })
                        .collect();
                    drop(cache);

                    if !ready.is_empty() {
                        let entries: Vec<(String, usize)> =
                            ready.iter().map(|(fp, line, _)| (fp.clone(), *line)).collect();
                        write_created_markers(&entries, task_format, &today_str);

                        let mut cache = tasks_ref.write();
                        for (_, _, id) in &ready {
                            if let Some(t) = cache.get_mut(id) {
                                t.created_date = Some(today_str.clone());
                            }
                            pending_created.remove(id);
                        }
                    }
                }

                // Emit in canonical document order (HashMap order is unspecified)
                // so file changes don't reshuffle the UI list.
                let mut snapshot: Vec<Task> = tasks_ref.read().values().cloned().collect();
                sort_tasks(&mut snapshot);
                callback(snapshot);
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
    /// Parse a recurring template from a file's content (file_path is stored on the struct).
    fn parse_recurring_template(content: &str, file_path: &str) -> Option<RecurringTemplate> {
        let (yaml, body_raw) = Self::parse_frontmatter(content)?;
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
            "months" => IntervalUnit::Months,
            "years" => IntervalUnit::Years,
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
            file_path: file_path.to_string(),
            projects,
            priority,
            tags,
        })
    }

    /// Get all legacy recurring templates anywhere in the vault (content-detected, so the
    /// migration works regardless of which folder they were stored in). Called only during
    /// the one-time migration, not on load.
    pub fn get_all_recurring_templates(&self) -> Vec<RecurringTemplate> {
        let mut templates = Vec::new();
        for path in self.walk_md_files() {
            if let Ok(content) = fs::read_to_string(&path) {
                if Self::is_recurring_template(&content) {
                    if let Some(template) =
                        Self::parse_recurring_template(&content, &path.to_string_lossy())
                    {
                        templates.push(template);
                    }
                }
            }
        }
        templates
    }

    /// Generate a unique template ID
    // ---- Recurrence migration: template model -> inline @repeat model ----

    /// Migrate legacy recurring templates + their `@recurring(<id>)` instances to the
    /// inline `@repeat(<rule>)` model. `apply == false` is a dry-run (no writes).
    pub fn migrate_recurrence(&self, apply: bool) -> Result<MigrationReport, String> {
        let templates = self.get_all_recurring_templates();
        let today = Local::now().date_naive();
        let project_names = self.project_names_set();
        let mut report = MigrationReport {
            templates: templates.len(),
            new_tasks: Vec::new(),
            instances_deorphaned: 0,
            instances_removed: 0,
            backup_path: None,
        };

        if apply {
            report.backup_path = Some(self.backup_vault()?);
        }

        // 1. One inline recurring task per template, dated at its next occurrence.
        for template in &templates {
            let mode = match template.recurrence_type {
                RecurrenceType::Fixed => crate::recurrence::RecurrenceMode::Fixed,
                RecurrenceType::AfterCompletion => crate::recurrence::RecurrenceMode::WhenDone,
            };
            let rec = crate::recurrence::Recurrence {
                interval: template.interval,
                unit: template.interval_unit.clone(),
                mode,
                raw: None,
            };
            let next = self.template_next_date(template, &rec, today);
            let task = build_inline_recurring_task(template, rec, next);
            let file_project = derive_project_name(&task.file_path);
            report
                .new_tasks
                .push(parser::format_task_line_with_marker(&task, today, file_project.as_deref(), &project_names, crate::taskformat::TaskFormat::Annado, &self.current_task_marker()));
            if apply {
                self.write_inline_recurring_task(&task, next)?;
            }
        }

        // 2. Rewrite legacy `@recurring(<id>)` instances across the vault.
        let template_ids: std::collections::HashSet<String> =
            templates.iter().map(|t| t.template_id.clone()).collect();
        let (deorphaned, removed) = self.rewrite_legacy_recurring_instances(&template_ids, apply)?;
        report.instances_deorphaned = deorphaned;
        report.instances_removed = removed;

        // 3. Delete the template files.
        if apply {
            for template in &templates {
                let _ = fs::remove_file(&template.file_path);
            }
            self.scan(); // refresh cache after the migration's writes
        }

        Ok(report)
    }

    fn project_names_set(&self) -> std::collections::HashSet<String> {
        self.get_all_projects().into_iter().map(|p| p.name).collect()
    }

    /// The next occurrence date for a template: roll forward from its last activity
    /// (else its start date, else today) to the first occurrence that is today or later,
    /// so migrated tasks don't land in the past.
    fn template_next_date(
        &self,
        template: &RecurringTemplate,
        rec: &crate::recurrence::Recurrence,
        today: NaiveDate,
    ) -> NaiveDate {
        let parse = |s: &Option<String>| {
            s.as_ref()
                .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        };
        let mut date = if let Some(last) =
            parse(&template.last_completed).or_else(|| parse(&template.last_generated))
        {
            crate::recurrence::next_date(rec, last).unwrap_or(today)
        } else if let Some(start) = parse(&template.start_date) {
            start
        } else {
            today
        };
        // Advance to the next occurrence that is today or later (modeled rules only).
        let mut guard = 0;
        while date < today && guard < 1000 {
            match crate::recurrence::next_date(rec, date) {
                Some(d) if d > date => date = d,
                _ => break,
            }
            guard += 1;
        }
        date
    }

    /// Append a migrated inline recurring task into the daily note for `date`.
    fn write_inline_recurring_task(&self, task: &Task, date: NaiveDate) -> Result<(), String> {
        let file_path = self.get_daily_note_path(date);
        self.ensure_daily_note_exists(&file_path, date)?;
        let content = fs::read_to_string(&file_path).unwrap_or_default();
        let today = Local::now().date_naive();
        let file_project = derive_project_name(&file_path.to_string_lossy());
        let project_names = self.project_names_set();
        let task_line = parser::format_task_line_with_marker(task, today, file_project.as_deref(), &project_names, crate::taskformat::TaskFormat::Annado, &self.current_task_marker());
        let new_content = if content.ends_with('\n') || content.is_empty() {
            format!("{}{}\n", content, task_line)
        } else {
            format!("{}\n{}\n", content, task_line)
        };
        fs::write(&file_path, new_content).map_err(|e| format!("Failed to write daily note: {}", e))
    }

    /// Walk every task file; for each line carrying `@recurring(<known-id>)`:
    /// completed -> strip the marker (keep the line); uncompleted -> drop the line.
    /// Returns (deorphaned, removed). Only writes when `apply`.
    fn rewrite_legacy_recurring_instances(
        &self,
        template_ids: &std::collections::HashSet<String>,
        apply: bool,
    ) -> Result<(usize, usize), String> {
        let mut deorphaned = 0usize;
        let mut removed = 0usize;

        for entry in WalkDir::new(&self.path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "md") {
                if is_hidden_path(path) {
                    continue;
                }
                let path_str = path.to_string_lossy();
                let content = match fs::read_to_string(path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                if Self::is_recurring_template(&content) {
                    continue; // template files are deleted separately
                }

                let mut changed = false;
                let mut out: Vec<String> = Vec::new();
                for line in content.lines() {
                    let (id, _) = parser::extract_recurring_id(line);
                    let is_known = id.as_ref().map_or(false, |i| template_ids.contains(i));
                    if !is_known {
                        out.push(line.to_string());
                        continue;
                    }
                    let id = id.unwrap();
                    let completed = parser::parse_task_line(line).map_or(false, |p| p.completed);
                    if completed {
                        // Keep the historical line, strip the now-dead marker.
                        let stripped = line
                            .replace(&format!(" @recurring({})", id), "")
                            .replace(&format!("@recurring({})", id), "")
                            .trim_end()
                            .to_string();
                        out.push(stripped);
                        deorphaned += 1;
                        changed = true;
                    } else {
                        // Drop the uncompleted instance (collapsed into the new inline task).
                        removed += 1;
                        changed = true;
                    }
                }

                if changed && apply {
                    let mut new_content = out.join("\n");
                    if content.ends_with('\n') {
                        new_content.push('\n');
                    }
                    fs::write(path, new_content)
                        .map_err(|e| format!("Failed to rewrite {}: {}", path_str, e))?;
                }
            }
        }

        Ok((deorphaned, removed))
    }

    /// Copy the whole vault to a timestamped sibling dir. Coarse but fine for a one-time op.
    fn backup_vault(&self) -> Result<String, String> {
        let stamp = Local::now().format("%Y%m%d-%H%M%S");
        let dest = self
            .path
            .parent()
            .ok_or("Vault has no parent directory")?
            .join(format!(
                "{}-backup-{}",
                self.path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("vault"),
                stamp
            ));
        for entry in WalkDir::new(&self.path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let src = entry.path();
            let rel = src.strip_prefix(&self.path).map_err(|e| e.to_string())?;
            let target = dest.join(rel);
            let ft = entry.file_type();
            if ft.is_dir() {
                fs::create_dir_all(&target).map_err(|e| e.to_string())?;
            } else if ft.is_file() {
                if let Some(parent) = target.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                fs::copy(src, &target).map_err(|e| e.to_string())?;
            }
            // Skip symlinks and other non-regular entries: a vault's .obsidian can
            // contain symlinks (plugins), fs::copy can't handle them, and the migration
            // doesn't follow symlinks either (follow_links(false)), so nothing inside
            // them is modified — consistent to leave them out of the backup.
        }
        Ok(dest.to_string_lossy().to_string())
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
    /// Delete a task by removing its line from the markdown file.
    ///
    /// Returns a [`DeletedTaskSnapshot`] capturing the removed markdown block and
    /// its original 1-based line number, so the delete can be faithfully reversed
    /// via [`Vault::restore_task`].
    pub fn delete_task(&self, task_id: &str) -> Result<crate::commands::DeletedTaskSnapshot, String> {
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

        // Capture the exact block being removed so the delete can be reversed
        // byte-for-byte by re-inserting it at the same index.
        let raw_block = lines[line_index..end_of_content].join("\n");

        // Create new content without the task and its associated content
        let mut new_lines: Vec<&str> = Vec::new();
        for (i, line) in lines.iter().enumerate() {
            if i < line_index || i >= end_of_content {
                new_lines.push(line);
            }
        }

        // Write back to file, preserving the original trailing-newline state so a
        // subsequent restore_task can reproduce the file byte-for-byte.
        let mut new_content = new_lines.join("\n");
        if content.ends_with('\n') {
            new_content.push('\n');
        }
        fs::write(&task.file_path, new_content)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        // Remove from cache
        {
            let mut task_map = self.tasks.write();
            task_map.remove(task_id);
        }

        Ok(crate::commands::DeletedTaskSnapshot {
            file_path: task.file_path.clone(),
            line_number: line_index + 1,
            raw_block,
        })
    }

    /// Re-insert a previously deleted task block at its original file position,
    /// re-parse it, refresh the in-memory cache for that file, and return the
    /// restored [`Task`].
    ///
    /// Re-inserting at the original 0-based index `line_number - 1` restores the
    /// original line numbers, so the restored task (and any tasks below it)
    /// recover their original ids (ids derive from `file_path:line_number`).
    pub fn restore_task(
        &self,
        snapshot: &crate::commands::DeletedTaskSnapshot,
    ) -> Result<Task, String> {
        let today = Local::now().date_naive();

        // Validate file path is within vault
        self.validate_path_in_vault(&snapshot.file_path)?;

        // Read the (post-delete) file
        let content = fs::read_to_string(&snapshot.file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        // Whether the file's content ended with a trailing newline, so we can
        // reconstruct it faithfully after splitting on '\n'.
        let had_trailing_newline = content.ends_with('\n');
        let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();

        // The block was captured via `join("\n")`, so split it back the same way.
        let block_lines: Vec<String> =
            snapshot.raw_block.split('\n').map(|l| l.to_string()).collect();

        // Insert at the original 0-based index; clamp to len (append) if the file
        // shrank below the original position.
        let insert_at = (snapshot.line_number - 1).min(lines.len());
        for (offset, line) in block_lines.into_iter().enumerate() {
            lines.insert(insert_at + offset, line);
        }

        // Rebuild content, preserving the original trailing-newline state.
        let mut new_content = lines.join("\n");
        if had_trailing_newline {
            new_content.push('\n');
        }

        fs::write(&snapshot.file_path, &new_content)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        // Re-parse the file and enrich exactly as scan() does, so the restored
        // task carries projects/persons/areas and a deterministic id.
        let persons = self.get_all_persons();
        let person_names: std::collections::HashSet<String> =
            persons.iter().map(|p| p.name.clone()).collect();
        let projects = self.get_all_projects();
        let project_names: std::collections::HashSet<String> =
            projects.iter().map(|p| p.name.clone()).collect();

        let mut tasks = parser::parse_file(&new_content, &snapshot.file_path, today);
        apply_areas_project(&mut tasks, &self.folder_paths.areas_pattern);
        resolve_wikilinks(&mut tasks, &person_names, &project_names);

        // Refresh the cache for this file (mirror the watcher's diff-into-cache).
        {
            let mut task_map = self.tasks.write();
            task_map.retain(|_, t| t.file_path != snapshot.file_path);
            for task in &tasks {
                task_map.insert(task.id.clone(), task.clone());
            }
        }

        // The restored task is the one parsed at the re-insertion line.
        let restored_line = snapshot.line_number;
        tasks
            .into_iter()
            .find(|t| t.line_number == restored_line)
            .ok_or_else(|| "Restored task not found after re-parse".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Minimal Task with only the title set; everything else default-ish.
    fn task_with_title(title: &str) -> Task {
        Task {
            id: "t".to_string(),
            title: title.to_string(),
            notes: String::new(),
            when: WhenValue::Inbox,
            deadline: None,
            tags: Vec::new(),
            inherited_tags: Vec::new(),
            checklist: Vec::new(),
            completed: false,
            completed_date: None,
            created_date: None,
            file_path: "x.md".to_string(),
            line_number: 1,
            projects: Vec::new(),
            indent_level: 0,
            priority: None,
            persons: Vec::new(),
            recurrence: None,
            duration_minutes: None,
            scheduled_time: None,
        }
    }

    #[test]
    fn resolve_wikilinks_assigns_known_project_and_preserves_unknown() {
        let project_names: std::collections::HashSet<String> =
            ["Privacy Seminar Company X".to_string()].into_iter().collect();
        let person_names: std::collections::HashSet<String> = std::collections::HashSet::new();

        // Known project → assigned, link preserved in the title.
        let mut known = task_with_title("Presentatie maken [[Privacy Seminar Company X]]");
        resolve_wikilinks(std::slice::from_mut(&mut known), &person_names, &project_names);
        assert_eq!(known.projects, vec!["Privacy Seminar Company X".to_string()]);
        assert!(known.title.contains("[[Privacy Seminar Company X]]"));

        // Unknown project → not assigned, link left untouched (renders as grey "create" chip).
        let mut unknown = task_with_title("Presentatie maken [[Nonexistent Project]]");
        resolve_wikilinks(std::slice::from_mut(&mut unknown), &person_names, &project_names);
        assert!(unknown.projects.is_empty());
        assert!(unknown.title.contains("[[Nonexistent Project]]"));
    }

    #[test]
    fn is_recurring_template_requires_the_full_trio() {
        // The real legacy template: all three keys present → detected.
        let template = "---\nrecurrence_type: fixed\ninterval: 1\ninterval_unit: months\ntemplate_id: abc123\n---\n- [ ] Water plants !(2)";
        assert!(Vault::is_recurring_template(template));

        // Only template_id (e.g. a stray field in an unrelated note) → NOT a template.
        assert!(!Vault::is_recurring_template("---\ntemplate_id: abc123\n---\nSome note"));
        // Missing interval_unit → not enough signature.
        assert!(!Vault::is_recurring_template("---\ntemplate_id: abc\nrecurrence_type: fixed\n---\nx"));
        // Missing template_id → not a template.
        assert!(!Vault::is_recurring_template("---\nrecurrence_type: fixed\ninterval_unit: days\n---\nx"));
        // No frontmatter at all → false.
        assert!(!Vault::is_recurring_template("- [ ] just a task #task"));
    }

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

    #[test]
    fn build_inline_recurring_task_maps_template_fields() {
        let template = RecurringTemplate {
            template_id: "abc".to_string(),
            title: "Water plants".to_string(),
            notes: "with rain water".to_string(),
            recurrence_type: RecurrenceType::Fixed,
            interval: 2,
            interval_unit: IntervalUnit::Weeks,
            start_date: Some("2026-06-16".to_string()),
            last_generated: None,
            last_completed: None,
            file_path: "x.md".to_string(),
            projects: vec!["Garden".to_string()],
            priority: Some(2),
            tags: vec!["home".to_string()],
        };
        let rec = crate::recurrence::Recurrence {
            interval: 2,
            unit: IntervalUnit::Weeks,
            mode: crate::recurrence::RecurrenceMode::Fixed,
            raw: None,
        };
        let next = NaiveDate::from_ymd_opt(2026, 6, 30).unwrap();
        let task = build_inline_recurring_task(&template, rec.clone(), next);

        assert_eq!(task.title, "Water plants");
        assert_eq!(task.notes, "with rain water");
        assert_eq!(task.when, WhenValue::Date("2026-06-30".to_string()));
        assert_eq!(task.recurrence, Some(rec));
        assert_eq!(task.projects, vec!["Garden".to_string()]);
        assert_eq!(task.priority, Some(2));
        assert_eq!(task.tags, vec!["home".to_string()]);
        assert!(!task.completed);

        let line =
            parser::format_task_line(&task, next, None, &std::collections::HashSet::new(), crate::taskformat::TaskFormat::Annado);
        assert!(line.contains("@repeat(every 2 weeks)"), "line: {line}");
    }

    /// Create a unique temporary vault directory on disk and return a Vault over it.
    /// (No tempfile crate dependency: we build a uniquely-named dir under the
    /// OS temp dir ourselves and clean it up in the test.)
    fn make_temp_vault() -> (PathBuf, Vault) {
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::time::{SystemTime, UNIX_EPOCH};
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!("annado_vault_test_{}_{}", nanos, n));
        fs::create_dir_all(&dir).expect("create temp vault dir");
        let vault = Vault::new_with_folder_paths(dir.clone(), FolderPaths::default(), false);
        (dir, vault)
    }

    #[test]
    fn test_delete_then_restore_is_byte_identical_and_keeps_id() {
        let (dir, vault) = make_temp_vault();

        // A task with notes + a checklist item, surrounded by other content so
        // the re-insertion index matters.
        let note_path = dir.join("Tasks.md");
        // No symbolic dates (@when(today)/@when(tomorrow)) so scan()'s
        // normalization leaves the file untouched and byte-identity is exact.
        let original = "\
# Tasks

- [ ] First task
- [ ] Buy groceries @when(2026-01-15) #errand
    Some notes about the groceries.
    - [ ] Milk
    - [ ] Eggs
- [ ] Third task
";
        fs::write(&note_path, original).expect("write note");

        // Populate the cache and capture the task's real (positional) id.
        let tasks = vault.scan();
        let target = tasks
            .iter()
            .find(|t| t.title.contains("Buy groceries"))
            .expect("target task present after scan");
        let original_id = target.id.clone();
        assert!(!target.checklist.is_empty(), "task should have a checklist");

        // Read the on-disk content as the pre-delete baseline for byte-identity.
        let before_delete = fs::read_to_string(&note_path).expect("read before delete");
        assert_eq!(
            before_delete, original,
            "scan() must not mutate a file without symbolic dates"
        );

        // Delete -> snapshot, then restore from the snapshot.
        let snapshot = vault.delete_task(&original_id).expect("delete_task");
        let after_delete = fs::read_to_string(&note_path).expect("read after delete");
        assert_ne!(
            before_delete, after_delete,
            "delete should change file content"
        );

        let restored = vault.restore_task(&snapshot).expect("restore_task");

        // (a) File content is byte-identical to before the delete.
        let after_restore = fs::read_to_string(&note_path).expect("read after restore");
        assert_eq!(
            before_delete, after_restore,
            "restore must reproduce the file byte-for-byte"
        );

        // (b) The restored task recovers its original id.
        assert_eq!(
            restored.id, original_id,
            "restored task must recover its original id"
        );

        // Cleanup.
        let _ = fs::remove_dir_all(&dir);
    }

    /// Minimal Task carrying only the fields `sort_tasks` keys on.
    fn task_at(file_path: &str, line_number: usize) -> Task {
        Task {
            id: Task::generate_id(file_path, line_number),
            title: String::new(),
            notes: String::new(),
            when: WhenValue::Inbox,
            deadline: None,
            tags: Vec::new(),
            inherited_tags: Vec::new(),
            checklist: Vec::new(),
            completed: false,
            completed_date: None,
            created_date: None,
            file_path: file_path.to_string(),
            line_number,
            projects: Vec::new(),
            indent_level: 0,
            priority: None,
            persons: Vec::new(),
            recurrence: None,
            duration_minutes: None,
            scheduled_time: None,
        }
    }

    fn order(tasks: &[Task]) -> Vec<(String, usize)> {
        tasks
            .iter()
            .map(|t| (t.file_path.clone(), t.line_number))
            .collect()
    }

    #[test]
    fn test_sort_tasks_document_order() {
        // Scrambled input across files and lines.
        let mut tasks = vec![
            task_at("Work/notes.md", 5),
            task_at("Daily/2026-06-25.md", 7),
            task_at("Projects/Roof.md", 14),
            task_at("Daily/2026-06-25.md", 3),
            task_at("Projects/Roof.md", 12),
        ];
        sort_tasks(&mut tasks);
        assert_eq!(
            order(&tasks),
            vec![
                ("Daily/2026-06-25.md".to_string(), 3),
                ("Daily/2026-06-25.md".to_string(), 7),
                ("Projects/Roof.md".to_string(), 12),
                ("Projects/Roof.md".to_string(), 14),
                ("Work/notes.md".to_string(), 5),
            ]
        );
    }

    #[test]
    fn test_sort_tasks_stable_across_delete() {
        // Deleting a middle task must not reorder the survivors.
        let mut tasks = vec![
            task_at("a.md", 1),
            task_at("a.md", 2),
            task_at("a.md", 3),
            task_at("b.md", 1),
        ];
        sort_tasks(&mut tasks);

        // Remove the second task, then re-sort (mirrors a re-scan after delete).
        tasks.retain(|t| !(t.file_path == "a.md" && t.line_number == 2));
        sort_tasks(&mut tasks);

        // Survivors keep their relative order — no reshuffle.
        assert_eq!(
            order(&tasks),
            vec![
                ("a.md".to_string(), 1),
                ("a.md".to_string(), 3),
                ("b.md".to_string(), 1),
            ]
        );
    }

    #[test]
    fn test_frontmatter_tags_list_and_string_forms() {
        let list = "---\ntags:\n  - werk\n  - '#project/alpha'\n---\n- [ ] x\n";
        assert_eq!(Vault::frontmatter_tags(list), vec!["werk".to_string(), "project/alpha".to_string()]);

        let csv = "---\ntags: werk, thuis\n---\n- [ ] x\n";
        assert_eq!(Vault::frontmatter_tags(csv), vec!["werk".to_string(), "thuis".to_string()]);

        assert!(Vault::frontmatter_tags("- [ ] geen frontmatter\n").is_empty());
    }

    #[test]
    fn test_annado_inherit_tags_override() {
        assert_eq!(Vault::annado_inherit_tags_override("---\nannado_inherit_tags: true\n---\nx"), Some(true));
        assert_eq!(Vault::annado_inherit_tags_override("---\nannado_inherit_tags: false\n---\nx"), Some(false));
        assert_eq!(Vault::annado_inherit_tags_override("---\ntags: [a]\n---\nx"), None);
    }

    #[test]
    fn test_scan_injects_inherited_tags_with_override_matrix() {
        let (dir, vault) = make_temp_vault();
        vault.set_inherit_tags(true);

        // Note with frontmatter tags; one task already carries an overlapping own tag.
        fs::write(dir.join("Meeting.md"),
            "---\ntags: [projectx, werk]\n---\n- [ ] alpha\n- [ ] beta #werk\n").unwrap();
        // Note that opts out despite the global setting.
        fs::write(dir.join("OptOut.md"),
            "---\ntags: [uit]\nannado_inherit_tags: false\n---\n- [ ] gamma\n").unwrap();

        let tasks = vault.scan();
        let alpha = tasks.iter().find(|t| t.title == "alpha").unwrap();
        assert_eq!(alpha.inherited_tags, vec!["projectx".to_string(), "werk".to_string()]);
        let beta = tasks.iter().find(|t| t.title == "beta").unwrap();
        // Own tag wins: the inherited duplicate is dropped (case-insensitive).
        assert_eq!(beta.inherited_tags, vec!["projectx".to_string()]);
        let gamma = tasks.iter().find(|t| t.title == "gamma").unwrap();
        assert!(gamma.inherited_tags.is_empty(), "per-note opt-out must win over the global setting");

        // The task line itself is never touched by inheritance.
        let content = fs::read_to_string(dir.join("Meeting.md")).unwrap();
        assert!(content.contains("- [ ] alpha\n"), "line must stay unchanged: {content}");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_scan_backfills_created_for_files_changed_since_last_scan() {
        let (dir, mut vault) = make_temp_vault();
        let state = dir.join("scan-state.json");
        // Simulate a previous run long ago, so the file below counts as "new".
        // vault_path must match this vault's path, or the state is ignored (see
        // test_scan_ignores_stale_state_from_a_different_vault below).
        let payload = serde_json::json!({
            "last_scan_unix": 1,
            "vault_path": dir.to_string_lossy(),
        });
        fs::write(&state, payload.to_string()).unwrap();
        vault.set_state_path(state.clone());

        let note = dir.join("Inbox.md");
        fs::write(&note, "- [ ] Task added by a script\n").unwrap();

        let tasks = vault.scan();
        let today = Local::now().date_naive().format("%Y-%m-%d").to_string();

        let t = tasks.iter().find(|t| t.title.contains("script")).unwrap();
        assert_eq!(t.created_date, Some(today.clone()), "in-memory task must be stamped");
        let content = fs::read_to_string(&note).unwrap();
        assert!(content.contains(&today), "marker must be written to the file: {content}");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_scan_injects_when_note_opts_in_despite_global_off() {
        let (dir, vault) = make_temp_vault();
        // global default = off
        fs::write(dir.join("OptIn.md"),
            "---\ntags: [aan]\nannado_inherit_tags: true\n---\n- [ ] delta\n").unwrap();
        let tasks = vault.scan();
        let delta = tasks.iter().find(|t| t.title == "delta").unwrap();
        assert_eq!(delta.inherited_tags, vec!["aan".to_string()]);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_pending_created_drops_ids_stamped_or_gone_elsewhere() {
        use std::time::Instant;

        // Cache state: one task still unstamped, one already stamped (e.g. by a
        // scan() back-fill that ran inside the watcher's 2 s stability window).
        let unstamped = task_at("a.md", 1);
        let mut stamped = task_at("a.md", 2);
        stamped.created_date = Some("2026-07-04".to_string());

        let mut cache: HashMap<String, Task> = HashMap::new();
        cache.insert(unstamped.id.clone(), unstamped.clone());
        cache.insert(stamped.id.clone(), stamped.clone());

        let now = Instant::now();
        let mut pending: HashMap<String, Instant> = HashMap::new();
        pending.insert(unstamped.id.clone(), now);
        pending.insert(stamped.id.clone(), now);
        pending.insert("gone".to_string(), now); // task deleted from the cache

        retain_unstamped_pending(&mut pending, &cache);

        assert!(
            pending.contains_key(&unstamped.id),
            "unstamped task must stay queued for the flush"
        );
        assert!(
            !pending.contains_key(&stamped.id),
            "already-stamped task must be dropped so the flush can't double-stamp"
        );
        assert!(
            !pending.contains_key("gone"),
            "tasks no longer in the cache must be dropped"
        );
    }

    #[test]
    fn test_first_scan_stamps_nothing_but_saves_timestamp() {
        let (dir, mut vault) = make_temp_vault();
        let state = dir.join("scan-state.json");
        vault.set_state_path(state.clone()); // file does not exist yet = first run

        let note = dir.join("Old.md");
        fs::write(&note, "- [ ] Historic unstamped task\n").unwrap();

        let tasks = vault.scan();
        let t = tasks.iter().find(|t| t.title.contains("Historic")).unwrap();
        assert_eq!(t.created_date, None, "first run must never mass-stamp");
        assert!(fs::read_to_string(&note).unwrap().trim() == "- [ ] Historic unstamped task");
        assert!(state.exists(), "first run must establish the baseline timestamp");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_scan_ignores_stale_state_from_a_different_vault() {
        // A single global scan-state.json is shared across vaults. If it was last
        // written by a DIFFERENT vault (e.g. a fresh clone whose files all have a
        // checkout-time mtime), reusing its stale timestamp here would treat every
        // historic unstamped task in THIS vault as "changed since last scan" and
        // mass-stamp it — exactly what the first-run guard exists to prevent.
        let (dir, mut vault) = make_temp_vault();
        let state = dir.join("scan-state.json");
        let other_vault_path = dir.join("some-other-vault");
        let payload = serde_json::json!({
            "last_scan_unix": 1,
            "vault_path": other_vault_path.to_string_lossy(),
        });
        fs::write(&state, payload.to_string()).unwrap();
        vault.set_state_path(state.clone());

        let note = dir.join("Old.md");
        fs::write(&note, "- [ ] Historic unstamped task\n").unwrap();

        let tasks = vault.scan();
        let t = tasks.iter().find(|t| t.title.contains("Historic")).unwrap();
        assert_eq!(
            t.created_date, None,
            "stale state from a different vault must not backfill this vault's historic tasks"
        );

        let content = fs::read_to_string(&state).unwrap();
        let v: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(
            v.get("vault_path").and_then(|p| p.as_str()),
            Some(dir.to_string_lossy().as_ref()),
            "state file must be re-keyed to this vault after the scan"
        );

        let _ = fs::remove_dir_all(&dir);
    }
}
