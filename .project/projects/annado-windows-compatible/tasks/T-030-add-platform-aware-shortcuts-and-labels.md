---
id: T-030
name: Add platform-aware shortcuts and labels
status: done
workstream: WS-D
created: 2026-06-16T13:38:09Z
updated: 2026-06-16T14:35:42Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src/utils/keybindings.ts, src/components/KeybindingInput.tsx, README.md]
parallel: false
priority: high
estimate: M
story_id: US-001
acceptance_criteria_ids: [AC-004]
---

# Task: Add platform-aware shortcuts and labels

## Description

Replace macOS-only Cmd assumptions with platform-aware shortcut defaults and labels. On Windows,
`meta` maps to the Windows key and may conflict with OS shortcuts.

## Acceptance Criteria

- [x] Windows defaults use an approved Windows-appropriate modifier scheme.
- [x] Shortcut display labels show Ctrl/Alt/Win as appropriate instead of Cmd-only labels.
- [x] Existing saved user keybindings migrate or remain valid.
- [x] README/help text can represent both macOS and Windows shortcuts.

## Technical Notes

Record the Windows default decision in `decisions.md` before closing.

## Definition of Done

- [x] Implementation complete
- [x] Shortcut tests or manual checks added
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T14:35:42Z: Platform-aware shortcut defaults, labels, docs, and D-007 decision completed. Verified npm run test -- keybindings, npm run build, npm run lint, and cargo check --manifest-path src-tauri\Cargo.toml.

- 2026-06-16T14:27:04Z: Task started with `delano task start`.

- 2026-06-16T14:35:24Z: Added platform-aware shortcut defaults and labels. Windows defaults use Ctrl/Ctrl+Shift/Ctrl+Alt per D-007; settings/help labels now use Cmd/Ctrl/Alt/Win text; saved keybindings continue to merge over active platform defaults. Verified with `npm run test -- keybindings` (3 passed), `npm run build`, `npm run lint` (0 errors, 66 existing warnings), and `cargo check --manifest-path src-tauri\Cargo.toml` (passed with existing `Vault::new` dead_code warning).

- 2026-06-16T13:38:09Z: Created from `.project/templates/task.md` by `delano task add`.
