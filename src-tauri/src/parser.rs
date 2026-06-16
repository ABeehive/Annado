use chrono::NaiveDate;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::LazyLock;

static TASK_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\s*)- \[([ xX-])\] (.+)$").unwrap());

static WHEN_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"@when\(([^)]+)\)").unwrap());

static DUE_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"@due\(([^)]+)\)").unwrap());

static TAG_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"#(\w+)").unwrap());

pub const TASK_MARKER_TAG: &str = "task";

fn normalize_task_marker_tag(tag: &str) -> String {
    tag.trim().trim_start_matches('#').to_string()
}

pub fn default_task_marker_tag() -> String {
    TASK_MARKER_TAG.to_string()
}

pub fn is_task_marker_tag(tag: &str, task_marker_tag: &str) -> bool {
    let marker = normalize_task_marker_tag(task_marker_tag);
    !marker.is_empty() && tag.eq_ignore_ascii_case(&marker)
}

pub fn has_task_marker_tag(tags: &[String], task_marker_tag: &str) -> bool {
    let marker = normalize_task_marker_tag(task_marker_tag);
    marker.is_empty() || tags.iter().any(|tag| tag.eq_ignore_ascii_case(&marker))
}

pub fn filter_task_marker_tags(tags: Vec<String>, task_marker_tag: &str) -> Vec<String> {
    tags.into_iter()
        .filter(|tag| !is_task_marker_tag(tag, task_marker_tag))
        .collect()
}

static PROJECT_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"@project\(([^)]+)\)").unwrap());

static PRIORITY_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"!\(([1-3])\)").unwrap());

static WIKILINK_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\[\[([^\]]+)\]\]").unwrap());

static RECURRING_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"@recurring\(([^)]+)\)").unwrap());

static COMPLETED_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"@completed\(([^)]+)\)").unwrap());

static CREATED_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"@created\(([^)]+)\)").unwrap());

static DURATION_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"@duration\(([^)]+)\)").unwrap());

static TIME_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"@time\(([^)]+)\)").unwrap());

static EMOJI_START_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"🛫\u{FE0F}?\s*(\d{4}-\d{2}-\d{2})").unwrap());

static EMOJI_CREATED_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"➕\u{FE0F}?\s*(\d{4}-\d{2}-\d{2})").unwrap());

static EMOJI_SCHEDULED_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?:⏳|⌛)\u{FE0F}?\s*(\d{4}-\d{2}-\d{2})").unwrap());

static EMOJI_DUE_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?:📅|📆|🗓)\u{FE0F}?\s*(\d{4}-\d{2}-\d{2})").unwrap());

static EMOJI_DONE_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?:✅|✓)\u{FE0F}?\s*(\d{4}-\d{2}-\d{2})").unwrap());

static EMOJI_CANCELLED_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"❌\u{FE0F}?\s*(\d{4}-\d{2}-\d{2})").unwrap());

static EMOJI_PRIORITY_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(🔺|⏫|🔼|🔽|⏬)\u{FE0F}?").unwrap());

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
    pub recurring_template_id: Option<String>, // Links to recurring template if this is an instance
    pub duration_minutes: Option<u32>, // Estimated duration in minutes from @duration()
    pub scheduled_time: Option<String>, // "HH:MM" from @time()
}

impl Task {
    pub fn generate_id(file_path: &str, line_number: usize) -> String {
        let mut hasher = Sha256::new();
        // IDs use Annado's slash-normalized app path so Windows and macOS separators agree.
        hasher.update(format!(
            "{}:{}",
            normalize_internal_path(file_path),
            line_number
        ));
        let result = hasher.finalize();
        hex::encode(&result[..8]) // Use first 8 bytes for shorter ID
    }
}

