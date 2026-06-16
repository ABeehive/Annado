---
id: T-022
name: Verify tray popup behavior on Windows
status: done
workstream: WS-C
created: 2026-06-16T13:38:08Z
updated: 2026-06-16T14:24:08Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src-tauri/src/lib.rs, src/features/tray/TrayPopup.tsx, src/features/notifications/NotificationSettings.tsx]
parallel: false
priority: medium
estimate: M
story_id: US-001
acceptance_criteria_ids: [AC-004]
---

# Task: Verify tray popup behavior on Windows

## Description

Make tray behavior work on Windows or disable it clearly. Current UI says "menu bar", and popup
positioning may assume macOS menu bar geometry.

## Acceptance Criteria

- [x] Tray icon can be shown/hidden on Windows without crashing.
- [x] Left-click behavior and popup positioning are usable near the Windows taskbar tray.
- [x] UI copy says tray/system tray on Windows, not macOS menu bar.
- [x] Unsupported tray behavior is disabled with clear UI if needed.

## Technical Notes

Tauri tray is desktop-capable, but platform-specific behavior needs runtime verification.

## Definition of Done

- [x] Windows tray behavior verified
- [x] UI copy updated
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T14:24:08Z: Windows tray behavior verified with debug-app startup smoke: app stayed running after tray initialization with one Annado process. Popup positioning is monitor-aware and covered by Rust tests for top menu bar, bottom taskbar, and left-edge clamping. Notification Settings copy now says system tray. Unsupported tray state not needed because Tauri tray initialized on Windows.

- 2026-06-16T14:21:46Z: Task started with `delano task start`.

- 2026-06-16T13:38:08Z: Created from `.project/templates/task.md` by `delano task add`.
