use crate::taskformat::{self, TaskFormat};
use chrono::NaiveDate;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::LazyLock;

static TASK_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(\s*)- \[([ xX])\] (.+)$").unwrap()
});

static WHEN_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"@when\(([^)]+)\)").unwrap()
});

static DUE_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"@due\(([^)]+)\)").unwrap()
});

static TAG_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    // Allow nested tags (Obsidian-style): a leading word char, then word chars,
    // forward slashes, or hyphens, e.g. #inbox/to-read. Obsidian permits '-' in tag
    // names; a trailing slash is trimmed in extract_tags.
    Regex::new(r"#(\w[\w/-]*)").unwrap()
});

static PROJECT_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"@project\(([^)]+)\)").unwrap()
});

static PRIORITY_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"!\(([1-3])\)").unwrap()
});

static WIKILINK_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[\[([^\]]+)\]\]").unwrap()
});

static RECURRING_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"@recurring\(([^)]+)\)").unwrap()
});

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum WhenValue {
    Inbox,
    Today,
    Evening,
    Tomorrow,
    Anytime,
    Someday,
    Date(String), // ISO date string YYYY-MM-DD
}

impl WhenValue {
    pub fn from_str(s: &str, today: NaiveDate) -> Self {
        match s.to_lowercase().as_str() {
            "inbox" => WhenValue::Inbox,
            "today" => {
                // Convert "today" to actual date so it doesn't stay "today" forever
                WhenValue::Date(today.format("%Y-%m-%d").to_string())
            }
            "evening" => WhenValue::Evening,
            "tomorrow" => {
                // Convert "tomorrow" to actual date so it becomes "today" when the date arrives
                let tomorrow = today.succ_opt().unwrap_or(today);
                WhenValue::Date(tomorrow.format("%Y-%m-%d").to_string())
            }
            "anytime" => WhenValue::Anytime,
            "someday" => WhenValue::Someday,
            date_str => {
                // Try to parse as date
                if let Ok(_date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                    // Always keep as Date - don't convert to Today
                    // This ensures the date is preserved in the markdown file
                    WhenValue::Date(date_str.to_string())
                } else {
                    WhenValue::Inbox
                }
            }
        }
    }

    /// Convert Today and Tomorrow to actual dates for persistence.
    /// This ensures tasks scheduled for "today" or "tomorrow" get a fixed date
    /// so they properly persist in the markdown file.
    pub fn normalize(self, today: NaiveDate) -> Self {
        match self {
            WhenValue::Today => {
                // Convert "Today" to actual date for persistence
                WhenValue::Date(today.format("%Y-%m-%d").to_string())
            }
            WhenValue::Tomorrow => {
                let tomorrow = today.succ_opt().unwrap_or(today);
                WhenValue::Date(tomorrow.format("%Y-%m-%d").to_string())
            }
            other => other,
        }
    }

