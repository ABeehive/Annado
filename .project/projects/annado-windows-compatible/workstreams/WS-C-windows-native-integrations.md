---
id: WS-C
name: WS-C Windows Native Integrations
owner: team
status: done
created: 2026-06-16T13:37:49Z
updated: 2026-06-16T14:26:14Z
---

# Workstream: WS-C Windows Native Integrations

## Objective

Make native desktop integrations behave predictably on Windows, either through native support or
explicit unsupported-state UI.

## Owned Files/Areas

- `src-tauri/src/calendar.rs` or replacement platform modules
- `src-tauri/src/lib.rs`
- `src-tauri/src/commands.rs`
- `src/stores/slices/calendarSlice.ts`
- `src/features/notifications/NotificationSettings.tsx`
- `src/features/tray/TrayPopup.tsx`
- deep-link and notification settings

## Dependencies

- Calendar command surface from WS-A.
- Platform detection and UX copy from WS-D may be needed.

## Risks

- Windows Calendar provider work can expand scope significantly.
- Deep links may create multiple app instances unless single-instance routing is implemented.
- Tray positioning and notifications require real runtime testing.

## Handoff Criteria

- Calendar, deep link, tray, and notification behavior is either implemented or explicitly disabled on
  Windows.
- No Windows UI path calls a native command that panics or returns an unhandled error.
- Manual Windows evidence covers supported integrations.
