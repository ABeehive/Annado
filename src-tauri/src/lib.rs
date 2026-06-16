#[cfg(target_os = "macos")]
mod calendar;
#[cfg(not(target_os = "macos"))]
#[path = "calendar_unsupported.rs"]
mod calendar;
mod calendar_types;
mod commands;
mod notification_scheduler;
mod parser;
mod vault;

use commands::{
    check_calendar_access, create_person, create_project, create_recurring_template, create_task,
    delete_calendar_event, delete_checklist_item, delete_recurring_template, delete_task,
    generate_recurring_instances, get_all_persons, get_all_projects, get_all_recurring_templates,
    get_all_tags, get_calendar_events, get_calendars, get_editor_config, get_excluded_paths,
    get_folder_paths, get_is_obsidian_vault, get_notification_prefs, get_person_metadata,
    get_platform, get_task, get_tasks, get_vault_path, open_calendar_at_date, open_file_in_editor,
    open_task_in_main, rename_checklist_item, rename_person, rename_project, rescan_vault,
    save_notification_prefs, send_test_notification, set_annado_exclude_in_file, set_editor_config,
    set_excluded_paths, set_folder_paths, set_is_obsidian_vault, set_tray_enabled, set_vault_path,
    show_main_window, toggle_checklist_item, toggle_task_complete, update_project_metadata,
    update_recurring_template, update_task,
};
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

static PENDING_DEEP_LINK: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));
static QUICK_ADD_SHORTCUT_ID: Lazy<Mutex<Option<u32>>> = Lazy::new(|| Mutex::new(None));
static SHOW_APP_SHORTCUT_ID: Lazy<Mutex<Option<u32>>> = Lazy::new(|| Mutex::new(None));
static TRAY_POPUP_VISIBLE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

const TRAY_POPUP_WIDTH: f64 = 320.0;
const TRAY_POPUP_HEIGHT: f64 = 480.0;
const TRAY_POPUP_GAP: f64 = 8.0;

#[cfg(target_os = "windows")]
const DEFAULT_QUICK_ADD: &str = "ctrl+alt+space";
#[cfg(not(target_os = "windows"))]
const DEFAULT_QUICK_ADD: &str = "meta+shift+space";
#[cfg(target_os = "windows")]
const DEFAULT_SHOW_APP: &str = "ctrl+alt+a";
#[cfg(not(target_os = "windows"))]
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
        "a" => Code::KeyA,
        "b" => Code::KeyB,
        "c" => Code::KeyC,
        "d" => Code::KeyD,
        "e" => Code::KeyE,
        "f" => Code::KeyF,
        "g" => Code::KeyG,
        "h" => Code::KeyH,
        "i" => Code::KeyI,
        "j" => Code::KeyJ,
        "k" => Code::KeyK,
        "l" => Code::KeyL,
        "m" => Code::KeyM,
        "n" => Code::KeyN,
        "o" => Code::KeyO,
        "p" => Code::KeyP,
        "q" => Code::KeyQ,
        "r" => Code::KeyR,
        "s" => Code::KeyS,
        "t" => Code::KeyT,
        "u" => Code::KeyU,
        "v" => Code::KeyV,
        "w" => Code::KeyW,
        "x" => Code::KeyX,
        "y" => Code::KeyY,
        "z" => Code::KeyZ,
        "0" => Code::Digit0,
        "1" => Code::Digit1,
        "2" => Code::Digit2,
        "3" => Code::Digit3,
        "4" => Code::Digit4,
        "5" => Code::Digit5,
        "6" => Code::Digit6,
        "7" => Code::Digit7,
        "8" => Code::Digit8,
        "9" => Code::Digit9,
        "enter" | "return" => Code::Enter,
        "escape" | "esc" => Code::Escape,
        "backspace" => Code::Backspace,
        "tab" => Code::Tab,
        _ => return None,
    };

    Some((modifiers, code))
}