    pub fn to_string_value(&self, _today: NaiveDate) -> String {
        match self {
            WhenValue::Inbox => String::new(), // No @when for inbox
            WhenValue::Today => "today".to_string(),
            WhenValue::Evening => "evening".to_string(),
            WhenValue::Tomorrow => "tomorrow".to_string(), // Legacy, shouldn't be used anymore
            WhenValue::Anytime => "anytime".to_string(),
            WhenValue::Someday => "someday".to_string(),
            WhenValue::Date(d) => d.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistItem {
    pub title: String,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RecurrenceType {
    Fixed,
    AfterCompletion,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum IntervalUnit {
    Days,
    Weeks,
    Months,
    Years,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringTemplate {
    pub template_id: String,
    pub title: String,
    pub notes: String,
    pub recurrence_type: RecurrenceType,
    pub interval: u32,
    pub interval_unit: IntervalUnit,
    pub start_date: Option<String>,
    pub last_generated: Option<String>,
    pub last_completed: Option<String>,
    pub file_path: String,
    pub projects: Vec<String>,
    pub priority: Option<u8>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub notes: String,
    pub when: WhenValue,
    pub deadline: Option<String>, // ISO date string
    pub tags: Vec<String>,
    // Tags inherited from the note's YAML frontmatter. Display/filter only —
    // never written back to the task line (unlike `tags`).
    #[serde(default)]
    pub inherited_tags: Vec<String>,
    pub checklist: Vec<ChecklistItem>,
    pub completed: bool,
    pub completed_date: Option<String>,
    pub created_date: Option<String>,
    pub file_path: String,
    pub line_number: usize,
    pub projects: Vec<String>,
    pub indent_level: usize,
    pub priority: Option<u8>, // 1 = high, 2 = medium, 3 = low
    pub persons: Vec<String>, // Persons associated via [[Person Name]] wiki-links
    pub recurrence: Option<crate::recurrence::Recurrence>, // Inline recurrence rule from @repeat()
    pub duration_minutes: Option<u32>, // Estimated duration in minutes from @duration()
    pub scheduled_time: Option<String>, // "HH:MM" from @time()
}

impl Task {
    pub fn generate_id(file_path: &str, line_number: usize) -> String {
        let mut hasher = Sha256::new();
        hasher.update(format!("{}:{}", file_path, line_number));
        let result = hasher.finalize();
        hex::encode(&result[..8]) // Use first 8 bytes for shorter ID
    }
}

#[derive(Debug)]
pub struct ParsedLine {
    pub indent: usize,
    pub completed: bool,
    pub content: String,
}

pub fn parse_task_line(line: &str) -> Option<ParsedLine> {
    TASK_REGEX.captures(line).map(|caps| {
        let indent = caps.get(1).map_or(0, |m| m.as_str().len());
        let checkbox = caps.get(2).map_or(" ", |m| m.as_str());
        let content = caps.get(3).map_or("", |m| m.as_str()).to_string();

        ParsedLine {
            indent,
            completed: checkbox.to_lowercase() == "x",
            content,
        }
    })
}

pub fn extract_when(content: &str, today: NaiveDate) -> (WhenValue, String) {
    if let Some(caps) = WHEN_REGEX.captures(content) {
        let when_str = caps.get(1).map_or("", |m| m.as_str());
        let when = WhenValue::from_str(when_str, today);
        let cleaned = WHEN_REGEX.replace(content, "").to_string();
        (when, cleaned.trim().to_string())
    } else {
        (WhenValue::Inbox, content.to_string())
    }
}

pub fn extract_due(content: &str) -> (Option<String>, String) {
    if let Some(caps) = DUE_REGEX.captures(content) {
        let due_str = caps.get(1).map_or("", |m| m.as_str());
        let cleaned = DUE_REGEX.replace(content, "").to_string();
        (Some(due_str.to_string()), cleaned.trim().to_string())
    } else {
        (None, content.to_string())
    }
}

pub fn extract_tags(content: &str) -> (Vec<String>, String) {
    let tags: Vec<String> = TAG_REGEX
        .captures_iter(content)
        // Trim a trailing slash (Obsidian disallows #inbox/) and drop anything empty.
        .filter_map(|cap| cap.get(1).map(|m| m.as_str().trim_end_matches('/').to_string()))
        .filter(|t| !t.is_empty())
        .collect();

    let cleaned = TAG_REGEX.replace_all(content, "").to_string();
    (tags, cleaned.trim().to_string())
}

pub fn extract_project(content: &str) -> (Option<String>, String) {
    // Parse @project() syntax for backward compatibility
    if let Some(caps) = PROJECT_REGEX.captures(content) {
        let project = caps.get(1).map(|m| m.as_str().to_string());
        let cleaned = PROJECT_REGEX.replace(content, "").to_string();
        (project, cleaned.trim().to_string())
    } else {
        (None, content.to_string())
    }
}

pub fn extract_priority(content: &str) -> (Option<u8>, String) {
    if let Some(caps) = PRIORITY_REGEX.captures(content) {
        let priority_str = caps.get(1).map_or("", |m| m.as_str());
        let priority = priority_str.parse::<u8>().ok();
        let cleaned = PRIORITY_REGEX.replace(content, "").to_string();
        (priority, cleaned.trim().to_string())
    } else {
        (None, content.to_string())
    }
}

/// Extract all wiki-link names from content (e.g., [[Person Name]] -> "Person Name")
/// Returns the list of link names found
pub fn extract_wikilinks(content: &str) -> Vec<String> {
    WIKILINK_REGEX
        .captures_iter(content)
        .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
        .collect()
}

/// Extract recurring template ID from content (e.g., @recurring(abc123) -> "abc123")
pub fn extract_recurring_id(content: &str) -> (Option<String>, String) {
    if let Some(caps) = RECURRING_REGEX.captures(content) {
        let id = caps.get(1).map(|m| m.as_str().to_string());
        let cleaned = RECURRING_REGEX.replace(content, "").to_string();
        (id, cleaned.trim().to_string())
    } else {
        (None, content.to_string())
    }
}

/// Parse a duration string like "15m", "15min", "1h", "1h30m", "1h30min", "2h" into minutes
pub fn parse_duration_str(s: &str) -> Option<u32> {
    let s = s.trim().to_lowercase();
    // Try "XhYm" or "XhYmin" pattern
    if let Some(h_pos) = s.find('h') {
        let hours: u32 = s[..h_pos].parse().ok()?;
        let rest = &s[h_pos + 1..];
        if rest.is_empty() {
            return Some(hours * 60);
        }
        // Strip trailing "min" or "m"
        let rest = rest.trim_end_matches("min").trim_end_matches('m');
        if rest.is_empty() {
            return Some(hours * 60);
        }
        let minutes: u32 = rest.parse().ok()?;
        return Some(hours * 60 + minutes);
    }
    // Try "Xmin" or "Xm" pattern
    let s_stripped = s.trim_end_matches("min").trim_end_matches('m');
    if s_stripped != s {
        return s_stripped.parse::<u32>().ok();
    }
    None
}

/// Format duration in minutes back to a compact string for markdown
pub fn format_duration(minutes: u32) -> String {
    let h = minutes / 60;
    let m = minutes % 60;
    if h > 0 && m > 0 {
        format!("{}h{}m", h, m)
    } else if h > 0 {
        format!("{}h", h)
    } else {
        format!("{}m", m)
    }
}

/// Extract project names from wiki-links in content, filtering only valid projects
pub fn extract_projects_from_wikilinks(
    content: &str,
    project_names: &std::collections::HashSet<String>,
) -> Vec<String> {
    extract_wikilinks(content)
        .into_iter()
        .filter(|link| project_names.contains(link))
        .collect()
}

/// Marker-less convenience wrapper used by the test suite; the app calls
/// `parse_file_with_marker` (the import-marker is always threaded through there).
#[allow(dead_code)]
pub fn parse_file(content: &str, file_path: &str, today: NaiveDate) -> Vec<Task> {
    parse_file_with_marker(content, file_path, today, "")
}

/// Like `parse_file`, but when `marker` is non-empty only top-level checkboxes carrying
/// that tag are imported (the tag is stripped from the task's displayed tags).
pub fn parse_file_with_marker(
    content: &str,
    file_path: &str,
    today: NaiveDate,
    marker: &str,
) -> Vec<Task> {
    let lines: Vec<&str> = content.lines().collect();
    let mut tasks: Vec<Task> = Vec::new();
    let mut i = 0;

    // Derive project name from file path (e.g., Projects/MyProject.md -> MyProject)
    let project = derive_project_name(file_path);

    while i < lines.len() {
        let line = lines[i];

        if let Some(parsed) = parse_task_line(line) {
            // This is a top-level task (indent 0 or minimal indent)
            if parsed.indent < 4 {
                // Read any dialect (Annado / Obsidian Tasks / Dataview) via the format layer.
                let (when, content_after_when) = taskformat::decode_when(&parsed.content, today);
                let (deadline, content_after_due) = taskformat::decode_due(&content_after_when);
                let (explicit_project, content_after_project) = extract_project(&content_after_due);
                let (priority, content_after_priority) = taskformat::decode_priority(&content_after_project);
                // Strip any legacy @recurring(<id>) marker so it never leaks into the title.
                // (The marker is otherwise consumed only by the recurrence migration.)
                let (_legacy_recurring_id, content_after_recurring) = extract_recurring_id(&content_after_priority);
                let (recurrence, content_after_repeat) = taskformat::decode_recurrence(&content_after_recurring);
                let (completed_date, content_after_completed) = taskformat::decode_completed(&content_after_repeat);
                let (created_date, content_after_created) = taskformat::decode_created(&content_after_completed);
                let (duration_minutes, content_after_duration) = taskformat::decode_duration(&content_after_created);
                let (scheduled_time, content_after_time) = taskformat::decode_time(&content_after_duration);
                let (mut tags, title) = extract_tags(&content_after_time);

                let mut notes = String::new();
                let mut checklist: Vec<ChecklistItem> = Vec::new();

                // Look ahead for notes and checklist items
                let mut j = i + 1;
                while j < lines.len() {
                    let next_line = lines[j];

                    // Check if this is a subtask/checklist item
                    if let Some(sub_parsed) = parse_task_line(next_line) {
                        if sub_parsed.indent > parsed.indent {
                            checklist.push(ChecklistItem {
                                title: sub_parsed.content,
                                completed: sub_parsed.completed,
                            });
                            j += 1;
                            continue;
                        } else {
                            break; // Same or less indent, new task
                        }
                    }

                    // Check if this is indented content (notes)
                    let trimmed = next_line.trim_start();
                    let line_indent = next_line.len() - trimmed.len();

                    if line_indent > parsed.indent && !trimmed.is_empty() {
                        if !notes.is_empty() {
                            notes.push('\n');
                        }
                        notes.push_str(trimmed);
                        j += 1;
                    } else if trimmed.is_empty() {
                        // Empty line might be part of notes
                        j += 1;
                    } else {
                        break;
                    }
                }

                // Import marker filter: when configured, only import top-level checkboxes
                // carrying the marker tag; strip the marker from the displayed tags.
                // (Done after the look-ahead so a skipped parent's subtasks are skipped too.)
                if !marker.is_empty() {
                    if !tags_contain(&tags, marker) {
                        i = j;
                        continue;
                    }
                    tags.retain(|t| !t.eq_ignore_ascii_case(marker));
                }

                // Explicit @project() tag takes precedence over file-path derived project
                let task_projects: Vec<String> = explicit_project
                    .or_else(|| project.clone())
                    .into_iter()
                    .collect();

                let task = Task {
                    id: Task::generate_id(file_path, i + 1),
                    title: title.trim().to_string(),
                    notes: notes.trim().to_string(),
                    when,
                    deadline,
                    tags,
                    inherited_tags: Vec::new(),
                    checklist,
                    completed: parsed.completed,
                    completed_date,
                    created_date,
                    file_path: file_path.to_string(),
                    line_number: i + 1,
                    projects: task_projects,
                    indent_level: parsed.indent,
                    priority,
                    persons: Vec::new(), // Populated later in vault.rs after resolving wiki-links
                    recurrence,
                    duration_minutes,
                    scheduled_time,
                };

                tasks.push(task);
                i = j;
                continue;
            }
        }
        i += 1;
    }

    tasks
}

pub fn derive_project_name(file_path: &str) -> Option<String> {
    derive_project_name_with_pattern(file_path, "Projects")
}

pub fn derive_project_name_with_pattern(file_path: &str, projects_pattern: &str) -> Option<String> {
    // Check if the file is inside a Projects folder (e.g., "02. Projects", "Projects", etc.)
    // Use simple string splitting for reliability
    let parts: Vec<&str> = file_path.split('/').collect();

    // Find the Projects folder index
    let projects_idx = parts.iter().position(|part|
        part.contains(projects_pattern) && !part.ends_with(".md")
    )?;

    let components_after_projects = &parts[projects_idx + 1..];

    let last = *components_after_projects.last()?;

    // If last component is a .md file
    if last.ends_with(".md") {
        let stem = last.trim_end_matches(".md");

        // If it's the only component (directly in Projects), use the stem
        if components_after_projects.len() == 1 {
            return Some(stem.to_string());
        }

        // Get the parent folder (second-to-last component)
        let parent = components_after_projects[components_after_projects.len() - 2];

        // If parent folder name matches stem, it's a project folder with its main file
        // e.g., Projects/MyProject/MyProject.md -> "MyProject"
        if parent == stem {
            return Some(stem.to_string());
        }

        // Check if stem looks like a generic filename (not a project name)
        // Generic files like "tasks.md", "notes.md" should use the parent folder
        let generic_names = ["tasks", "notes", "todo", "index", "readme", "task", "note"];
        let stem_lower = stem.to_lowercase();
        if generic_names.contains(&stem_lower.as_str()) {
            // It's a generic file, use the parent folder as the project
            return Some(parent.to_string());
        }

        // Otherwise, the .md file IS the project (e.g., "Bastion 2026.md" -> "Bastion 2026")
        return Some(stem.to_string());
    }

    // Last component is a folder (shouldn't normally happen for file paths)
    Some(last.to_string())
}

/// Normalize a configured import marker: strip a leading `#`, trim whitespace.
pub fn normalize_marker(marker: &str) -> String {
    marker.trim().trim_start_matches('#').trim().to_string()
}

/// Case-insensitive check for whether `tags` carries the import `marker` — matching the
/// bare marker (`#task`) OR a nested tag under it (`#task/work`), so nested-tagged tasks
/// aren't silently skipped. Matches on the tag's first path segment.
pub fn tags_contain(tags: &[String], marker: &str) -> bool {
    tags.iter().any(|t| {
        let head = t.split('/').next().unwrap_or(t);
        head.eq_ignore_ascii_case(marker)
    })
}

/// Marker-less convenience wrapper used by the test suite; the app calls
/// `format_task_line_with_marker` (the import-marker is always threaded through there).
#[allow(dead_code)]
pub fn format_task_line(
    task: &Task,
    today: NaiveDate,
    file_project: Option<&str>,
    project_names: &std::collections::HashSet<String>,
    format: TaskFormat,
) -> String {
    format_task_line_with_marker(task, today, file_project, project_names, format, "")
}

/// Like `format_task_line`, but re-adds the configured import `marker` tag when set
/// (so a task whose marker was stripped on read keeps it on write).
pub fn format_task_line_with_marker(
    task: &Task,
    today: NaiveDate,
    file_project: Option<&str>,
    project_names: &std::collections::HashSet<String>,
    format: TaskFormat,
    marker: &str,
) -> String {
    let checkbox = if task.completed { "[x]" } else { "[ ]" };
    let indent = " ".repeat(task.indent_level);

    // Clean the title: remove project wiki-links that are no longer in task.projects
    let mut cleaned_title = task.title.clone();
    for cap in WIKILINK_REGEX.captures_iter(&task.title) {
        if let Some(link_match) = cap.get(1) {
            let link_name = link_match.as_str();
            // Only process wiki-links that are known project names
            if project_names.contains(link_name) {
                let full_wikilink = format!("[[{}]]", link_name);
                // Remove if not in task.projects (unless it's the file's implicit project)
                let is_current_project = task.projects.contains(&link_name.to_string());
                let is_file_project = file_project == Some(link_name);
                if !is_current_project && !is_file_project {
                    cleaned_title = cleaned_title.replace(&full_wikilink, "");
                }
            }
        }
    }
    // Clean up double spaces
    let cleaned_title = cleaned_title.split_whitespace().collect::<Vec<_>>().join(" ");

    let mut parts = vec![cleaned_title.clone()];

    // Write each field in the chosen format (Annado / Obsidian Tasks / Dataview).
    if let Some(s) = taskformat::encode_when(&task.when, format, today) {
        parts.push(s);
    }
    if let Some(s) = taskformat::encode_due(&task.deadline, format) {
        parts.push(s);
    }

    // Add [[Project]] wikilinks for each project different from the file's implicit project
    // AND not already in the title
    for project in &task.projects {
        let project_wikilink = format!("[[{}]]", project);
        // Only add explicit project wikilink if it differs from file path AND not already in cleaned title
        if file_project != Some(project.as_str()) && !cleaned_title.contains(&project_wikilink) {
            parts.push(project_wikilink);
        }
    }

    if let Some(s) = taskformat::encode_priority(task.priority, format) {
        parts.push(s);
    }
    if let Some(s) = taskformat::encode_time(&task.scheduled_time, format) {
        parts.push(s);
    }
    if let Some(s) = taskformat::encode_duration(task.duration_minutes, format) {
        parts.push(s);
    }

    // Add tags (identical across formats)
    for tag in &task.tags {
        parts.push(format!("#{}", tag));
    }
    // Re-add the import marker tag if configured and not already present.
    if !marker.is_empty() && !tags_contain(&task.tags, marker) {
        parts.push(format!("#{}", marker));
    }

    if let Some(ref rec) = task.recurrence {
        parts.push(taskformat::encode_recurrence(rec, format));
    }
    if let Some(s) = taskformat::encode_completed(&task.completed_date, format) {
        parts.push(s);
    }
    if let Some(s) = taskformat::encode_created(&task.created_date, format) {
        parts.push(s);
    }

    format!("{}- {} {}", indent, checkbox, parts.join(" "))
}

/// The next occurrence of a recurring task, given today's date (used for when_done mode).
/// Returns None for non-recurring tasks or raw (unmodeled) rules.
pub fn next_occurrence(task: &Task, today: NaiveDate) -> Option<Task> {
    let rec = task.recurrence.as_ref()?;
    let base = match rec.mode {
        crate::recurrence::RecurrenceMode::WhenDone => today,
        crate::recurrence::RecurrenceMode::Fixed => match &task.when {
            WhenValue::Date(d) => NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()?,
            _ => today,
        },
    };
    let next = crate::recurrence::next_date(rec, base)?;
    let mut t = task.clone();
    t.completed = false;
    t.completed_date = None;
    t.when = WhenValue::Date(next.format("%Y-%m-%d").to_string());
    // Advance the deadline too, if present, by the same rule.
    if let Some(dl) = &task.deadline {
        if let Ok(d) = NaiveDate::parse_from_str(dl, "%Y-%m-%d") {
            if let Some(nd) = crate::recurrence::next_date(rec, d) {
                t.deadline = Some(nd.format("%Y-%m-%d").to_string());
            }
        }
    }
    Some(t)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::recurrence::RecurrenceMode;

    #[test]
    fn test_parse_file_reads_obsidian_tasks_and_dataview() {
        let today = NaiveDate::from_ymd_opt(2026, 6, 17).unwrap();
        // Obsidian Tasks emoji line
        let t = parse_file("- [ ] Pay rent 📅 2026-07-01 ⏫ 🔁 every 2 weeks", "x.md", today);
        assert_eq!(t[0].title, "Pay rent");
        assert_eq!(t[0].deadline.as_deref(), Some("2026-07-01"));
        assert_eq!(t[0].priority, Some(1));
        assert_eq!(t[0].recurrence.as_ref().unwrap().interval, 2);
        // Dataview inline-field line
        let d = parse_file("- [ ] Review [due:: 2026-07-02] [priority:: low]", "x.md", today);
        assert_eq!(d[0].title, "Review");
        assert_eq!(d[0].deadline.as_deref(), Some("2026-07-02"));
        assert_eq!(d[0].priority, Some(3));
    }

    #[test]
    fn test_smart_filter_fields_identical_across_formats() {
        // The smart filter ("Smart Lists") is format-agnostic by design: it runs in
        // the frontend on the normalized Task struct and never sees raw markdown.
        // This guarantee only holds if every dialect decodes the same logical task
        // into identical values for the fields the filter reads (priority, deadline,
        // created_date, when). Authored once per format, the parsed result must match.
        let today = NaiveDate::from_ymd_opt(2026, 6, 17).unwrap();
        let lines = [
            "- [ ] Pay rent @when(2026-06-20) @due(2026-07-01) !(1) @created(2026-06-01)",
            "- [ ] Pay rent ⏳ 2026-06-20 📅 2026-07-01 ⏫ ➕ 2026-06-01",
            "- [ ] Pay rent [scheduled:: 2026-06-20] [due:: 2026-07-01] [priority:: high] [created:: 2026-06-01]",
        ];
        for line in lines {
            let t = &parse_file(line, "x.md", today)[0];
            assert_eq!(t.title, "Pay rent", "line: {line}");
            assert_eq!(t.when, WhenValue::Date("2026-06-20".to_string()), "line: {line}");
            assert_eq!(t.deadline.as_deref(), Some("2026-07-01"), "line: {line}");
            assert_eq!(t.priority, Some(1), "line: {line}");
            assert_eq!(t.created_date.as_deref(), Some("2026-06-01"), "line: {line}");
        }
    }

    #[test]
    fn test_format_task_line_round_trips_per_format() {
        use crate::taskformat::TaskFormat;
        let today = NaiveDate::from_ymd_opt(2026, 6, 17).unwrap();
        let names = std::collections::HashSet::new();
        let src = "- [ ] Pay rent @when(2026-06-20) @due(2026-07-01) !(1) @repeat(every 2 weeks)";
        let task = &parse_file(src, "x.md", today)[0];
        for fmt in [TaskFormat::Annado, TaskFormat::ObsidianTasks, TaskFormat::Dataview] {
            let line = format_task_line(task, today, None, &names, fmt);
            // Re-parse the formatted line; the structured values must survive.
            let back = &parse_file(&line, "x.md", today)[0];
            assert_eq!(back.title, "Pay rent", "fmt {:?} line {}", fmt, line);
            assert_eq!(back.deadline.as_deref(), Some("2026-07-01"), "fmt {:?}", fmt);
            assert_eq!(back.when, WhenValue::Date("2026-06-20".to_string()), "fmt {:?}", fmt);
            assert_eq!(back.priority, Some(1), "fmt {:?}", fmt);
            assert_eq!(back.recurrence.as_ref().unwrap().interval, 2, "fmt {:?}", fmt);
        }
    }

    #[test]
    fn test_import_marker_filters_and_strips() {
        let today = NaiveDate::from_ymd_opt(2026, 6, 17).unwrap();
        let content = "- [ ] A #task #home\n- [ ] B #home";
        // With marker "task": only A imports, and #task is stripped from its tags.
        let marked = parse_file_with_marker(content, "x.md", today, "task");
        assert_eq!(marked.len(), 1);
        assert_eq!(marked[0].title, "A");
        assert!(marked[0].tags.contains(&"home".to_string()));
        assert!(!marked[0].tags.iter().any(|t| t.eq_ignore_ascii_case("task")));
        // Blank marker imports both.
        assert_eq!(parse_file(content, "x.md", today).len(), 2);
    }

    #[test]
    fn test_import_marker_case_insensitive() {
        let today = NaiveDate::from_ymd_opt(2026, 6, 17).unwrap();
        let t = parse_file_with_marker("- [ ] A #Task", "x.md", today, "task");
        assert_eq!(t.len(), 1);
    }

    #[test]
    fn test_import_marker_matches_nested_tag() {
        let today = NaiveDate::from_ymd_opt(2026, 6, 17).unwrap();
        // A task tagged with a NESTED marker (#task/work) must still import, not be skipped.
        let t = parse_file_with_marker("- [ ] A #task/work", "x.md", today, "task");
        assert_eq!(t.len(), 1);
        // The nested tag is kept (only the bare #task marker is stripped from display).
        assert_eq!(t[0].tags, vec!["task/work".to_string()]);
        // A different parent must NOT match (e.g. #work/task is not the `task` marker).
        let skipped = parse_file_with_marker("- [ ] B #work/task", "x.md", today, "task");
        assert_eq!(skipped.len(), 0);
        // A tag that merely starts with the marker text but isn't a path segment must not match.
        let not_seg = parse_file_with_marker("- [ ] C #taskforce", "x.md", today, "task");
        assert_eq!(not_seg.len(), 0);
    }

    #[test]
    fn test_import_marker_round_trips_on_write() {
        use crate::taskformat::TaskFormat;
        let today = NaiveDate::from_ymd_opt(2026, 6, 17).unwrap();
        let names = std::collections::HashSet::new();
        let task = &parse_file_with_marker("- [ ] A #task #home", "x.md", today, "task")[0];
        // Marker was stripped from tags; the writer re-adds it (no duplication).
        let line = format_task_line_with_marker(task, today, None, &names, TaskFormat::Annado, "task");
        assert_eq!(line.matches("#task").count(), 1, "line: {line}");
        // Re-parse with the marker → still imported.
        assert_eq!(parse_file_with_marker(&line, "x.md", today, "task").len(), 1);
    }

    #[test]
    fn test_import_marker_skips_subtasks_of_unmarked_parent() {
        let today = NaiveDate::from_ymd_opt(2026, 6, 17).unwrap();
        // Unmarked parent with an (indented) subtask: neither should import.
        let content = "- [ ] Parent\n    - [ ] Child";
        assert_eq!(parse_file_with_marker(content, "x.md", today, "task").len(), 0);
    }

    #[test]
    fn test_roundtrip_repeat_rule() {
        let content = "- [ ] Water plants @when(2026-06-16) @repeat(every 2 weeks)";
        let today = NaiveDate::from_ymd_opt(2026, 6, 16).unwrap();
        let tasks = parse_file(content, "test.md", today);
        assert_eq!(tasks.len(), 1);
        let rec = tasks[0].recurrence.as_ref().expect("recurrence parsed");
        assert_eq!(rec.interval, 2);
        assert_eq!(rec.unit, IntervalUnit::Weeks);
        assert_eq!(rec.mode, RecurrenceMode::Fixed);
        let line = format_task_line(&tasks[0], today, None, &std::collections::HashSet::new(), TaskFormat::Annado);
        assert!(line.contains("@repeat(every 2 weeks)"), "line was: {line}");
    }

    #[test]
    fn test_next_occurrence_advances_scheduled_date_for_fixed() {
        let today = NaiveDate::from_ymd_opt(2026, 6, 16).unwrap();
        let tasks = parse_file(
            "- [ ] Pay rent @when(2026-06-16) @repeat(every 2 weeks)",
            "test.md",
            today,
        );
        let next = next_occurrence(&tasks[0], today).expect("next occurrence");
        assert_eq!(next.when, WhenValue::Date("2026-06-30".to_string()));
        assert!(!next.completed);
        assert_eq!(next.completed_date, None);
    }

    #[test]
    fn test_next_occurrence_uses_completion_date_for_when_done() {
        let today = NaiveDate::from_ymd_opt(2026, 6, 20).unwrap();
        let tasks = parse_file(
            "- [ ] Clean @when(2026-06-16) @repeat(every week when done)",
            "test.md",
            today,
        );
        let next = next_occurrence(&tasks[0], today).expect("next occurrence");
        // Computed from today (2026-06-20), not the scheduled date.
        assert_eq!(next.when, WhenValue::Date("2026-06-27".to_string()));
    }

    #[test]
    fn test_next_occurrence_none_for_raw_or_nonrecurring() {
        let today = NaiveDate::from_ymd_opt(2026, 6, 16).unwrap();
        let plain = parse_file("- [ ] Just a task @when(2026-06-16)", "test.md", today);
        assert!(next_occurrence(&plain[0], today).is_none());
        let raw = parse_file(
            "- [ ] Standup @when(2026-06-16) @repeat(every weekday)",
            "test.md",
            today,
        );
        assert!(next_occurrence(&raw[0], today).is_none());
    }

    #[test]
    fn test_parse_simple_task() {
        let content = "- [ ] Buy groceries";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Buy groceries");
        assert_eq!(tasks[0].when, WhenValue::Inbox);
        assert!(!tasks[0].completed);
    }

    #[test]
    fn test_parse_task_with_when() {
        let content = "- [ ] Buy groceries @when(today)";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Buy groceries");
        // "today" is converted to actual date so it doesn't stay "today" forever
        assert_eq!(tasks[0].when, WhenValue::Date("2024-01-28".to_string()));
    }

    #[test]
    fn test_parse_task_with_tags() {
        let content = "- [ ] Buy groceries #errands #shopping";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].tags, vec!["errands", "shopping"]);
    }

    #[test]
    fn test_parse_nested_tags() {
        let content = "- [ ] Read paper #inbox/to-read #inbox #ml/papers/2024";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].tags, vec!["inbox/to-read", "inbox", "ml/papers/2024"]);
        // The full nested tag is stripped from the title, not left behind.
        assert_eq!(tasks[0].title, "Read paper");
    }

    #[test]
    fn test_parse_tag_trailing_slash_trimmed() {
        let content = "- [ ] Task #inbox/";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks[0].tags, vec!["inbox"]);
    }

    #[test]
    fn test_parse_completed_task() {
        let content = "- [x] Completed task";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert!(tasks[0].completed);
    }

    #[test]
    fn test_parse_task_with_priority() {
        let content = "- [ ] High priority task !(1)";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "High priority task");
        assert_eq!(tasks[0].priority, Some(1));
    }

