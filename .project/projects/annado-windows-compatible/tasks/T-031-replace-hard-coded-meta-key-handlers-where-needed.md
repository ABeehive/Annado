---
id: T-031
name: Replace hard-coded meta-key handlers where needed
status: done
workstream: WS-D
created: 2026-06-16T13:38:09Z
updated: 2026-06-16T14:41:03Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src/hooks/useKeyboardHandler.ts, src/components/Sidebar.tsx, src/features/review/ReviewView.tsx, src/features/agenda/TimeBlock.tsx]
parallel: false
priority: high
estimate: M
story_id: US-001
acceptance_criteria_ids: [AC-004]
---

# Task: Replace hard-coded meta-key handlers where needed

## Description

Audit direct `e.metaKey` handlers and route user commands through the keybinding abstraction or
platform-aware modifier helper.

## Acceptance Criteria

- [x] Main command shortcuts work on Windows using the approved default modifiers.
- [x] Review and Agenda local shortcuts are audited.
- [x] Multi-select behavior keeps Ctrl support on Windows.
- [x] Remaining `metaKey` uses are documented as intentional.

## Technical Notes

Do not break user-customizable keybinding behavior in settings.

## Definition of Done

- [x] Implementation complete
- [x] Shortcut smoke tests or evidence recorded
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T14:41:03Z: Shortcut handler audit completed. Verified rg metaKey audit, npm run test -- keybindings, npm run build, and npm run lint.

- 2026-06-16T14:36:05Z: Auditing and replacing direct meta-key handlers with platform-aware shortcut helpers.

- 2026-06-16T14:40:43Z: Replaced hard-coded primary modifier checks in main keyboard handling, Sidebar settings shortcut, Review complete action, and Agenda event context actions with keybinding helpers. Task multi-select now uses the shared multi-select modifier helper, preserving Ctrl-click on Windows. Remaining direct `metaKey` uses are limited to keybinding matching/recording and tests, with comments documenting intent. Verified `rg -n metaKey src\components src\features src\hooks src\utils` scope, `npm run test -- keybindings` (4 passed), `npm run build`, and `npm run lint` (0 errors, 66 existing warnings).

- 2026-06-16T13:38:09Z: Created from `.project/templates/task.md` by `delano task add`.
