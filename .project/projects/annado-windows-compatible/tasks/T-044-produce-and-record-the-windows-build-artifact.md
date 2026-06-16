---
id: T-044
name: Produce and record the Windows build artifact
status: blocked
workstream: WS-E
created: 2026-06-16T13:38:09Z
updated: 2026-06-16T16:10:12Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: []
parallel: false
priority: high
estimate: M
story_id: US-001
acceptance_criteria_ids: [AC-001, AC-004, AC-005]
blocked_owner: maintainer with macOS machine
blocked_check_back: 2026-06-17
---

# Task: Produce and record the Windows build artifact

## Description

Create the final Windows build artifact and record evidence sufficient to close the compatibility
project.

## Acceptance Criteria

- [x] `npm run tauri -- build` succeeds on Windows.
- [x] Generated artifact name/path and installer type are recorded.
- [x] Windows core workflow smoke evidence from T-041 is linked.
- [ ] macOS regression evidence from T-042 is linked.
- [x] Any remaining unsupported features are documented before project closeout.

## Technical Notes

This is the final outcome task. Do not close it until the artifact exists and evidence is recorded.

## Definition of Done

- [x] Windows artifact built
- [x] Evidence recorded in Delano
- [ ] Project closeout can proceed

## Evidence Log

- 2026-06-16T16:12:17Z: Added the remaining macOS verification handoff artifact at
  `.project/projects/annado-windows-compatible/artifacts/macos-regression-verification-checklist.md`
  so T-044 can be completed once T-042 evidence is returned.

- 2026-06-16T16:10:12Z: Windows artifact is produced, but final task requires T-042 macOS regression evidence before project closeout.

- 2026-06-16T16:09:40Z: `npm run tauri -- build` passed on Windows and produced the release NSIS
  installer at `src-tauri/target/release/bundle/nsis/Annado_0.1.2_x64-setup.exe` (3,101,323 bytes,
  SHA-256 `AD098C52A3E3B6EEB2EF7E2B8DA07419C5E637E4065325A145A048117A7C862A`). T-041 smoke evidence:
  `.project/projects/annado-windows-compatible/artifacts/windows-core-workflow-smoke3-result.txt`.
  T-043 docs evidence records the Windows Calendar limitation and unsigned artifact/signing caveat.
  T-042 macOS regression remains blocked pending macOS maintainer/toolchain evidence, so this final
  outcome task is not ready to close.

- 2026-06-16T16:07:37Z: Producing final Windows build artifact evidence; macOS regression link remains blocked by T-042.

- 2026-06-16T13:38:09Z: Created from `.project/templates/task.md` by `delano task add`.
