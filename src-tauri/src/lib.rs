mod calendar;
mod commands;
mod notification_scheduler;
mod parser;
mod path_openers;
mod recurrence;
mod taskformat;
mod vault;

use commands::{
    create_task, create_vault, get_all_persons, get_all_projects, get_all_tags, get_person_metadata, get_task,
    get_tasks, get_vault_path, rescan_vault, set_vault_path, toggle_task_complete,
    toggle_checklist_item, rename_checklist_item, delete_checklist_item, update_project_metadata, update_task,
    migrate_recurrence_dry_run, migrate_recurrence_apply, get_recurring_template_count,
    get_task_format, set_task_format, detect_task_format,
    get_task_marker, set_task_marker,
    get_folder_paths, set_folder_paths, delete_task,
    get_excluded_paths, set_excluded_paths, set_annado_exclude_in_file,
    create_project, rename_project, create_person, rename_person,
    get_calendars, get_calendar_events, check_calendar_access, open_calendar_at_date,
    delete_calendar_event,
    get_is_obsidian_vault, set_is_obsidian_vault,
    get_opener_prefs, set_opener_prefs, run_custom_opener,
    show_main_window, open_task_in_main, get_notification_prefs, save_notification_prefs,
    set_tray_enabled, send_test_notification,
};
use path_openers::{detect_path_openers, refresh_path_openers, open_path_with, open_path_default};
use tauri::{AppHandle, Emitter, Manager};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{WebviewUrl, WebviewWindowBuilder};
use parking_lot::Mutex;
use once_cell::sync::Lazy;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

static PENDING_DEEP_LINK: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));
static QUICK_ADD_SHORTCUT_ID: Lazy<Mutex<Option<u32>>> = Lazy::new(|| Mutex::new(None));
static SHOW_APP_SHORTCUT_ID: Lazy<Mutex<Option<u32>>> = Lazy::new(|| Mutex::new(None));
static TRAY_POPUP_VISIBLE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

const DEFAULT_QUICK_ADD: &str = "meta+shift+space";
const DEFAULT_SHOW_APP: &str = "meta+shift+a";

#[tauri::command]
fn get_pending_deep_link() -> Option<String> {
    PENDING_DEEP_LINK.lock().take()
}

// Parse a keybinding string like "meta+shift+space" into Modifiers and Code
fn parse_keybinding(binding: &str) -> Option<(Modifiers, Code)> {
    let binding_lower = binding.to_lowercase();
    let parts: Vec<&str> = binding_lower.split('+').collect();
    if parts.is_empty() {
        return None;
    }

    let mut modifiers = Modifiers::empty();
    let key_part = parts.last()?;

    for part in &parts[..parts.len() - 1] {
        match *part {
            "meta" | "cmd" | "command" | "super" => modifiers |= Modifiers::SUPER,
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "alt" | "option" => modifiers |= Modifiers::ALT,
            "shift" => modifiers |= Modifiers::SHIFT,
            _ => {}
        }
    }

    let code = match *key_part {
        "space" | " " => Code::Space,
        "a" => Code::KeyA, "b" => Code::KeyB, "c" => Code::KeyC, "d" => Code::KeyD,
        "e" => Code::KeyE, "f" => Code::KeyF, "g" => Code::KeyG, "h" => Code::KeyH,
        "i" => Code::KeyI, "j" => Code::KeyJ, "k" => Code::KeyK, "l" => Code::KeyL,
        "m" => Code::KeyM, "n" => Code::KeyN, "o" => Code::KeyO, "p" => Code::KeyP,
        "q" => Code::KeyQ, "r" => Code::KeyR, "s" => Code::KeyS, "t" => Code::KeyT,
        "u" => Code::KeyU, "v" => Code::KeyV, "w" => Code::KeyW, "x" => Code::KeyX,
        "y" => Code::KeyY, "z" => Code::KeyZ,
        "0" => Code::Digit0, "1" => Code::Digit1, "2" => Code::Digit2, "3" => Code::Digit3,
        "4" => Code::Digit4, "5" => Code::Digit5, "6" => Code::Digit6, "7" => Code::Digit7,
        "8" => Code::Digit8, "9" => Code::Digit9,
        "enter" | "return" => Code::Enter,
        "escape" | "esc" => Code::Escape,
        "backspace" => Code::Backspace,
        "tab" => Code::Tab,
        _ => return None,
    };

    Some((modifiers, code))
}

