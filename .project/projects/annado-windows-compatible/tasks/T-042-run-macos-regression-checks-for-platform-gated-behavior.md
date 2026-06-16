---
id: T-042
name: Run macOS regression checks for platform-gated behavior
status: blocked
workstream: WS-E
created: 2026-06-16T13:38:09Z
updated: 2026-06-16T16:00:43Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: []
parallel: false
priority: high
estimate: M
story_id: US-003
acceptance_criteria_ids: [AC-005]
blocked_owner: maintainer with macOS machine
blocked_check_back: 2026-06-17
---

# Task: Run macOS regression checks for platform-gated behavior

## Description

Verify that platform-gating and Windows work did not remove or break existing macOS behavior.

## Acceptance Criteria

- [ ] macOS Rust/Tauri build or maintainer-approved equivalent check passes.
- [ ] macOS Calendar/EventKit functionality still compiles and is reachable.
- [ ] macOS titlebar overlay/drag region remains usable.
- [ ] macOS shortcuts and editor opening remain correct.
- [ ] Evidence records commands and any manual checks.

## Technical Notes

This task may require a macOS machine. If unavailable, record the gap and do not close the project.

## Definition of Done

- [ ] macOS regression evidence recorded
- [ ] Any regressions fixed or converted into tasks

## Evidence Log

- 2026-06-16T16:12:17Z: Prepared maintainer-facing macOS verification checklist at
  `.project/projects/annado-windows-compatible/artifacts/macos-regression-verification-checklist.md`
  with required macOS commands, manual titlebar/shortcut/editor/Calendar checks, evidence artifacts,
  and Delano closeout commands. Task remains blocked until macOS evidence is produced.

- 2026-06-16T16:00:43Z: Requires macOS host or Darwin C/Objective-C toolchain to verify macOS Tauri/EventKit compile and titlebar behavior.

- 2026-06-16T15:59:27Z: Running available platform-gate checks from Windows; true macOS verification may remain blocked.

- 2026-06-16T13:38:09Z: Created from `.project/templates/task.md` by `delano task add`.
