---
id: T-020
name: Define and gate Windows Calendar behavior
status: done
workstream: WS-C
created: 2026-06-16T13:38:08Z
updated: 2026-06-16T14:17:11Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src/stores/slices/calendarSlice.ts, src/components/SettingsModal.tsx, src/features/agenda]
parallel: false
priority: high
estimate: M
story_id: US-001
acceptance_criteria_ids: [AC-003]
---

# Task: Define and gate Windows Calendar behavior

## Description

Decide whether Windows Calendar is unsupported initially or implemented through a Windows-native
provider. Then make the UI and state behavior match that decision.

## Acceptance Criteria

- [x] Product decision is recorded in `decisions.md`.
- [x] Calendar settings and Agenda event overlays are disabled, hidden, or implemented on Windows.
- [x] Auto-scheduling remains usable without Calendar events.
- [x] No Windows flow repeatedly logs Calendar command failures.

## Technical Notes

Core Windows support may ship without Calendar parity if the unsupported state is explicit.

## Definition of Done

- [x] Decision recorded
- [x] UI state implemented
- [x] Windows behavior manually checked or queued for T-041
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T14:17:11Z: Windows Calendar decision and gating complete. D-005 records unsupported-first Windows Calendar behavior; Settings shows unsupported state on Windows while schedule controls remain usable; store disables calendar events and polling for unsupported platforms; calendarSlice tests, npm build, and cargo check passed. Windows manual runtime confirmation remains queued for T-041.

- 2026-06-16T14:14:08Z: Task started with `delano task start`.

- 2026-06-16T13:38:08Z: Created from `.project/templates/task.md` by `delano task add`.