    #[test]
    fn test_parse_task_with_all_priorities() {
        let content = "- [ ] Task one !(1)\n- [ ] Task two !(2)\n- [ ] Task three !(3)";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 3);
        assert_eq!(tasks[0].priority, Some(1));
        assert_eq!(tasks[1].priority, Some(2));
        assert_eq!(tasks[2].priority, Some(3));
    }

    #[test]
    fn test_parse_task_no_priority() {
        let content = "- [ ] Normal task";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].priority, None);
    }

    #[test]
    fn test_parse_task_with_created_date() {
        let content = "- [ ] Buy groceries @created(2026-02-14)";
        let today = NaiveDate::from_ymd_opt(2026, 2, 14).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Buy groceries");
        assert_eq!(tasks[0].created_date, Some("2026-02-14".to_string()));
    }

    #[test]
    fn test_parse_task_without_created_date() {
        let content = "- [ ] Buy groceries";
        let today = NaiveDate::from_ymd_opt(2026, 2, 14).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].created_date, None);
    }

    #[test]
    fn test_parse_task_with_completed_and_created() {
        let content = "- [x] Done task @completed(2026-02-14) @created(2026-02-10)";
        let today = NaiveDate::from_ymd_opt(2026, 2, 14).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Done task");
        assert_eq!(tasks[0].completed_date, Some("2026-02-14".to_string()));
        assert_eq!(tasks[0].created_date, Some("2026-02-10".to_string()));
        assert!(tasks[0].completed);
    }

    #[test]
    fn test_format_task_line_with_created_date() {
        let today = NaiveDate::from_ymd_opt(2026, 2, 14).unwrap();
        let project_names = std::collections::HashSet::new();
        let task = Task {
            id: "test".to_string(),
            title: "Test task".to_string(),
            notes: String::new(),
            when: WhenValue::Date("2026-02-14".to_string()),
            deadline: None,
            tags: Vec::new(),
            inherited_tags: Vec::new(),
            checklist: Vec::new(),
            completed: false,
            completed_date: None,
            created_date: Some("2026-02-10".to_string()),
            file_path: "test.md".to_string(),
            line_number: 1,
            projects: Vec::new(),
            indent_level: 0,
            priority: None,
            persons: Vec::new(),
            recurrence: None,
            duration_minutes: None,
            scheduled_time: None,
        };

        let line = format_task_line(&task, today, None, &project_names, TaskFormat::Annado);
        assert!(line.contains("@created(2026-02-10)"));
        assert_eq!(line, "- [ ] Test task @when(2026-02-14) @created(2026-02-10)");
    }

    #[test]
    fn test_roundtrip_created_date() {
        let content = "- [ ] Boodschappen doen @when(2026-02-14) @created(2026-02-14)";
        let today = NaiveDate::from_ymd_opt(2026, 2, 14).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].created_date, Some("2026-02-14".to_string()));

        let project_names = std::collections::HashSet::new();
        let formatted = format_task_line(&tasks[0], today, None, &project_names, TaskFormat::Annado);
        assert_eq!(formatted, "- [ ] Boodschappen doen @when(2026-02-14) @created(2026-02-14)");
    }

    #[test]
    fn test_parse_duration_str() {
        assert_eq!(parse_duration_str("15m"), Some(15));
        assert_eq!(parse_duration_str("15min"), Some(15));
        assert_eq!(parse_duration_str("30m"), Some(30));
        assert_eq!(parse_duration_str("1h"), Some(60));
        assert_eq!(parse_duration_str("1h30m"), Some(90));
        assert_eq!(parse_duration_str("1h30min"), Some(90));
        assert_eq!(parse_duration_str("2h"), Some(120));
        assert_eq!(parse_duration_str("2h15m"), Some(135));
    }

    #[test]
    fn test_format_duration() {
        assert_eq!(format_duration(15), "15m");
        assert_eq!(format_duration(60), "1h");
        assert_eq!(format_duration(90), "1h30m");
        assert_eq!(format_duration(120), "2h");
    }

    #[test]
    fn test_parse_task_with_duration_and_time() {
        let content = "- [ ] Meeting prep @when(2026-02-16) @time(09:00) @duration(1h30m)";
        let today = NaiveDate::from_ymd_opt(2026, 2, 16).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Meeting prep");
        assert_eq!(tasks[0].duration_minutes, Some(90));
        assert_eq!(tasks[0].scheduled_time, Some("09:00".to_string()));
    }

    #[test]
    fn test_roundtrip_duration_and_time() {
        let content = "- [ ] Task @when(2026-02-16) @time(14:00) @duration(45m)";
        let today = NaiveDate::from_ymd_opt(2026, 2, 16).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].duration_minutes, Some(45));
        assert_eq!(tasks[0].scheduled_time, Some("14:00".to_string()));

        let project_names = std::collections::HashSet::new();
        let formatted = format_task_line(&tasks[0], today, None, &project_names, TaskFormat::Annado);
        assert_eq!(formatted, "- [ ] Task @when(2026-02-16) @time(14:00) @duration(45m)");
    }

    #[test]
    fn test_task_without_duration_and_time() {
        let content = "- [ ] Simple task @when(anytime)";
        let today = NaiveDate::from_ymd_opt(2026, 2, 16).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].duration_minutes, None);
        assert_eq!(tasks[0].scheduled_time, None);
    }
}
