---
id: WS-B
name: WS-B Path And Markdown Data Portability
owner: team
status: done
created: 2026-06-16T13:37:49Z
updated: 2026-06-16T14:12:51Z
---

# Workstream: WS-B Path And Markdown Data Portability

## Objective

Make core Markdown task workflows work with Windows paths without corrupting vault files or changing
the plain-file data model.

## Owned Files/Areas

- `src-tauri/src/parser.rs`
- `src-tauri/src/vault.rs`
- `src-tauri/src/commands.rs`
- `src/utils/obsidian.ts`
- `src/utils/openInEditor.ts`
- path-related tests in Rust and Vitest

## Dependencies

- Should start after WS-A exposes a compiling backend.
- Required before Windows smoke testing can prove real task workflows.

## Risks

- Task IDs currently derive from file path plus line number; path normalization may affect identity.
- Exclusion and folder-pattern behavior can silently miss files if separators are wrong.

## Handoff Criteria

- Windows-style paths are covered by tests.
- Projects, people, areas, recurring templates, exclusions, Obsidian URLs, and editor URLs work with
  Windows paths.
- Markdown output remains compatible with existing macOS behavior.
