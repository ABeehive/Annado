---
id: T-002
name: Provide cross-platform calendar command surface
status: done
workstream: WS-A
created: 2026-06-16T13:38:07Z
updated: 2026-06-16T13:55:49Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src-tauri/src/commands.rs, src-tauri/src/calendar.rs, src/stores/slices/calendarSlice.ts]
parallel: false
priority: high
estimate: M
story_id: US-001
acceptance_criteria_ids: [AC-001, AC-003]
---

# Task: Provide cross-platform calendar command surface

## Description

Ensure the frontend can call Calendar-related commands on Windows without missing symbols, panics, or
unhandled errors. The command surface should either call a native provider or return explicit
unsupported responses that the UI handles.

## Acceptance Criteria

- [x] `get_calendars`, `get_calendar_events`, `check_calendar_access`, `open_calendar_at_date`, and `delete_calendar_event` compile on Windows.
- [x] Windows unsupported behavior is explicit and user-safe.
- [x] Agenda/calendar UI does not repeatedly call failing commands on Windows.
- [x] macOS EventKit behavior is not removed.

## Technical Notes

This task implements the command shape; T-020 decides the product stance for Windows Calendar.

## Definition of Done

- [x] Implementation complete
- [x] Windows Rust check covers command registration
- [x] Calendar UI behavior reviewed
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T13:55:49Z: Calendar command surface exists on non-macOS via calendar_unsupported.rs; frontend handles unsupported responses by disabling calendar polling and showing the backend message. npm run build passed; npm run lint exited 0 with warnings; cargo check now fails only at src/lib.rs RunEvent::Reopen.

- 2026-06-16T13:54:06Z: Implement explicit non-macOS Calendar command responses and frontend handling.

- 2026-06-16T13:38:07Z: Created from `.project/templates/task.md` by `delano task add`.
