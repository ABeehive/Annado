use serde::{Deserialize, Serialize};
use std::ffi::{c_void, CStr, CString};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CalendarInfo {
    pub id: String,
    pub name: String,
    pub color: String,
    pub account_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub calendar_name: String,
    pub calendar_color: String,
    pub start_date: String,
    pub end_date: String,
    pub is_all_day: bool,
    pub location: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
}

// --- Minimal ObjC runtime FFI for EventKit ---
type Id = *mut c_void;
type Sel = *mut c_void;
type Class = *mut c_void;
type BOOL = i8;

#[link(name = "EventKit", kind = "framework")]
extern "C" {}

#[link(name = "Foundation", kind = "framework")]
extern "C" {}

extern "C" {
    fn objc_getClass(name: *const i8) -> Class;
    fn sel_registerName(name: *const i8) -> Sel;
    fn objc_msgSend();
    fn dispatch_semaphore_create(value: isize) -> Id;
    fn dispatch_semaphore_signal(dsema: Id) -> isize;
    fn dispatch_semaphore_wait(dsema: Id, timeout: u64) -> isize;
}

const DISPATCH_TIME_FOREVER: u64 = !0; // UINT64_MAX

// Macro for objc message sends with different argument counts
macro_rules! msg_id {
    ($obj:expr, $sel:expr) => {{
        let f: unsafe extern "C" fn(Id, Sel) -> Id =
            std::mem::transmute(objc_msgSend as *const ());
        f($obj as Id, sel_reg($sel))
    }};
    ($obj:expr, $sel:expr, $a1:expr) => {{
        let f: unsafe extern "C" fn(Id, Sel, Id) -> Id =
            std::mem::transmute(objc_msgSend as *const ());
        f($obj as Id, sel_reg($sel), $a1 as Id)
    }};
    ($obj:expr, $sel:expr, $a1:expr, $a2:expr) => {{
        let f: unsafe extern "C" fn(Id, Sel, Id, Id) -> Id =
            std::mem::transmute(objc_msgSend as *const ());
        f($obj as Id, sel_reg($sel), $a1 as Id, $a2 as Id)
    }};
    ($obj:expr, $sel:expr, $a1:expr, $a2:expr, $a3:expr) => {{
        let f: unsafe extern "C" fn(Id, Sel, Id, Id, Id) -> Id =
            std::mem::transmute(objc_msgSend as *const ());
        f($obj as Id, sel_reg($sel), $a1 as Id, $a2 as Id, $a3 as Id)
    }};
}

macro_rules! msg_bool {
    ($obj:expr, $sel:expr) => {{
        let f: unsafe extern "C" fn(Id, Sel) -> BOOL =
            std::mem::transmute(objc_msgSend as *const ());
        f($obj as Id, sel_reg($sel))
    }};
}

macro_rules! msg_usize {
    ($obj:expr, $sel:expr) => {{
        let f: unsafe extern "C" fn(Id, Sel) -> usize =
            std::mem::transmute(objc_msgSend as *const ());
        f($obj as Id, sel_reg($sel))
    }};
}

macro_rules! msg_f64 {
    ($obj:expr, $sel:expr) => {{
        let f: unsafe extern "C" fn(Id, Sel) -> f64 =
            std::mem::transmute(objc_msgSend as *const ());
        f($obj as Id, sel_reg($sel))
    }};
}

#[inline]
fn sel_reg(name: &str) -> Sel {
    let cname = CString::new(name).unwrap();
    unsafe { sel_registerName(cname.as_ptr()) }
}

fn nsstring(s: &str) -> Id {
    unsafe {
        let cls = objc_getClass(c"NSString".as_ptr());
        let alloc = msg_id!(cls, "alloc");
        let f: unsafe extern "C" fn(Id, Sel, *const u8, usize, u64) -> Id =
            std::mem::transmute(objc_msgSend as *const ());
        f(alloc, sel_reg("initWithBytes:length:encoding:"), s.as_ptr(), s.len(), 4u64)
    }
}

fn from_nsstring(obj: Id) -> String {
    if obj.is_null() { return String::new(); }
    unsafe {
        let raw = msg_id!(obj, "UTF8String");
        if raw.is_null() { return String::new(); }
        CStr::from_ptr(raw as *const i8).to_string_lossy().into_owned()
    }
}

fn nsdate_to_iso(date: Id) -> String {
    if date.is_null() { return String::new(); }
    unsafe {
        // Use NSDateFormatter with ISO 8601
        let cls = objc_getClass(c"NSISO8601DateFormatter".as_ptr());
        let alloc = msg_id!(cls, "alloc");
        let formatter = msg_id!(alloc, "init");
        let result = msg_id!(formatter, "stringFromDate:", date);
        let s = from_nsstring(result);
        msg_id!(formatter, "release");
        s
    }
}