#[tauri::command]
fn register_global_shortcuts(app: AppHandle, quick_add_binding: String, show_app_binding: String) -> Result<(), String> {
    if cfg!(debug_assertions) {
        eprintln!("[shortcuts] register_global_shortcuts called: qa='{}', sa='{}'", quick_add_binding, show_app_binding);
    }
    let global_shortcut = app.global_shortcut();

    // Unregister all existing shortcuts first
    global_shortcut.unregister_all().map_err(|e| {
        if cfg!(debug_assertions) {
            eprintln!("[shortcuts] unregister_all failed: {}", e);
        }
        e.to_string()
    })?;

    // Parse both keybindings, falling back to defaults if invalid
    let qa_binding = &quick_add_binding;
    let (qa_modifiers, qa_code) = parse_keybinding(qa_binding)
        .or_else(|| {
            if cfg!(debug_assertions) {
                eprintln!("[shortcuts] WARN: invalid keybinding '{}', falling back to '{}'", qa_binding, DEFAULT_QUICK_ADD);
            }
            parse_keybinding(DEFAULT_QUICK_ADD)
        })
        .ok_or_else(|| "Failed to parse default keybinding".to_string())?;
    let qa_shortcut = Shortcut::new(Some(qa_modifiers), qa_code);
    if cfg!(debug_assertions) {
        eprintln!("[shortcuts] parsed quick_add: modifiers={:?}, code={:?}, id={}", qa_modifiers, qa_code, qa_shortcut.id());
    }
    *QUICK_ADD_SHORTCUT_ID.lock() = Some(qa_shortcut.id());
    global_shortcut.register(qa_shortcut).map_err(|e| {
        if cfg!(debug_assertions) {
            eprintln!("[shortcuts] register quick_add failed: {}", e);
        }
        e.to_string()
    })?;
    if cfg!(debug_assertions) {
        eprintln!("[shortcuts] registered quick_add id={}", qa_shortcut.id());
    }

    let sa_binding = &show_app_binding;
    let (sa_modifiers, sa_code) = parse_keybinding(sa_binding)
        .or_else(|| {
            if cfg!(debug_assertions) {
                eprintln!("[shortcuts] WARN: invalid keybinding '{}', falling back to '{}'", sa_binding, DEFAULT_SHOW_APP);
            }
            parse_keybinding(DEFAULT_SHOW_APP)
        })
        .ok_or_else(|| "Failed to parse default keybinding".to_string())?;
    let sa_shortcut = Shortcut::new(Some(sa_modifiers), sa_code);
    if cfg!(debug_assertions) {
        eprintln!("[shortcuts] parsed show_app: modifiers={:?}, code={:?}, id={}", sa_modifiers, sa_code, sa_shortcut.id());
    }
    *SHOW_APP_SHORTCUT_ID.lock() = Some(sa_shortcut.id());
    global_shortcut.register(sa_shortcut).map_err(|e| {
        if cfg!(debug_assertions) {
            eprintln!("[shortcuts] register show_app failed: {}", e);
        }
        e.to_string()
    })?;
    if cfg!(debug_assertions) {
        eprintln!("[shortcuts] registered show_app id={}", sa_shortcut.id());
    }

    if cfg!(debug_assertions) {
        eprintln!("[shortcuts] all shortcuts registered successfully");
    }
    Ok(())
}

fn toggle_tray_popup(app: &AppHandle, click_pos: tauri::PhysicalPosition<f64>) {
    if let Some(popup) = app.get_webview_window("tray-popup") {
        let mut vis = TRAY_POPUP_VISIBLE.lock();
        if *vis {
            let _ = popup.hide();
            *vis = false;
        } else {
            position_popup(&popup, click_pos);
            let _ = popup.show();
            let _ = popup.set_focus();
            *vis = true;
        }
        return;
    }
    // First open: create the window
    let result = WebviewWindowBuilder::new(app, "tray-popup", WebviewUrl::App("/".into()))
        .title("Annado")
        .inner_size(320.0, 480.0)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .build();

    if let Ok(popup) = result {
        position_popup(&popup, click_pos);
        let _ = popup.show();
        let _ = popup.set_focus();
        *TRAY_POPUP_VISIBLE.lock() = true;

        let app2 = app.clone();
        popup.on_window_event(move |ev| {
            if let tauri::WindowEvent::Focused(false) = ev {
                if let Some(w) = app2.get_webview_window("tray-popup") {
                    let _ = w.hide();
                    *TRAY_POPUP_VISIBLE.lock() = false;
                }
            }
        });
    }
}

