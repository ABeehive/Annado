---
id: WS-A
name: WS-A Compile Gates And Platform Architecture
owner: team
status: done
created: 2026-06-16T13:37:49Z
updated: 2026-06-16T13:59:21Z
---

# Workstream: WS-A Compile Gates And Platform Architecture

## Objective

Remove platform compile blockers and create a stable cross-platform Rust/Tauri command surface.

## Owned Files/Areas

- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/src/calendar.rs` and any platform-specific calendar modules
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`
- editor-opening command paths

## Dependencies

- Must precede final Windows packaging.
- Calendar product stance from T-020 may refine the command behavior.

## Risks

- Additional Windows compile errors are hidden behind the current `objc2` failure.
- Over-gating could accidentally remove macOS Calendar behavior.

## Handoff Criteria

- Windows `cargo check --manifest-path src-tauri/Cargo.toml` passes.
- macOS Calendar code is still present behind macOS-only gates.
- Frontend command calls do not crash on Windows because of missing native commands.