/// For all-day events: return "YYYY-MM-DD" using the system local timezone.
/// NSCalendar.currentCalendar respects the machine's timezone, so the result
/// is always the date the user sees on their system clock — not a UTC-shifted date.
fn nsdate_to_local_date_string(date: Id) -> String {
    if date.is_null() { return String::new(); }
    unsafe {
        let cal_cls = objc_getClass(c"NSCalendar".as_ptr());
        let cal = msg_id!(cal_cls, "currentCalendar");
        // NSCalendarUnitYear (4) | NSCalendarUnitMonth (8) | NSCalendarUnitDay (16) = 28
        let units: usize = 28;
        let components = msg_id!(cal, "components:fromDate:", units, date);
        let year  = msg_usize!(components, "year");
        let month = msg_usize!(components, "month");
        let day   = msg_usize!(components, "day");
        format!("{:04}-{:02}-{:02}", year, month, day)
    }
}

/// Get CGFloat components from NSColor/CIColor
fn color_to_hex(color: Id) -> String {
    if color.is_null() { return "#888888".to_string(); }
    unsafe {
        // Get CGColor, then create CIColor from it
        let cgcolor = msg_id!(color, "CGColor");
        if cgcolor.is_null() { return "#888888".to_string(); }

        let ci_cls = objc_getClass(c"CIColor".as_ptr());
        let ci_color = msg_id!(ci_cls, "colorWithCGColor:", cgcolor);
        if ci_color.is_null() { return "#888888".to_string(); }

        let r = msg_f64!(ci_color, "red");
        let g = msg_f64!(ci_color, "green");
        let b = msg_f64!(ci_color, "blue");

        format!("#{:02x}{:02x}{:02x}",
            (r * 255.0) as u8,
            (g * 255.0) as u8,
            (b * 255.0) as u8
        )
    }
}

pub fn check_calendar_permission() -> Result<bool, String> {
    unsafe {
        let cls = objc_getClass(c"EKEventStore".as_ptr());
        if cls.is_null() {
            return Err("EventKit not available".into());
        }
        // EKAuthorizationStatus for EKEntityTypeEvent (0)
        let f: unsafe extern "C" fn(Class, Sel, usize) -> isize =
            std::mem::transmute(objc_msgSend as *const ());
        let status = f(cls, sel_reg("authorizationStatusForEntityType:"), 0);

        match status {
            3 | 4 => Ok(true),  // authorized or fullAccess
            0 => {
                // Not determined — request access now
                let store = msg_id!(msg_id!(cls, "alloc"), "init");
                if store.is_null() {
                    return Err("Failed to create EKEventStore".into());
                }
                let granted = request_calendar_access(store)?;
                msg_id!(store, "release");
                Ok(granted)
            }
            _ => Ok(false), // denied, restricted, or writeOnly
        }
    }
}

pub fn fetch_calendars() -> Result<Vec<CalendarInfo>, String> {
    unsafe {
        let store = create_event_store()?;

        // Get calendars for events (EKEntityTypeEvent = 0)
        let f: unsafe extern "C" fn(Id, Sel, usize) -> Id =
            std::mem::transmute(objc_msgSend as *const ());
        let cals = f(store, sel_reg("calendarsForEntityType:"), 0);

        if cals.is_null() {
            msg_id!(store, "release");
            return Ok(vec![]);
        }

        let count = msg_usize!(cals, "count");
        let mut result = Vec::with_capacity(count);

        for i in 0..count {
            let f: unsafe extern "C" fn(Id, Sel, usize) -> Id =
                std::mem::transmute(objc_msgSend as *const ());
            let cal = f(cals, sel_reg("objectAtIndex:"), i);

            let title = from_nsstring(msg_id!(cal, "title"));
            let cal_id = from_nsstring(msg_id!(cal, "calendarIdentifier"));
            let color = color_to_hex(msg_id!(cal, "color"));
            let source = msg_id!(cal, "source");
            let account = if !source.is_null() {
                from_nsstring(msg_id!(source, "title"))
            } else {
                String::new()
            };

            result.push(CalendarInfo {
                id: cal_id,
                name: title,
                color,
                account_name: account,
            });
        }

        msg_id!(store, "release");
        Ok(result)
    }
}

