---
id: T-021
name: Handle Windows deep links with single-instance behavior
status: done
workstream: WS-C
created: 2026-06-16T13:38:08Z
updated: 2026-06-16T14:20:59Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src-tauri/Cargo.toml, src-tauri/src/lib.rs, src/hooks/useAppEvents.ts]
parallel: false
priority: medium
estimate: M
story_id: US-001
acceptance_criteria_ids: [AC-004]
---

# Task: Handle Windows deep links with single-instance behavior

## Description

Verify and implement warm/cold `annado://` behavior on Windows. Tauri docs note Windows deep links are
delivered as command-line arguments to a new process unless single-instance routing is used.

## Acceptance Criteria

- [x] Cold-start `annado://quickadd?...` works on Windows.
- [x] Warm deep links route to the running app or an explicit single-instance strategy is implemented.
- [x] Multiple unwanted app instances are not created for normal deep-link use.
- [x] Existing macOS deep-link behavior is preserved.

## Technical Notes

Consider `tauri-plugin-single-instance` with the deep-link feature if needed.

## Definition of Done

- [x] Implementation complete
- [x] Windows deep-link smoke evidence recorded
- [x] macOS behavior checked

## Evidence Log

- 2026-06-16T14:20:59Z: Windows deep-link single-instance behavior implemented and smoke-tested: cold annado://quickadd launch remained running; warm annado://quickadd launch exited; process count stayed at one. cargo check and cargo test --lib passed; single-instance dependency has deep-link feature enabled. Existing macOS deep-link handler was left intact by code inspection; runtime macOS verification remains part of T-042.

- 2026-06-16T14:18:08Z: Task started with `delano task start`.

- 2026-06-16T13:38:08Z: Created from `.project/templates/task.md` by `delano task add`.
