# GUI Testing Policy

## Enforcement Mode

Advisory for docs/context-only changes. Required for UI, Tauri runtime, or platform compatibility
claims.

## Smoke Routes

- First launch with no vault selected: vault selector appears.
- Vault selection and task load from a test Markdown folder.
- Main task views: Inbox, Today, Upcoming, Anytime, Someday, Logbook, Recurring.
- Quick Add, Quick Find, task edit, complete, delete, and side panel.
- Agenda day/week scheduling when working on scheduling behavior.
- Settings tabs for General, Calendar, Shortcuts, Notifications, and About when related code changes.
- Tray popup, global shortcuts, notifications, deep links, and editor opening for desktop/platform
  work.

## Console Filtering

Unexpected browser console errors, Tauri command failures, Rust panics, unhandled promise
rejections, blank screens, or broken asset loads are blocking for UI/runtime claims.

## Evidence Requirements

For UI changes, record the route/flow exercised, platform, command used to launch the app, and any
screenshots or logs needed to reproduce findings. For Windows compatibility, capture both build/check
output and a manual smoke result before marking support as done.

## Design Validation Threshold

Annado should remain a dense, quiet desktop productivity app. Preserve readable task lists,
predictable keyboard behavior, stable modals/popovers, and non-overlapping text at normal desktop
window sizes.
