---
id: T-010
name: Normalize internal vault paths across platforms
status: done
workstream: WS-B
created: 2026-06-16T13:38:08Z
updated: 2026-06-16T14:04:35Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src-tauri/src/parser.rs, src-tauri/src/vault.rs, src-tauri/src/commands.rs]
parallel: false
priority: high
estimate: L
story_id: US-002
acceptance_criteria_ids: [AC-002, AC-004]
---

# Task: Normalize internal vault paths across platforms

## Description

Define and implement a single internal path format for task file paths. Windows-native separators
must not leak into parser/grouping logic that expects `/`.

## Acceptance Criteria

- [x] Backend emits a consistent app-internal path format for task file paths.
- [x] Absolute filesystem paths are converted safely at command boundaries.
- [x] Task identity behavior is documented and tested when path normalization changes.
- [x] Existing macOS path behavior remains compatible.

## Technical Notes

Prefer vault-relative slash paths for app logic, with explicit conversion to native paths for file I/O.

## Definition of Done

- [x] Implementation complete
- [x] Rust tests cover Windows and macOS-style paths
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T14:04:35Z: Task.filePath now uses vault-relative slash paths; task IDs normalize path separators; file I/O resolves app paths under the vault. cargo check passes, cargo test --lib passes 25 tests, and npm run build passes.

- 2026-06-16T14:04:32Z: Implement vault-relative slash-normalized task paths and native path boundary conversion.

- 2026-06-16T13:38:08Z: Created from `.project/templates/task.md` by `delano task add`.
