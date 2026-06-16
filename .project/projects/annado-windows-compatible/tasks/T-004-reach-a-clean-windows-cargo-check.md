---
id: T-004
name: Reach a clean Windows cargo check
status: done
workstream: WS-A
created: 2026-06-16T13:38:07Z
updated: 2026-06-16T13:59:21Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src-tauri]
parallel: false
priority: high
estimate: S
story_id: US-001
acceptance_criteria_ids: [AC-001]
---

# Task: Reach a clean Windows cargo check

## Description

Run the Windows Rust check after compile-gate changes and fix any newly surfaced backend compile
errors.

## Acceptance Criteria

- [x] `cargo check --manifest-path src-tauri/Cargo.toml` passes on Windows.
- [x] Any follow-up compile errors found after `objc2` are fixed or converted into new tasks.
- [x] Evidence includes the passing command output summary.

## Technical Notes

This is a milestone task. Do not close it merely because the first `objc2` blocker is gone.

## Definition of Done

- [x] Windows Rust check passes
- [x] Remaining compile risks recorded
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T13:59:21Z: cargo check --manifest-path src-tauri/Cargo.toml passes on Windows. The only warning is the existing unused Vault::new dead-code warning; no follow-up compile errors remain in WS-A.

- 2026-06-16T13:58:38Z: Fix the Windows cargo check blocker surfaced after Apple dependency gating: RunEvent::Reopen is not available on Windows.

- 2026-06-16T13:38:07Z: Created from `.project/templates/task.md` by `delano task add`.
