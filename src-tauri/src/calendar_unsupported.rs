pub use crate::calendar_types::{CalendarEvent, CalendarInfo};

const UNSUPPORTED_MESSAGE: &str = "Calendar integration is only available on macOS.";

pub fn check_calendar_permission() -> Result<bool, String> {
    Err(UNSUPPORTED_MESSAGE.to_string())
}

pub fn fetch_calendars() -> Result<Vec<CalendarInfo>, String> {
    Err(UNSUPPORTED_MESSAGE.to_string())
}

pub fn fetch_events(
    _calendar_names: Vec<String>,
    _start_date: String,
    _end_date: String,
) -> Result<Vec<CalendarEvent>, String> {
    Err(UNSUPPORTED_MESSAGE.to_string())
}

pub fn open_calendar_at_date(_date: String) -> Result<(), String> {
    Err(UNSUPPORTED_MESSAGE.to_string())
}

pub fn delete_event(_event_id: String) -> Result<(), String> {
    Err(UNSUPPORTED_MESSAGE.to_string())
}
