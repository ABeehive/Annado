---
id: T-001
name: Target-gate Apple-only Rust dependencies and modules
status: done
workstream: WS-A
created: 2026-06-16T13:38:07Z
updated: 2026-06-16T13:53:10Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src-tauri/Cargo.toml, src-tauri/src/calendar.rs, src-tauri/src/lib.rs]
parallel: false
priority: high
estimate: M
story_id: US-001
acceptance_criteria_ids: [AC-001, AC-005]
---

# Task: Target-gate Apple-only Rust dependencies and modules

## Description

Move Apple-only calendar dependencies and modules out of the Windows dependency graph. The current
Windows compile fails because `objc2` is compiled unconditionally.

## Acceptance Criteria

- [x] `objc2` and `block2` are target-specific macOS dependencies or otherwise absent from Windows builds.
- [x] EventKit/Foundation links are compiled only on macOS.
- [x] `mod calendar` and related imports are platform-safe.
- [x] macOS Calendar implementation remains available on macOS.

## Technical Notes

Use target-specific Cargo dependencies and platform modules/stubs rather than deleting macOS code.

## Definition of Done

- [x] Implementation complete
- [x] Windows `cargo check` progresses past the current `objc2` failure
- [x] macOS compile path reviewed
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T13:53:10Z: Direct block2/objc2 dependencies are macOS-target-specific; non-macOS builds use calendar_unsupported.rs; Windows cargo tree finds no objc2/block2, and cargo check now progresses to src/lib.rs RunEvent::Reopen.

- 2026-06-16T13:49:21Z: Begin target-gating Apple-only Rust dependencies and calendar module for Windows compatibility.

- 2026-06-16T13:38:07Z: Created from `.project/templates/task.md` by `delano task add`.
- 2026-06-16T13:40:00Z: Research evidence: Windows `cargo check` fails at `objc2`.