pub fn normalize_internal_path(path: &str) -> String {
    path.replace('\\', "/")
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
            completed: checkbox.eq_ignore_ascii_case("x") || checkbox == "-",
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
        .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
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

/// Extract completed date from content (e.g., @completed(2024-01-28) -> "2024-01-28")
pub fn extract_completed_date(content: &str) -> (Option<String>, String) {
    if let Some(caps) = COMPLETED_REGEX.captures(content) {
        let date_str = caps.get(1).map(|m| m.as_str().to_string());
        let cleaned = COMPLETED_REGEX.replace(content, "").to_string();
        (date_str, cleaned.trim().to_string())
    } else {
        (None, content.to_string())
    }
}

/// Extract created date from content (e.g., @created(2024-01-28) -> "2024-01-28")
pub fn extract_created_date(content: &str) -> (Option<String>, String) {
    if let Some(caps) = CREATED_REGEX.captures(content) {
        let date_str = caps.get(1).map(|m| m.as_str().to_string());
        let cleaned = CREATED_REGEX.replace(content, "").to_string();
        (date_str, cleaned.trim().to_string())
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

/// Extract duration from content (e.g., @duration(1h30m) -> 90)
pub fn extract_duration(content: &str) -> (Option<u32>, String) {
    if let Some(caps) = DURATION_REGEX.captures(content) {
        let dur_str = caps.get(1).map_or("", |m| m.as_str());
        let duration = parse_duration_str(dur_str);
        let cleaned = DURATION_REGEX.replace(content, "").to_string();
        (duration, cleaned.trim().to_string())
    } else {
        (None, content.to_string())
    }
}

/// Extract scheduled time from content (e.g., @time(09:00) -> "09:00")
pub fn extract_time(content: &str) -> (Option<String>, String) {
    if let Some(caps) = TIME_REGEX.captures(content) {
        let time_str = caps.get(1).map_or("", |m| m.as_str()).to_string();
        let cleaned = TIME_REGEX.replace(content, "").to_string();
        (Some(time_str), cleaned.trim().to_string())
    } else {
        (None, content.to_string())
    }
}

#[derive(Debug, Default)]
struct TasksEmojiMetadata {
    start_date: Option<String>,
    created_date: Option<String>,
    scheduled_date: Option<String>,
    due_date: Option<String>,
    done_date: Option<String>,
    cancelled_date: Option<String>,
    priority: Option<u8>,
}

fn extract_emoji_date(content: &str, regex: &Regex) -> (Option<String>, String) {
    let date = regex
        .captures_iter(content)
        .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
        .last();
    let cleaned = regex.replace_all(content, "").to_string();
    (date, cleaned.trim().to_string())
}

fn extract_emoji_priority(content: &str) -> (Option<u8>, String) {
    let priority = EMOJI_PRIORITY_REGEX
        .captures_iter(content)
        .filter_map(|cap| {
            let symbol = cap.get(1)?.as_str();
            match symbol {
                "🔺" | "⏫" => Some(1),
                "🔼" => Some(2),
                "🔽" | "⏬" => Some(3),
                _ => None,
            }
        })
        .last();
    let cleaned = EMOJI_PRIORITY_REGEX.replace_all(content, "").to_string();
    (priority, cleaned.trim().to_string())
}

fn extract_tasks_emoji_metadata(content: &str) -> (TasksEmojiMetadata, String) {
    let (done_date, content) = extract_emoji_date(content, &EMOJI_DONE_REGEX);
    let (cancelled_date, content) = extract_emoji_date(&content, &EMOJI_CANCELLED_REGEX);
    let (due_date, content) = extract_emoji_date(&content, &EMOJI_DUE_REGEX);
    let (scheduled_date, content) = extract_emoji_date(&content, &EMOJI_SCHEDULED_REGEX);
    let (start_date, content) = extract_emoji_date(&content, &EMOJI_START_REGEX);
    let (created_date, content) = extract_emoji_date(&content, &EMOJI_CREATED_REGEX);
    let (priority, content) = extract_emoji_priority(&content);

    (
        TasksEmojiMetadata {
            start_date,
            created_date,
            scheduled_date,
            due_date,
            done_date,
            cancelled_date,
            priority,
        },
        content,
    )
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

#[allow(dead_code)]
pub fn parse_file(content: &str, file_path: &str, today: NaiveDate) -> Vec<Task> {
    parse_file_with_task_marker(content, file_path, today, TASK_MARKER_TAG)
}

pub fn parse_file_with_task_marker(
    content: &str,
    file_path: &str,
    today: NaiveDate,
    task_marker_tag: &str,
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
                let (when, content_after_when) = extract_when(&parsed.content, today);
                let (deadline, content_after_due) = extract_due(&content_after_when);
                let (explicit_project, content_after_project) = extract_project(&content_after_due);
                let (priority, content_after_priority) = extract_priority(&content_after_project);
                let (recurring_template_id, content_after_recurring) =
                    extract_recurring_id(&content_after_priority);
                let (completed_date, content_after_completed) =
                    extract_completed_date(&content_after_recurring);
                let (created_date, content_after_created) =
                    extract_created_date(&content_after_completed);
                let (duration_minutes, content_after_duration) =
                    extract_duration(&content_after_created);
                let (scheduled_time, content_after_time) = extract_time(&content_after_duration);
                let (emoji_metadata, content_after_emoji) =
                    extract_tasks_emoji_metadata(&content_after_time);
                let (tags, title) = extract_tags(&content_after_emoji);

                if !has_task_marker_tag(&tags, task_marker_tag) {
                    i += 1;
                    continue;
                }
                let tags = filter_task_marker_tags(tags, task_marker_tag);
                let when = if when == WhenValue::Inbox {
                    emoji_metadata
                        .scheduled_date
                        .or(emoji_metadata.start_date)
                        .map(WhenValue::Date)
                        .unwrap_or(WhenValue::Inbox)
                } else {
                    when
                };
                let deadline = deadline.or(emoji_metadata.due_date);
                let priority = priority.or(emoji_metadata.priority);
                let completed_date = completed_date
                    .or(emoji_metadata.done_date)
                    .or(emoji_metadata.cancelled_date);
                let created_date = created_date.or(emoji_metadata.created_date);

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
                    recurring_template_id,
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
    let normalized_path = normalize_internal_path(file_path);
    let parts: Vec<&str> = normalized_path.split('/').collect();

    // Find the Projects folder index
    let projects_idx = parts
        .iter()
        .position(|part| part.contains(projects_pattern) && !part.ends_with(".md"))?;

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

#[allow(dead_code)]
pub fn format_task_line(
    task: &Task,
    today: NaiveDate,
    file_project: Option<&str>,
    project_names: &std::collections::HashSet<String>,
) -> String {
    format_task_line_with_task_marker(task, today, file_project, project_names, TASK_MARKER_TAG)
}

pub fn format_task_line_with_task_marker(
    task: &Task,
    today: NaiveDate,
    file_project: Option<&str>,
    project_names: &std::collections::HashSet<String>,
    task_marker_tag: &str,
) -> String {
    let checkbox = if task.completed { "[x]" } else { "[ ]" };
    let indent = " ".repeat(task.indent_level);
    let task_marker_tag = normalize_task_marker_tag(task_marker_tag);

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
    let cleaned_title = cleaned_title
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    let mut parts = vec![cleaned_title.clone()];

    // Add @when if not inbox
    if task.when != WhenValue::Inbox {
        parts.push(format!("@when({})", task.when.to_string_value(today)));
    }

    // Add @due if present
    if let Some(ref deadline) = task.deadline {
        parts.push(format!("@due({})", deadline));
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

    // Add priority if present
    if let Some(priority) = task.priority {
        parts.push(format!("!({})", priority));
    }

    // Add @time if present
    if let Some(ref time) = task.scheduled_time {
        parts.push(format!("@time({})", time));
    }

    // Add @duration if present
    if let Some(dur) = task.duration_minutes {
        parts.push(format!("@duration({})", format_duration(dur)));
    }

    // Add the configured task marker first so ordinary Markdown checkboxes stay out of Annado.
    if !task_marker_tag.is_empty() {
        parts.push(format!("#{}", task_marker_tag));
    }

    // Add user-visible tags
    for tag in &task.tags {
        if !is_task_marker_tag(tag, &task_marker_tag) {
            parts.push(format!("#{}", tag));
        }
    }

    // Add recurring template ID if present
    if let Some(ref template_id) = task.recurring_template_id {
        parts.push(format!("@recurring({})", template_id));
    }

    // Add completed date if present
    if let Some(ref date) = task.completed_date {
        parts.push(format!("@completed({})", date));
    }

    // Add created date if present
    if let Some(ref date) = task.created_date {
        parts.push(format!("@created({})", date));
    }

    format!("{}- {} {}", indent, checkbox, parts.join(" "))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_file_ignores_checkbox_without_task_marker() {
        let content = "- [ ] Shopping checklist item\n- [ ] Pay tax bill #Task";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Pay tax bill");
        assert!(tasks[0].tags.is_empty());
    }

    #[test]
    fn test_parse_file_keeps_plain_checklist_items_under_task() {
        let content = "- [ ] Plan dinner #task\n    - [ ] Pick recipes\n    - [x] Buy ingredients\n- [ ] Regular checklist item";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Plan dinner");
        assert_eq!(tasks[0].checklist.len(), 2);
        assert_eq!(tasks[0].checklist[0].title, "Pick recipes");
        assert!(!tasks[0].checklist[0].completed);
        assert_eq!(tasks[0].checklist[1].title, "Buy ingredients");
        assert!(tasks[0].checklist[1].completed);
    }

    #[test]
    fn test_parse_file_accepts_configured_task_marker() {
        let content = "- [ ] Pay tax bill #followup\n- [ ] Regular checklist item #task";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file_with_task_marker(content, "test.md", today, "followup");

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Pay tax bill");
        assert!(tasks[0].tags.is_empty());
    }

    #[test]
    fn test_parse_file_allows_blank_task_marker() {
        let content = "- [ ] Plain top-level checkbox";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file_with_task_marker(content, "test.md", today, "");

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Plain top-level checkbox");
    }

    #[test]
    fn test_format_task_line_uses_configured_task_marker() {
        let today = NaiveDate::from_ymd_opt(2026, 2, 14).unwrap();
        let project_names = std::collections::HashSet::new();
        let task = Task {
            id: "test".to_string(),
            title: "Test task".to_string(),
            notes: String::new(),
            when: WhenValue::Inbox,
            deadline: None,
            tags: vec!["followup".to_string(), "work".to_string()],
            checklist: Vec::new(),
            completed: false,
            completed_date: None,
            created_date: None,
            file_path: "test.md".to_string(),
            line_number: 1,
            projects: Vec::new(),
            indent_level: 0,
            priority: None,
            persons: Vec::new(),
            recurring_template_id: None,
            duration_minutes: None,
            scheduled_time: None,
        };

        let line =
            format_task_line_with_task_marker(&task, today, None, &project_names, "followup");

        assert_eq!(line, "- [ ] Test task #followup #work");
    }

    #[test]
    fn test_parse_tasks_emoji_format_dates_and_priority() {
        let content = "- [ ] #task Draft brief 🔼 ⏳ 2026-07-01 📅 2026-07-05 ➕ 2026-06-16 #work";
        let today = NaiveDate::from_ymd_opt(2026, 6, 16).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Draft brief");
        assert_eq!(tasks[0].when, WhenValue::Date("2026-07-01".to_string()));
        assert_eq!(tasks[0].deadline, Some("2026-07-05".to_string()));
        assert_eq!(tasks[0].created_date, Some("2026-06-16".to_string()));
        assert_eq!(tasks[0].priority, Some(2));
        assert_eq!(tasks[0].tags, vec!["work"]);
    }

    #[test]
    fn test_parse_tasks_emoji_format_start_date_when_unscheduled() {
        let content = "- [ ] #task Start work 🛫 2026-07-03";
        let today = NaiveDate::from_ymd_opt(2026, 6, 16).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Start work");
        assert_eq!(tasks[0].when, WhenValue::Date("2026-07-03".to_string()));
    }

    #[test]
    fn test_parse_tasks_emoji_format_done_and_cancelled_dates() {
        let content =
            "- [x] #task Done task ✅ 2026-07-04\n- [-] #task Cancelled task ❌ 2026-07-05";
        let today = NaiveDate::from_ymd_opt(2026, 6, 16).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].title, "Done task");
        assert!(tasks[0].completed);
        assert_eq!(tasks[0].completed_date, Some("2026-07-04".to_string()));
        assert_eq!(tasks[1].title, "Cancelled task");
        assert!(tasks[1].completed);
        assert_eq!(tasks[1].completed_date, Some("2026-07-05".to_string()));
    }

    #[test]
    fn test_parse_simple_task() {
        let content = "- [ ] Buy groceries #task";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Buy groceries");
        assert!(tasks[0].tags.is_empty());
        assert_eq!(tasks[0].when, WhenValue::Inbox);
        assert!(!tasks[0].completed);
    }

    #[test]
    fn test_parse_task_with_when() {
        let content = "- [ ] Buy groceries @when(today) #task";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Buy groceries");
        // "today" is converted to actual date so it doesn't stay "today" forever
        assert_eq!(tasks[0].when, WhenValue::Date("2024-01-28".to_string()));
    }

    #[test]
    fn test_parse_task_with_tags() {
        let content = "- [ ] Buy groceries #task #errands #shopping";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].tags, vec!["errands", "shopping"]);
    }

    #[test]
    fn test_parse_completed_task() {
        let content = "- [x] Completed task #task";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert!(tasks[0].completed);
    }

    #[test]
    fn test_parse_task_with_priority() {
        let content = "- [ ] High priority task !(1) #task";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "High priority task");
        assert_eq!(tasks[0].priority, Some(1));
    }

    #[test]
    fn test_parse_task_with_all_priorities() {
        let content =
            "- [ ] Task one !(1) #task\n- [ ] Task two !(2) #task\n- [ ] Task three !(3) #task";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 3);
        assert_eq!(tasks[0].priority, Some(1));
        assert_eq!(tasks[1].priority, Some(2));
        assert_eq!(tasks[2].priority, Some(3));
    }

    #[test]
    fn test_parse_task_no_priority() {
        let content = "- [ ] Normal task #task";
        let today = NaiveDate::from_ymd_opt(2024, 1, 28).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].priority, None);
    }

    #[test]
    fn test_parse_task_with_created_date() {
        let content = "- [ ] Buy groceries #task @created(2026-02-14)";
        let today = NaiveDate::from_ymd_opt(2026, 2, 14).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Buy groceries");
        assert_eq!(tasks[0].created_date, Some("2026-02-14".to_string()));
    }

    #[test]
    fn test_parse_task_without_created_date() {
        let content = "- [ ] Buy groceries #task";
        let today = NaiveDate::from_ymd_opt(2026, 2, 14).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].created_date, None);
    }

    #[test]
    fn test_parse_task_with_completed_and_created() {
        let content = "- [x] Done task #task @completed(2026-02-14) @created(2026-02-10)";
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
            recurring_template_id: None,
            duration_minutes: None,
            scheduled_time: None,
        };

        let line = format_task_line(&task, today, None, &project_names);
        assert!(line.contains("@created(2026-02-10)"));
        assert_eq!(
            line,
            "- [ ] Test task @when(2026-02-14) #task @created(2026-02-10)"
        );
    }

    #[test]
    fn test_roundtrip_created_date() {
        let content = "- [ ] Boodschappen doen @when(2026-02-14) #task @created(2026-02-14)";
        let today = NaiveDate::from_ymd_opt(2026, 2, 14).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].created_date, Some("2026-02-14".to_string()));

        let project_names = std::collections::HashSet::new();
        let formatted = format_task_line(&tasks[0], today, None, &project_names);
        assert_eq!(
            formatted,
            "- [ ] Boodschappen doen @when(2026-02-14) #task @created(2026-02-14)"
        );
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
        let content = "- [ ] Meeting prep @when(2026-02-16) @time(09:00) @duration(1h30m) #task";
        let today = NaiveDate::from_ymd_opt(2026, 2, 16).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Meeting prep");
        assert_eq!(tasks[0].duration_minutes, Some(90));
        assert_eq!(tasks[0].scheduled_time, Some("09:00".to_string()));
    }

    #[test]
    fn test_roundtrip_duration_and_time() {
        let content = "- [ ] Task @when(2026-02-16) @time(14:00) @duration(45m) #task";
        let today = NaiveDate::from_ymd_opt(2026, 2, 16).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].duration_minutes, Some(45));
        assert_eq!(tasks[0].scheduled_time, Some("14:00".to_string()));

        let project_names = std::collections::HashSet::new();
        let formatted = format_task_line(&tasks[0], today, None, &project_names);
        assert_eq!(
            formatted,
            "- [ ] Task @when(2026-02-16) @time(14:00) @duration(45m) #task"
        );
    }

    #[test]
    fn test_task_without_duration_and_time() {
        let content = "- [ ] Simple task @when(anytime) #task";
        let today = NaiveDate::from_ymd_opt(2026, 2, 16).unwrap();
        let tasks = parse_file(content, "test.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].duration_minutes, None);
        assert_eq!(tasks[0].scheduled_time, None);
    }

    #[test]
    fn test_task_id_normalizes_path_separators() {
        let slash_id = Task::generate_id("Daily Notes/2026-06-16.md", 3);
        let backslash_id = Task::generate_id(r"Daily Notes\2026-06-16.md", 3);

        assert_eq!(slash_id, backslash_id);
    }

    #[test]
    fn test_parse_file_derives_project_from_windows_path() {
        let content = "- [ ] Ship launch plan @when(today) #task";
        let today = NaiveDate::from_ymd_opt(2026, 6, 16).unwrap();
        let tasks = parse_file(content, r"02. Projects\Client Work\Launch Plan.md", today);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Ship launch plan");
        assert_eq!(tasks[0].projects, vec!["Launch Plan".to_string()]);
    }

    #[test]
    fn test_derive_project_name_accepts_windows_separators() {
        let project = derive_project_name_with_pattern(
            r"02. Projects\Client Work\Launch Plan.md",
            "Projects",
        );

        assert_eq!(project, Some("Launch Plan".to_string()));
    }
}
