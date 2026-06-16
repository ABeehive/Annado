# macOS Regression Verification Checklist

Project: `annado-windows-compatible`
Task: `T-042-run-macos-regression-checks-for-platform-gated-behavior`

This checklist is for a maintainer running on a macOS host. It captures the remaining evidence needed
to unblock T-042 and then T-044.

## Why This Is Needed

Windows verification is complete, but T-042 requires proof that the platform gates did not break
existing macOS behavior:

- macOS Rust/Tauri build, or maintainer-approved equivalent, passes.
- macOS Calendar/EventKit code still compiles and is reachable.
- macOS overlay titlebar and drag region remain usable.
- macOS shortcuts and editor opening remain correct.
- Evidence records commands and manual checks.

The Windows host could not complete this check. After installing `x86_64-apple-darwin`, cross-checking
from Windows stopped at `objc2-exception-helper` because no Darwin C/Objective-C compiler (`cc`,
`clang`, or `xcrun`) was available.

## Preconditions

- macOS machine with Xcode Command Line Tools installed.
- Node.js/npm installed.
- Rust stable installed via `rustup`.
- Repository checked out with the Windows compatibility changes.
- A small synthetic Obsidian-style vault for manual checks, not a private vault.

## Command Evidence

Run these from the repository root:

```bash
git status --short --branch
npm install
npm run test -- src/utils/keybindings.test.ts src/utils/openInEditor.test.ts src/stores/slices/calendarSlice.test.ts src/features/notifications/NotificationSettings.test.tsx
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri -- build
```

Expected:

- Focused Vitest set passes.
- `cargo check --manifest-path src-tauri/Cargo.toml` compiles the macOS-gated Calendar/EventKit code.
- `npm run tauri -- build` succeeds on macOS, or the maintainer explicitly approves
  `cargo check` plus manual runtime checks as the equivalent evidence.

## Runtime Manual Checks

Run the app:

```bash
npm run tauri -- dev
```

Manual checks:

- First-run vault selection opens and loads a synthetic vault.
- The macOS overlay titlebar keeps the expected traffic-light spacing.
- Dragging the app by titlebar drag regions still moves the window.
- `Cmd+F` opens Quick Find.
- `Cmd+S` and `Cmd+D` open the When and Deadline pickers for a selected task.
- `Cmd+K` toggles completion for a selected task.
- `Cmd+Backspace` deletes a selected task after confirmation.
- `Cmd+\` toggles the side panel.
- `Cmd+R` opens Review.
- `Cmd+Shift+R` opens the new recurring template flow.
- Jump-to-source opens the configured editor or Obsidian target from an expanded task.
- Settings -> Calendar can request/check permission.
- If permission is granted, calendars can be listed and events appear in Agenda.
- Calendar event open/delete actions remain reachable where applicable.

## Evidence To Attach

Record:

- Command output summary for the command evidence above.
- Any relevant screenshots for titlebar/Calendar/manual runtime checks.
- Any regression found, with a follow-up task instead of closing T-042.

Suggested artifact names:

- `.project/projects/annado-windows-compatible/artifacts/macos-regression-command-output.txt`
- `.project/projects/annado-windows-compatible/artifacts/macos-titlebar-smoke.png`
- `.project/projects/annado-windows-compatible/artifacts/macos-calendar-smoke.png`

## Delano Closeout Commands

If all checks pass:

```bash
delano update add annado-windows-compatible --task T-042 --stream WS-E --section completed --status in-progress --title "T-042 macOS regression passed" --message "macOS regression evidence recorded. Include command summaries and manual check notes here."
delano task close annado-windows-compatible T-042 --reason "macOS regression checks passed" --evidence ".project/projects/annado-windows-compatible/artifacts/macos-regression-command-output.txt"
```

Then reopen/close T-044 with the macOS evidence link:

```bash
delano task open annado-windows-compatible T-044 --reason "macOS regression evidence is now available"
delano update add annado-windows-compatible --task T-044 --stream WS-E --section completed --status in-progress --title "T-044 release evidence complete" --message "Windows release artifact and macOS regression evidence are both recorded."
delano task close annado-windows-compatible T-044 --reason "Windows artifact and macOS regression evidence recorded" --evidence ".project/projects/annado-windows-compatible/artifacts/macos-regression-command-output.txt"
delano validate
```
