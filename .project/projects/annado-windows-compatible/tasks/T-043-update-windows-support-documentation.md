---
id: T-043
name: Update Windows support documentation
status: done
workstream: WS-E
created: 2026-06-16T13:38:09Z
updated: 2026-06-16T16:07:10Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [README.md, docs]
parallel: false
priority: medium
estimate: M
story_id: US-004
acceptance_criteria_ids: [AC-004]
---

# Task: Update Windows support documentation

## Description

Update user and maintainer docs so Windows support claims match verified behavior.

## Acceptance Criteria

- [x] README no longer presents Annado as macOS-only once Windows artifact is verified.
- [x] `docs/` pages no longer describe verified Windows behavior with macOS-only labels.
- [x] Windows install/build prerequisites are documented.
- [x] Shortcut documentation reflects platform-specific modifiers.
- [x] Calendar/tray/notification/deep-link limitations are documented if any remain.
- [x] Build artifact location and smoke evidence are linked or summarized.

## Technical Notes

Do not update screenshots unless UI changed in a way that makes existing images misleading.

## Definition of Done

- [x] Docs updated
- [x] Claims match evidence
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T16:07:10Z: README.md, docs/tour.md, docs/perf-inbox-rendering.md; focused Vitest platform tests; npm run lint

- 2026-06-16T16:06:28Z: Updated `README.md`, `docs/tour.md`, and
  `docs/perf-inbox-rendering.md` to document macOS/Windows support, Windows prerequisites, platform
  shortcuts, Calendar limitation, tray/menu-bar wording, unsigned NSIS artifact path, and T-041 smoke
  evidence. Also fixed Windows `viewReview` default from `Ctrl+Shift+R` to `Ctrl+R` to avoid the
  `Ctrl+Shift+R` new-recurring shortcut collision. Verification: focused Vitest platform set passed
  (4 files, 11 tests) and `npm run lint` passed with 0 errors / 66 existing warnings.

- 2026-06-16T16:01:33Z: Updating Windows support docs to match verified smoke/build evidence and known macOS-gated limitations.

- 2026-06-16T13:38:09Z: Created from `.project/templates/task.md` by `delano task add`.
