---
id: T-041
name: Run Windows core workflow smoke test
status: done
workstream: WS-E
created: 2026-06-16T13:38:09Z
updated: 2026-06-16T15:58:32Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: []
parallel: false
priority: high
estimate: L
story_id: US-001
acceptance_criteria_ids: [AC-004]
---

# Task: Run Windows core workflow smoke test

## Description

Run the built app on Windows and prove core Markdown task workflows work end to end.

## Acceptance Criteria

- [x] App launches on Windows without blank screen or startup command failure.
- [x] First-run vault selection works.
- [x] Test vault scan discovers Markdown tasks, projects, people, tags, and recurring templates as applicable.
- [x] Create, edit, complete, delete, and restart persistence are verified against the Markdown files.
- [x] Quick Add, Quick Find, side panel, and at least one Agenda scheduling flow are exercised.
- [x] Unsupported native integrations do not break the app.

## Technical Notes

Use a synthetic test vault, not a private personal vault. Record enough evidence to reproduce.

## Definition of Done

- [x] Windows smoke test complete
- [x] Failures fixed or converted into tasks
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T15:58:32Z: .project/projects/annado-windows-compatible/artifacts/windows-core-workflow-smoke3-result.txt

- 2026-06-16T15:57:48Z: PASS Windows debug app core workflow smoke against a synthetic vault. Evidence:
  `.project/projects/annado-windows-compatible/artifacts/windows-core-workflow-smoke3-result.txt`.
  Screenshots recorded as `windows-core3-01-first-run.png` through
  `windows-core3-12-restart-persistence.png`. Verified first-run vault selection, scan discovery
  for project/person/tag/recurring data, Quick Find, Quick Add, edit/delete/complete Markdown
  persistence, side panel, Agenda scheduling with `@time(...)`, restart persistence, and no startup
  failure from unsupported native integrations.

- 2026-06-16T15:19:44Z: Running Windows core workflow smoke against a synthetic vault and debug Windows app.

- 2026-06-16T13:38:09Z: Created from `.project/templates/task.md` by `delano task add`.