#[tauri::command]
fn register_global_shortcuts(
    app: AppHandle,
    quick_add_binding: String,
    show_app_binding: String,
) -> Result<(), String> {
    if cfg!(debug_assertions) {
        eprintln!(
            "[shortcuts] register_global_shortcuts called: qa='{}', sa='{}'",
            quick_add_binding, show_app_binding
        );
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
                eprintln!(
                    "[shortcuts] WARN: invalid keybinding '{}', falling back to '{}'",
                    qa_binding, DEFAULT_QUICK_ADD
                );
            }
            parse_keybinding(DEFAULT_QUICK_ADD)
        })
        .ok_or_else(|| "Failed to parse default keybinding".to_string())?;
    let qa_shortcut = Shortcut::new(Some(qa_modifiers), qa_code);
    if cfg!(debug_assertions) {
        eprintln!(
            "[shortcuts] parsed quick_add: modifiers={:?}, code={:?}, id={}",
            qa_modifiers,
            qa_code,
            qa_shortcut.id()
        );
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
                eprintln!(
                    "[shortcuts] WARN: invalid keybinding '{}', falling back to '{}'",
                    sa_binding, DEFAULT_SHOW_APP
                );
            }
            parse_keybinding(DEFAULT_SHOW_APP)
        })
        .ok_or_else(|| "Failed to parse default keybinding".to_string())?;
    let sa_shortcut = Shortcut::new(Some(sa_modifiers), sa_code);
    if cfg!(debug_assertions) {
        eprintln!(
            "[shortcuts] parsed show_app: modifiers={:?}, code={:?}, id={}",
            sa_modifiers,
            sa_code,
            sa_shortcut.id()
        );
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

#[derive(Clone, Copy)]
struct MonitorBounds {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

fn clamp_to_bounds(value: i32, min: i32, max: i32) -> i32 {
    if max < min {
        min
    } else {
        value.clamp(min, max)
    }
}

fn calculate_popup_position(
    click_x: i32,
    click_y: i32,
    popup_width: i32,
    popup_height: i32,
    gap: i32,
    bounds: MonitorBounds,
) -> tauri::PhysicalPosition<i32> {
    let min_x = bounds.x;
    let min_y = bounds.y;
    let max_x = bounds.x + bounds.width - popup_width;
    let max_y = bounds.y + bounds.height - popup_height;

    let x = clamp_to_bounds(click_x - popup_width / 2, min_x, max_x);
    let space_below_click = bounds.y + bounds.height - click_y;
    let preferred_y = if space_below_click >= popup_height + gap {
        click_y + gap
    } else {
        click_y - popup_height - gap
    };
    let y = clamp_to_bounds(preferred_y, min_y, max_y);

    tauri::PhysicalPosition { x, y }
}

fn monitor_bounds_for_click(
    popup: &tauri::WebviewWindow,
    click_x: i32,
    click_y: i32,
) -> Option<MonitorBounds> {
    let monitors = popup.available_monitors().ok()?;
    let monitor = monitors
        .iter()
        .find(|monitor| {
            let position = monitor.position();
            let size = monitor.size();
            let max_x = position.x + size.width as i32;
            let max_y = position.y + size.height as i32;
            click_x >= position.x && click_x < max_x && click_y >= position.y && click_y < max_y
        })
        .or_else(|| monitors.first())?;
    let position = monitor.position();
    let size = monitor.size();

    Some(MonitorBounds {
        x: position.x,
        y: position.y,
        width: size.width as i32,
        height: size.height as i32,
    })
}

fn position_popup(popup: &tauri::WebviewWindow, click: tauri::PhysicalPosition<f64>) {
    let scale = popup.scale_factor().unwrap_or(1.0);
    let popup_width = (TRAY_POPUP_WIDTH * scale).round() as i32;
    let popup_height = (TRAY_POPUP_HEIGHT * scale).round() as i32;
    let gap = (TRAY_POPUP_GAP * scale).round() as i32;
    let click_x = click.x.round() as i32;
    let click_y = click.y.round() as i32;
    let bounds = monitor_bounds_for_click(popup, click_x, click_y).unwrap_or(MonitorBounds {
        x: 0,
        y: 0,
        width: popup_width.max(click_x + popup_width),
        height: (click_y + popup_height + gap).max(popup_height),
    });
    let position =
        calculate_popup_position(click_x, click_y, popup_width, popup_height, gap, bounds);
    let _ = popup.set_position(tauri::Position::Physical(position));
}

#[cfg(test)]
mod tray_position_tests {
    use super::{calculate_popup_position, MonitorBounds};

    #[test]
    fn positions_below_top_menu_bar_click() {
        let position = calculate_popup_position(
            960,
            24,
            320,
            480,
            8,
            MonitorBounds {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            },
        );

        assert_eq!(position.x, 800);
        assert_eq!(position.y, 32);
    }

    #[test]
    fn positions_above_bottom_taskbar_click() {
        let position = calculate_popup_position(
            1800,
            1050,
            320,
            480,
            8,
            MonitorBounds {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            },
        );

        assert_eq!(position.x, 1600);
        assert_eq!(position.y, 562);
    }

    #[test]
    fn clamps_to_monitor_left_edge() {
        let position = calculate_popup_position(
            12,
            1050,
            320,
            480,
            8,
            MonitorBounds {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            },
        );

        assert_eq!(position.x, 0);
        assert_eq!(position.y, 562);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if cfg!(debug_assertions) {
                        eprintln!(
                            "[shortcuts] handler fired! shortcut_id={}, state={:?}",
                            shortcut.id(),
                            event.state()
                        );
                    }

                    if event.state() != ShortcutState::Pressed {
                        return;
                    }

                    let qa_id = QUICK_ADD_SHORTCUT_ID.lock();
                    let sa_id = SHOW_APP_SHORTCUT_ID.lock();

                    if cfg!(debug_assertions) {
                        eprintln!(
                            "[shortcuts] comparing: shortcut_id={}, qa_id={:?}, sa_id={:?}",
                            shortcut.id(),
                            *qa_id,
                            *sa_id
                        );
                    }

                    let is_quick_add = qa_id.map_or(false, |id| id == shortcut.id());
                    let is_show_app = sa_id.map_or(false, |id| id == shortcut.id());

                    if is_quick_add || is_show_app {
                        if cfg!(debug_assertions) {
                            eprintln!(
                                "[shortcuts] matched! quick_add={}, show_app={}",
                                is_quick_add, is_show_app
                            );
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
                let is_valid_deep_link =
                    |url_str: &str| -> bool { url_str.starts_with("annado://") };

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
                        } = event
                        {
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
            get_platform,
            set_vault_path,
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
            get_all_recurring_templates,
            create_recurring_template,
            update_recurring_template,
            delete_recurring_template,
            generate_recurring_instances,
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
            get_editor_config,
            set_editor_config,
            open_file_in_editor,
            show_main_window,
            open_task_in_main,
            get_notification_prefs,
            save_notification_prefs,
            set_tray_enabled,
            send_test_notification,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            {
                if let tauri::RunEvent::Reopen {
                    has_visible_windows,
                    ..
                } = event
                {
                    if !has_visible_windows {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app_handle, event);
            }
        });
}
