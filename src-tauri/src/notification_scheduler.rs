use chrono::{Local, NaiveDate, NaiveTime, Timelike};
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationPrefs {
    #[serde(default = "default_true")]
    pub tray_enabled: bool,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_true")]
    pub morning_of_deadline: bool,
    #[serde(default = "default_morning_time")]
    pub morning_time: String,
    #[serde(default = "default_true")]
    pub day_before: bool,
    #[serde(default = "default_day_before_time")]
    pub day_before_time: String,
    #[serde(default = "default_true")]
    pub overdue_daily: bool,
    #[serde(default = "default_overdue_time")]
    pub overdue_time: String,
    #[serde(default = "default_true")]
    pub launch_banner: bool,
}

fn default_true() -> bool { true }
fn default_morning_time() -> String { "09:00".into() }
fn default_day_before_time() -> String { "18:00".into() }
fn default_overdue_time() -> String { "08:00".into() }

impl Default for NotificationPrefs {
    fn default() -> Self {
        Self {
            tray_enabled: true,
            enabled: true,
            morning_of_deadline: true,
            morning_time: "09:00".into(),
            day_before: true,
            day_before_time: "18:00".into(),
            overdue_daily: true,
            overdue_time: "08:00".into(),
            launch_banner: true,
        }
    }
}

// Key: "task_id:YYYY-MM-DD:kind" — resets on restart (acceptable, date-scoped)
static SENT: Lazy<Mutex<HashSet<String>>> = Lazy::new(|| Mutex::new(HashSet::new()));

fn prefs_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|d: std::path::PathBuf| d.join("notification_prefs.json"))
}

pub fn load_notification_prefs(app: &AppHandle) -> NotificationPrefs {
    prefs_path(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_notification_prefs(app: &AppHandle, prefs: &NotificationPrefs) -> Result<(), String> {
    let path = prefs_path(app).ok_or("Cannot get config dir")?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let json = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

pub fn spawn_scheduler(app: AppHandle) {
    thread::spawn(move || {
        // Let the vault initialize before first check
        thread::sleep(Duration::from_secs(5));
        loop {
            let prefs = load_notification_prefs(&app);
            if prefs.enabled {
                tick(&app, &prefs);
            }
            thread::sleep(Duration::from_secs(60));
        }
    });
}

fn tick(app: &AppHandle, prefs: &NotificationPrefs) {
    let tasks = match crate::commands::get_tasks() {
        Ok(t) => t,
        Err(_) => return,
    };
    let now = Local::now();
    let today = now.date_naive();
    let cur = now.time();
    let today_s = today.format("%Y-%m-%d").to_string();
    let mut sent = SENT.lock();

    for task in tasks.iter().filter(|t| !t.completed) {
        let Some(dl_str) = task.deadline.as_deref() else {
            continue;
        };
        let Ok(dl) = NaiveDate::parse_from_str(dl_str, "%Y-%m-%d") else {
            continue;
        };

        if prefs.morning_of_deadline && dl == today {
            fire_if_time(
                app,
                &mut sent,
                &task.id,
                &today_s,
                "morning",
                parse_time(&prefs.morning_time),
                cur,
                "Deadline Today",
                &task.title,
            );
        }
        if prefs.day_before {
            if let Some(day_before) = dl.pred_opt() {
                if day_before == today {
                    fire_if_time(
                        app,
                        &mut sent,
                        &task.id,
                        &today_s,
                        "day_before",
                        parse_time(&prefs.day_before_time),
                        cur,
                        "Deadline Tomorrow",
                        &task.title,
                    );
                }
            }
        }
        if prefs.overdue_daily && dl < today {
            fire_if_time(
                app,
                &mut sent,
                &task.id,
                &today_s,
                "overdue",
                parse_time(&prefs.overdue_time),
                cur,
                "Overdue Task",
                &format!("{} (due {})", task.title, dl_str),
            );
        }
    }
}

fn fire_if_time(
    app: &AppHandle,
    sent: &mut HashSet<String>,
    task_id: &str,
    date: &str,
    kind: &str,
    target: NaiveTime,
    current: NaiveTime,
    title: &str,
    body: &str,
) {
    let key = format!("{}:{}:{}", task_id, date, kind);
    if !sent.contains(&key)
        && current.hour() == target.hour()
        && current.minute() == target.minute()
    {
        if let Err(e) = app
            .notification()
            .builder()
            .title(title)
            .body(body)
            .show()
        {
            eprintln!("[notifications] {}", e);
        }
        sent.insert(key);
    }
}

fn parse_time(s: &str) -> NaiveTime {
    NaiveTime::parse_from_str(s, "%H:%M")
        .unwrap_or_else(|_| NaiveTime::from_hms_opt(9, 0, 0).unwrap())
}