pub fn fetch_events(
    calendar_names: Vec<String>,
    start_date: String,
    end_date: String,
) -> Result<Vec<CalendarEvent>, String> {
    unsafe {
        let store = create_event_store()?;

        // Parse ISO dates to NSDate
        let start_nsdate = iso_to_nsdate(&start_date)?;
        let end_nsdate = iso_to_nsdate(&end_date)?;

        // Get calendars, filter by name
        let f_cals: unsafe extern "C" fn(Id, Sel, usize) -> Id =
            std::mem::transmute(objc_msgSend as *const ());
        let all_cals = f_cals(store, sel_reg("calendarsForEntityType:"), 0);

        if all_cals.is_null() {
            msg_id!(store, "release");
            return Ok(vec![]);
        }

        // Build NSArray of matching calendars
        let mut_arr_cls = objc_getClass(c"NSMutableArray".as_ptr());
        let cal_array = msg_id!(msg_id!(mut_arr_cls, "alloc"), "init");
        let all_count = msg_usize!(all_cals, "count");

        // Also build a map of calendar colors
        let mut cal_colors: std::collections::HashMap<String, String> = std::collections::HashMap::new();

        for i in 0..all_count {
            let f: unsafe extern "C" fn(Id, Sel, usize) -> Id =
                std::mem::transmute(objc_msgSend as *const ());
            let cal = f(all_cals, sel_reg("objectAtIndex:"), i);
            let name = from_nsstring(msg_id!(cal, "title"));
            if calendar_names.contains(&name) {
                msg_id!(cal_array, "addObject:", cal);
                let color = color_to_hex(msg_id!(cal, "color"));
                cal_colors.insert(name, color);
            }
        }

        // Create predicate: predicateForEventsWithStartDate:endDate:calendars:
        let predicate = msg_id!(store, "predicateForEventsWithStartDate:endDate:calendars:",
            start_nsdate, end_nsdate, cal_array);

        if predicate.is_null() {
            msg_id!(cal_array, "release");
            msg_id!(store, "release");
            return Ok(vec![]);
        }

        // Fetch events matching predicate
        let events = msg_id!(store, "eventsMatchingPredicate:", predicate);

        if events.is_null() {
            msg_id!(cal_array, "release");
            msg_id!(store, "release");
            return Ok(vec![]);
        }

        let event_count = msg_usize!(events, "count");
        let mut result = Vec::with_capacity(event_count);

        for i in 0..event_count {
            let f: unsafe extern "C" fn(Id, Sel, usize) -> Id =
                std::mem::transmute(objc_msgSend as *const ());
            let ev = f(events, sel_reg("objectAtIndex:"), i);

            let title = from_nsstring(msg_id!(ev, "title"));
            let event_id = from_nsstring(msg_id!(ev, "eventIdentifier"));
            let sd = msg_id!(ev, "startDate");
            let ed = msg_id!(ev, "endDate");
            let is_all_day = msg_bool!(ev, "isAllDay") != 0;
            let location = {
                let loc = msg_id!(ev, "location");
                let s = from_nsstring(loc);
                if s.is_empty() { None } else { Some(s) }
            };
            let url = {
                let url_obj = msg_id!(ev, "URL");
                if url_obj.is_null() {
                    None
                } else {
                    let s = from_nsstring(msg_id!(url_obj, "absoluteString"));
                    if s.is_empty() { None } else { Some(s) }
                }
            };
            let notes = {
                let n = msg_id!(ev, "notes");
                let s = from_nsstring(n);
                if s.is_empty() { None } else { Some(s) }
            };
            let cal = msg_id!(ev, "calendar");
            let cal_name = from_nsstring(msg_id!(cal, "title"));
            let cal_color = cal_colors.get(&cal_name).cloned().unwrap_or_else(|| "#888888".to_string());

            result.push(CalendarEvent {
                id: event_id,
                title,
                calendar_name: cal_name,
                calendar_color: cal_color,
                start_date: if is_all_day { nsdate_to_local_date_string(sd) } else { nsdate_to_iso(sd) },
                end_date:   if is_all_day { nsdate_to_local_date_string(ed) } else { nsdate_to_iso(ed) },
                is_all_day,
                location,
                url,
                notes,
            });
        }

        msg_id!(cal_array, "release");
        msg_id!(store, "release");
        Ok(result)
    }
}

