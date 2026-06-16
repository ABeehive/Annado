---
id: T-013
name: Add Windows path regression tests
status: done
workstream: WS-B
created: 2026-06-16T13:38:08Z
updated: 2026-06-16T14:12:51Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src-tauri/src/parser.rs, src-tauri/src/vault.rs, src/utils]
parallel: false
priority: high
estimate: M
story_id: US-002
acceptance_criteria_ids: [AC-002]
---

# Task: Add Windows path regression tests

## Description

Add focused tests that prevent Windows path support from regressing after the compatibility work.

## Acceptance Criteria

- [x] Rust tests cover project/person derivation, exclusions, recurring folder skip, and task parsing with Windows paths.
- [x] Vitest tests cover Obsidian URL, VS Code URL, and vault-name handling with Windows paths.
- [x] Tests also include at least one POSIX case to prove macOS behavior remains intact.

## Technical Notes

Tests should not require a private vault path. Use synthetic paths and temporary test data only.

## Definition of Done

- [x] Tests implemented
- [x] Relevant Rust and Vitest commands pass
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T14:12:51Z: Windows path regression tests are implemented and passing: cargo test --manifest-path src-tauri\\Cargo.toml --lib passed 30 tests; npm run test -- obsidian openInEditor MarkdownNotesRenderer passed 3 files / 11 tests.

- 2026-06-16T14:12:09Z: Task started with `delano task start`.

- 2026-06-16T13:38:08Z: Created from `.project/templates/task.md` by `delano task add`.
