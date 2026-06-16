---
id: WS-E
name: WS-E Windows Packaging And Release Verification
owner: team
status: active
created: 2026-06-16T13:37:49Z
updated: 2026-06-16T15:16:47Z
---

# Workstream: WS-E Windows Packaging And Release Verification

## Objective

Produce a real Windows build artifact and evidence that core workflows work on Windows while macOS is
not regressed.

## Owned Files/Areas

- `src-tauri/tauri.conf.json`
- `src-tauri/icons/`
- `README.md`
- `docs/`
- release/build notes
- smoke-test evidence in Delano updates/tasks

## Dependencies

- Depends on WS-A through WS-D.
- Requires a Windows environment with Tauri prerequisites.
- macOS regression evidence is required before closeout.

## Risks

- WebView2 installer mode, NSIS/MSI target, and signing requirements may need product/owner decisions.
- A build artifact without smoke evidence is not enough to close the project.

## Handoff Criteria

- Windows artifact is produced and its path/name is recorded in evidence.
- Windows smoke test covers core Markdown workflows.
- macOS regression evidence is recorded.
- README/docs clearly state Windows support and any remaining limitations.