/// Create and authorize an EKEventStore, requesting access if needed
unsafe fn create_event_store() -> Result<Id, String> {
    let cls = objc_getClass(c"EKEventStore".as_ptr());
    if cls.is_null() {
        return Err("EventKit not available".into());
    }

    let store = msg_id!(msg_id!(cls, "alloc"), "init");
    if store.is_null() {
        return Err("Failed to create EKEventStore".into());
    }

    // Check authorization status
    let f: unsafe extern "C" fn(Class, Sel, usize) -> isize =
        std::mem::transmute(objc_msgSend as *const ());
    let status = f(cls, sel_reg("authorizationStatusForEntityType:"), 0);

    // 0 = notDetermined, 1 = restricted, 2 = denied, 3 = authorized (deprecated), 4 = fullAccess
    match status {
        3 | 4 => return Ok(store), // already authorized
        0 => {
            // Not determined — request access using block2
            let granted = request_calendar_access(store)?;
            if granted {
                return Ok(store);
            }
            msg_id!(store, "release");
            return Err("Calendar access was denied. Please grant Full Access in System Settings > Privacy & Security > Calendars.".into());
        }
        _ => {
            msg_id!(store, "release");
            return Err(format!(
                "Calendar access denied (status={}). Please grant Full Access in System Settings > Privacy & Security > Calendars.",
                status
            ));
        }
    }
}

/// Request calendar access using requestFullAccessToEventsWithCompletion:
/// Blocks the current thread until the user responds to the permission prompt.
unsafe fn request_calendar_access(store: Id) -> Result<bool, String> {
    use block2::RcBlock;

    let sem = dispatch_semaphore_create(0);
    let granted = Arc::new(AtomicBool::new(false));
    let granted_clone = granted.clone();
    let sem_for_block = sem;

    let block = RcBlock::new(move |success: BOOL, _error: *mut c_void| {
        granted_clone.store(success != 0, Ordering::SeqCst);
        dispatch_semaphore_signal(sem_for_block);
    });

    // Call [store requestFullAccessToEventsWithCompletion:block]
    let send: unsafe extern "C" fn(Id, Sel, *mut c_void) =
        std::mem::transmute(objc_msgSend as *const ());
    send(
        store,
        sel_reg("requestFullAccessToEventsWithCompletion:"),
        &*block as *const _ as *mut c_void,
    );

    dispatch_semaphore_wait(sem, DISPATCH_TIME_FOREVER);

    Ok(granted.load(Ordering::SeqCst))
}

pub fn open_calendar_at_date(_date: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg("-a")
        .arg("Calendar")
        .spawn()
        .map_err(|e| format!("Failed to open Calendar: {}", e))?;
    Ok(())
}

pub fn delete_event(event_id: String) -> Result<(), String> {
    unsafe {
        let store = create_event_store()?;
        let ns_id = nsstring(&event_id);
        let event = msg_id!(store, "eventWithIdentifier:", ns_id);
        msg_id!(ns_id, "release");
        if event.is_null() {
            msg_id!(store, "release");
            return Err("Event not found".into());
        }
        // removeEvent:span:error: — span=0 means this event only
        let f: unsafe extern "C" fn(Id, Sel, Id, isize, *mut Id) -> BOOL =
            std::mem::transmute(objc_msgSend as *const ());
        let mut error: Id = std::ptr::null_mut();
        let success = f(store, sel_reg("removeEvent:span:error:"), event, 0, &mut error);
        if success == 0 {
            let err_msg = if !error.is_null() {
                from_nsstring(msg_id!(error, "localizedDescription"))
            } else {
                "Unknown error".into()
            };
            msg_id!(store, "release");
            return Err(format!("Failed to delete event: {}", err_msg));
        }
        msg_id!(store, "release");
        Ok(())
    }
}

/// Parse ISO 8601 string to NSDate
unsafe fn iso_to_nsdate(iso: &str) -> Result<Id, String> {
    // Strip fractional seconds (.000) — NSISO8601DateFormatter can't parse them by default
    // "2026-02-15T00:00:00.000Z" → "2026-02-15T00:00:00Z"
    let clean = if let Some(dot) = iso.rfind('.') {
        if let Some(rest) = iso.get(dot..).and_then(|s| s.find(|c: char| !c.is_ascii_digit() && c != '.').map(|i| &s[i..])) {
            format!("{}{}", &iso[..dot], rest)
        } else {
            iso.to_string()
        }
    } else {
        iso.to_string()
    };

    let cls = objc_getClass(c"NSISO8601DateFormatter".as_ptr());
    let alloc = msg_id!(cls, "alloc");
    let formatter = msg_id!(alloc, "init");
    let ns_str = nsstring(&clean);
    let date = msg_id!(formatter, "dateFromString:", ns_str);
    msg_id!(ns_str, "release");
    msg_id!(formatter, "release");
    if date.is_null() {
        return Err(format!("Failed to parse date: {} (cleaned: {})", iso, clean));
    }
    Ok(date)
}
