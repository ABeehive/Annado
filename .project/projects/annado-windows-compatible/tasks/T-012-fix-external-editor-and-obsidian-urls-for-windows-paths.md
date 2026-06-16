---
id: T-012
name: Fix external editor and Obsidian URLs for Windows paths
status: done
workstream: WS-B
created: 2026-06-16T13:38:08Z
updated: 2026-06-16T14:10:27Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src/utils/obsidian.ts, src/utils/openInEditor.ts, src/utils/RenderTitleWithLinks.tsx, src/components/SettingsModal.tsx]
parallel: false
priority: high
estimate: M
story_id: US-002
acceptance_criteria_ids: [AC-002]
---

# Task: Fix external editor and Obsidian URLs for Windows paths

## Description

Make frontend URL helpers, rendered Markdown file links, and vault display logic work with Windows
paths. Current code splits `vaultPath` on `/`, removes `vaultPath + '/'`, and only upgrades
POSIX-style absolute file links to `file://` URLs.

## Acceptance Criteria

- [x] Obsidian vault name and relative file URL generation work for Windows and POSIX paths.
- [x] VS Code URL generation handles Windows drive paths and spaces safely.
- [x] Rendered Markdown links can open safe Windows absolute file paths.
- [x] Settings vault display does not show the full Windows path as the vault name.
- [x] Tests cover Windows path URL cases.

## Technical Notes

Avoid assuming a single separator in browser-side code. Use normalized paths from the backend where
possible.

## Definition of Done

- [x] Implementation complete
- [x] Vitest coverage added
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T14:10:27Z: Windows/POSIX Obsidian URL helpers, VS Code URLs, markdown file links, and Settings vault names are covered by Vitest. npm run test -- obsidian openInEditor MarkdownNotesRenderer passed 11 tests; npm run build passed.

- 2026-06-16T14:08:42Z: Fix frontend path URL helpers for Windows vault paths, editor URLs, markdown file links, and vault display names.

- 2026-06-16T13:38:08Z: Created from `.project/templates/task.md` by `delano task add`.
