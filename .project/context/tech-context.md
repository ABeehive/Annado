# Tech Context

## Stack

- Frontend: React 19, TypeScript, Vite 7, Tailwind CSS 4, Zustand, dnd-kit, TanStack virtual.
- Desktop/backend: Tauri 2, Rust 2021, Tauri plugins for dialog, opener, deep links, global
  shortcuts, notifications, and tray icon support.
- Tests: Vitest/jsdom for frontend utilities and components; Rust tests in parser and vault modules.

## Commands

- `npm install`
- `npm run dev`
- `npm run tauri -- dev`
- `npm run build`
- `npm run test`
- `npm test` (same test script)
- `npm run lint`
- `npm run check`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `delano validate` or `bash .agents/scripts/pm/validate.sh` after Delano contract changes.

## Runtime Constraints

The supported runtime is currently macOS Tauri 2. Windows/Linux builds fail as-is because:

- `src-tauri/src/calendar.rs` links Apple `EventKit` and `Foundation`.
- `src-tauri/Cargo.toml` includes Apple-only `objc2` and `block2`.
- `open_file_in_editor` uses the macOS `open` command for system/Sublime handling.
- The notification/menu bar, shortcut, deep-link, and calendar behavior has not been verified on
  Windows.

## Integration Points

- User vaults and Obsidian folders are the data source.
- Tauri commands bridge React state/actions to Rust file, config, calendar, notification, tray, and
  editor behavior.
- File watching uses `notify`.
- Obsidian Daily Notes settings are read when an Obsidian vault is detected.
- Delano project state lives under `.project/`; `.agents/` contains the local runtime.
