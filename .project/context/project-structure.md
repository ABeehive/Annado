# Project Structure

## Canonical Boundaries

- `AGENTS.md`: repo operating rules for agents.
- `HANDBOOK.md`: Delano delivery model and CLI/process semantics.
- `.project/`: Delano context and project contracts. This is delivery truth.
- `.agents/`: Delano skills, rules, schemas, hooks, scripts, logs, and adapters.
- `.codex/`: Codex hook configuration installed by Delano.
- `.delano/`: optional viewer/presentation layer, not source of truth.
- `README.md` and `docs/`: user-facing product documentation and screenshots.

## Product Runtime Areas

- `src/`: React app.
- `src/components/`: shared UI and modals.
- `src/features/agenda`: day/week scheduling, time blocks, auto-scheduling helpers.
- `src/features/review`: weekly review workflow.
- `src/features/tray`: tray popup UI.
- `src/features/wrapped`: stats/deck experience.
- `src/stores/`: Zustand root store and slices.
- `src/utils/`: date parsing, task grouping, link rendering, colors, and related tests.
- `src-tauri/src/commands.rs`: Tauri command API.
- `src-tauri/src/vault.rs`: vault scanning, file mutation, metadata, watchers, recurring tasks.
- `src-tauri/src/parser.rs`: Markdown task parsing and inline metadata.
- `src-tauri/src/calendar.rs`: current macOS Calendar/EventKit implementation.
- `src-tauri/src/lib.rs`: Tauri setup, plugins, shortcuts, tray, deep links, command registration.

## Working Notes

Generated build output (`dist`, `target`, `node_modules`) should stay out of context. Screenshots in
`docs/images/` are product docs, not test evidence unless a task explicitly cites them.
