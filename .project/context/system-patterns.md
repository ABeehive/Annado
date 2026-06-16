# System Patterns

## Plain-File State

Markdown is the product database. The backend scans `.md` files, parses checkbox tasks, and writes
edits back into the same files. Preserve checkbox syntax, indentation for notes/subtasks, inline
metadata such as `@when(...)`, `@due(...)`, `@time(...)`, `@duration(...)`, priorities, tags, and
Obsidian `[[wikilinks]]`.

## React State And Views

The UI uses a single Zustand root store composed from slices for settings, calendar, agenda, UI,
panel, and task behavior. `App.tsx` switches between main task list, lazy-loaded agenda/review/wrapped
views, side panel, quick add, quick find, and modal surfaces.

## Tauri Command Boundary

React calls Tauri commands for vault setup, task CRUD, metadata updates, recurring templates,
calendar events, editor opening, tray/window actions, and notification preferences. Keep new native
behavior behind focused commands and update Tauri capabilities when permissions change.

## Delano State

Delano contracts live under `.project/projects/`. Use CLI commands for lifecycle and contract
changes when possible. Context files summarize reality, while specs/plans/tasks/updates carry active
delivery state and evidence.

## Compatibility Pattern

For Windows compatibility, prefer target-specific Rust modules or `cfg` gates over broad rewrites.
Mac-specific behavior should remain available on macOS while non-macOS platforms get explicit stubs
or native alternatives with honest UI behavior.
