---
id: T-033
name: Validate drag-and-drop behavior under WebView2
status: done
workstream: WS-D
created: 2026-06-16T13:38:09Z
updated: 2026-06-16T15:06:54Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src-tauri/tauri.conf.json, src/hooks/useDragAndDrop.ts, src/components/TaskList.tsx, src/features/agenda]
parallel: false
priority: medium
estimate: M
story_id: US-001
acceptance_criteria_ids: [AC-004]
---

# Task: Validate drag-and-drop behavior under WebView2

## Description

Verify dnd-kit task dragging and agenda scheduling under Windows WebView2. Tauri docs note HTML5
drag/drop on Windows may require disabling webview drag/drop handling.

## Acceptance Criteria

- [x] Task drag between views/panels works on Windows.
- [x] Agenda drag/resize scheduling works on Windows.
- [x] `dragDropEnabled` config is set or left unchanged with evidence.
- [x] macOS drag/drop behavior is not regressed.

## Technical Notes

This is a runtime smoke task; frontend unit tests are not enough.

## Definition of Done

- [x] Windows drag/drop smoke complete
- [x] Config decision recorded
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T15:06:54Z: Panel drag rewrote @when(2026-06-16); Agenda drag wrote @time(11:00); Agenda resize wrote @duration(1h). Evidence screenshots and result file are in .project/projects/annado-windows-compatible/artifacts/. macOS runtime smoke was unavailable from Windows; source review confirms dnd-kit pointer paths remain unchanged.

- 2026-06-16T15:05:21Z: Windows WebView2 task drag smoke passed with `dragDropEnabled: false`.
  Panel drag from Inbox to Today rewrote the task line to `@when(2026-06-16)`. Evidence:
  `.project/projects/annado-windows-compatible/artifacts/windows-dnd-full-02-panel-before.png`,
  `.project/projects/annado-windows-compatible/artifacts/windows-dnd-full-03-panel-after.png`.
- 2026-06-16T15:05:21Z: Windows WebView2 Agenda drag and resize smoke passed. Dragging an
  unscheduled task into the timeline wrote `@time(11:00)`; resizing the scheduled block wrote
  `@duration(1h)`. Evidence:
  `.project/projects/annado-windows-compatible/artifacts/windows-agenda-resize4-01-before.png`,
  `.project/projects/annado-windows-compatible/artifacts/windows-agenda-resize4-02-scheduled.png`,
  `.project/projects/annado-windows-compatible/artifacts/windows-agenda-resize4-03-resized.png`,
  `.project/projects/annado-windows-compatible/artifacts/windows-agenda-resize4-smoke-result.txt`.
- 2026-06-16T15:05:21Z: Config decision recorded in `decisions.md` as D-009. `dragDropEnabled` is
  set to `false` because Annado uses dnd-kit pointer sensors for in-app drag/drop; source review
  confirms this does not change the dnd-kit pointer paths used by macOS. macOS runtime smoke was
  not run from this Windows environment.
- 2026-06-16T14:49:12Z: Validating WebView2 drag/drop behavior and deciding dragDropEnabled config for dnd-kit pointer-based dragging.

- 2026-06-16T13:38:09Z: Created from `.project/templates/task.md` by `delano task add`.
