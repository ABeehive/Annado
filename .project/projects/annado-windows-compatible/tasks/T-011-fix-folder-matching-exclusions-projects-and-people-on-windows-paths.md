---
id: T-011
name: Fix folder matching, exclusions, projects, and people on Windows paths
status: done
workstream: WS-B
created: 2026-06-16T13:38:08Z
updated: 2026-06-16T14:07:43Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src-tauri/src/parser.rs, src-tauri/src/vault.rs]
parallel: false
priority: high
estimate: M
story_id: US-002
acceptance_criteria_ids: [AC-002, AC-004]
---

# Task: Fix folder matching, exclusions, projects, and people on Windows paths

## Description

Repair path-sensitive logic that currently uses slash-splitting or slash-pattern matching for
projects, people, areas, recurring templates, and excluded paths.

## Acceptance Criteria

- [x] `derive_project_name_with_pattern` works for Windows path examples.
- [x] `get_all_projects` and `get_all_persons` compute depth, parent, and names correctly on Windows.
- [x] Excluded file and folder patterns work with Windows filesystem paths and documented slash-style patterns.
- [x] Recurring template folder skipping works on Windows.

## Technical Notes

Use `Path` components or normalized slash strings consistently; avoid ad hoc separator checks.

## Definition of Done

- [x] Implementation complete
- [x] Rust regression tests added
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T14:07:43Z: Path-sensitive folder logic now uses slash-normalized matching. get_all_projects/get_all_persons emit app-relative slash paths and compute nested depth/parent under native paths. cargo test --lib passed 29 tests; cargo check and npm run build passed.

- 2026-06-16T14:05:19Z: Normalize folder matching, exclusions, project/person discovery, and recurring folder checks for Windows separators.

- 2026-06-16T13:38:08Z: Created from `.project/templates/task.md` by `delano task add`.