fn position_popup(popup: &tauri::WebviewWindow, click: tauri::PhysicalPosition<f64>) {
    let scale = popup.scale_factor().unwrap_or(2.0);
    let w = (320.0 * scale) as i32;
    let gap = (8.0 * scale) as i32;
    let x = (click.x as i32 - w / 2).max(0);
    let y = click.y as i32 + gap;
    let _ = popup.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if cfg!(debug_assertions) {
                        eprintln!("[shortcuts] handler fired! shortcut_id={}, state={:?}", shortcut.id(), event.state());
                    }

                    if event.state() != ShortcutState::Pressed {
                        return;
                    }

                    let qa_id = QUICK_ADD_SHORTCUT_ID.lock();
                    let sa_id = SHOW_APP_SHORTCUT_ID.lock();

                    if cfg!(debug_assertions) {
                        eprintln!("[shortcuts] comparing: shortcut_id={}, qa_id={:?}, sa_id={:?}", shortcut.id(), *qa_id, *sa_id);
                    }

                    let is_quick_add = qa_id.map_or(false, |id| id == shortcut.id());
                    let is_show_app = sa_id.map_or(false, |id| id == shortcut.id());

                    if is_quick_add || is_show_app {
                        if cfg!(debug_assertions) {
                            eprintln!("[shortcuts] matched! quick_add={}, show_app={}", is_quick_add, is_show_app);
                        }
                        if let Some(window) = app.webview_windows().values().next() {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    if is_quick_add {
                        let _ = app.emit("global-quickadd", ());
                    }
                })
                .build(),
        )
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                // Only accept annado:// deep links
                let is_valid_deep_link = |url_str: &str| -> bool {
                    url_str.starts_with("annado://")
                };

                // Check for URLs that launched the app (cold start)
                if let Ok(Some(urls)) = app.deep_link().get_current() {
                    if let Some(url) = urls.first() {
                        let url_str = url.to_string();
                        if is_valid_deep_link(&url_str) {
                            *PENDING_DEEP_LINK.lock() = Some(url_str);
                        }
                    }
                }

                // Register handler for URLs received while app is running
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        let url_str = url.to_string();
                        if !is_valid_deep_link(&url_str) {
                            continue;
                        }
                        // Store in pending for cold start race condition
                        *PENDING_DEEP_LINK.lock() = Some(url_str.clone());
                        let _ = handle.emit("deep-link-received", url_str);
                    }
                });

                // Global shortcut registration is done via the register_global_shortcut command
                // called from the frontend with the user's configured keybinding

                // Tray icon — always built so visibility can be toggled later without restart
                let app_tray = app.handle().clone();
                // Make Cmd+W hide the main window instead of destroying it,
                // so show_main_window always works
                if let Some(main_win) = app.get_webview_window("main") {
                    let win_clone = main_win.clone();
                    main_win.on_window_event(move |ev| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = ev {
                            api.prevent_close();
                            let _ = win_clone.hide();
                        }
                    });
                }

                let tray = TrayIconBuilder::with_id("main-tray")
                    .icon(tauri::include_image!("icons/32x32.png"))
                    .tooltip("Annado")
                    .on_tray_icon_event(move |_tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            position,
                            ..
                        } = event {
                            toggle_tray_popup(&app_tray, position);
                        }
                    })
                    .build(app)
                    .expect("Failed to build tray icon");

                // Apply saved visibility preference
                let prefs = notification_scheduler::load_notification_prefs(app.handle());
                if !prefs.tray_enabled {
                    tray.set_visible(false).ok();
                }

                notification_scheduler::spawn_scheduler(app.handle().clone());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_vault_path,
            create_vault,
            get_vault_path,
            get_tasks,
            get_task,
            update_task,
            create_task,
            toggle_task_complete,
            toggle_checklist_item,
            rename_checklist_item,
            delete_checklist_item,
            delete_task,
            rescan_vault,
            get_all_projects,
            get_all_persons,
            get_all_tags,
            get_person_metadata,
            update_project_metadata,
            get_pending_deep_link,
            register_global_shortcuts,
            migrate_recurrence_dry_run,
            migrate_recurrence_apply,
            get_recurring_template_count,
            get_task_format,
            set_task_format,
            detect_task_format,
            get_task_marker,
            set_task_marker,
            get_folder_paths,
            set_folder_paths,
            get_excluded_paths,
            set_excluded_paths,
            set_annado_exclude_in_file,
            create_project,
            rename_project,
            create_person,
            rename_person,
            get_calendars,
            get_calendar_events,
            check_calendar_access,
            open_calendar_at_date,
            delete_calendar_event,
            get_is_obsidian_vault,
            set_is_obsidian_vault,
            get_opener_prefs,
            set_opener_prefs,
            run_custom_opener,
            show_main_window,
            open_task_in_main,
            get_notification_prefs,
            save_notification_prefs,
            set_tray_enabled,
            send_test_notification,
            detect_path_openers,
            refresh_path_openers,
            open_path_with,
            open_path_default,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Reopen { has_visible_windows, .. } = event {
                if !has_visible_windows {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        });
}
