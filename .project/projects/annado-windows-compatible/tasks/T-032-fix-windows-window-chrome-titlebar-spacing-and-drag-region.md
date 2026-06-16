---
id: T-032
name: Fix Windows window chrome, titlebar spacing, and drag region
status: done
workstream: WS-D
created: 2026-06-16T13:38:09Z
updated: 2026-06-16T14:47:42Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src-tauri/tauri.conf.json, src/App.tsx, src/App.css, src/components/Sidebar.tsx, src/components/TaskList.tsx]
parallel: false
priority: high
estimate: M
story_id: US-001
acceptance_criteria_ids: [AC-004]
---

# Task: Fix Windows window chrome, titlebar spacing, and drag region

## Description

Make top spacing, titlebar overlay, and drag regions platform-aware. Current config uses macOS
`titleBarStyle: Overlay`, and UI reserves traffic-light/titlebar space.

## Acceptance Criteria

- [x] Windows window does not show awkward double titlebar padding.
- [x] Drag regions do not block buttons or inputs.
- [x] macOS overlay titlebar layout remains intact.
- [x] Platform-specific config or runtime styling is documented.

## Technical Notes

Tauri config docs describe `titleBarStyle` as macOS-specific.

## Definition of Done

- [x] Implementation complete
- [x] Windows visual smoke evidence recorded
- [x] macOS layout checked

## Evidence Log

- 2026-06-16T14:47:42Z: Windows titlebar chrome and drag-region fix completed. Verified build, lint, Windows debug Tauri build, and smoke screenshot artifact.

- 2026-06-16T14:41:42Z: Making titlebar spacing and drag regions platform-aware for Windows chrome while preserving macOS overlay layout.

- 2026-06-16T14:47:21Z: Added pre-render platform detection, rendered the custom top drag overlay only on macOS, and added non-macOS CSS overrides for `.titlebar-drag`, `.titlebar-spacer`, and `.titlebar-header`. Tagged main/sidebar/side-panel/Wrapped/Review headers with shared titlebar classes. D-008 documents why macOS keeps Tauri `titleBarStyle: Overlay` while Windows/native-chrome spacing is handled at runtime. Verified `npm run build`, `npm run lint` (0 errors, 66 existing warnings), `npm run tauri -- build --debug --no-bundle` (passed with existing `Vault::new` warning), and Windows smoke screenshot `.project/projects/annado-windows-compatible/artifacts/windows-main-titlebar-smoke-loaded.png`; temporary app config cleanup confirmed.

- 2026-06-16T13:38:09Z: Created from `.project/templates/task.md` by `delano task add`.
