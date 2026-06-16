---
id: T-003
name: Make file/editor opening cross-platform
status: done
workstream: WS-A
created: 2026-06-16T13:38:07Z
updated: 2026-06-16T13:59:20Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src-tauri/src/commands.rs, src/utils/openInEditor.ts]
parallel: false
priority: high
estimate: M
story_id: US-002
acceptance_criteria_ids: [AC-002]
---

# Task: Make file/editor opening cross-platform

## Description

Replace macOS-only `open` usage in `open_file_in_editor` with platform-aware behavior. Handle system
open, VS Code, Sublime, and custom commands on Windows paths, including paths with spaces.

## Acceptance Criteria

- [x] System file open works on Windows without invoking macOS `open`.
- [x] Sublime behavior is defined for Windows or hidden when unavailable.
- [x] Custom command parsing handles quoted paths and `{file}` / `{line}` safely.
- [x] VS Code and Obsidian routes still work after path URL fixes in T-012.

## Technical Notes

Prefer Tauri opener APIs or platform-native Rust implementations over shell-specific string commands.

## Definition of Done

- [x] Implementation complete
- [x] Windows path with spaces tested
- [x] macOS editor behavior checked
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T13:59:20Z: System/Sublime opening no longer invokes macOS open from open_file_in_editor. Custom commands parse quoted program paths and preserve Windows file paths with spaces as one argument. cargo test editor_command_tests passed 3 tests; npm run build passed.

- 2026-06-16T13:57:01Z: Replace macOS-only editor launching with cross-platform opener behavior and safer custom command parsing.

- 2026-06-16T13:38:07Z: Created from `.project/templates/task.md` by `delano task add`.
