# Project Overview

## Mission

Annado is a macOS-focused Tauri desktop task manager for Markdown and Obsidian vault tasks. The
project's core promise is that tasks remain in user-owned `.md` files while Annado provides native
task management, scheduling, review, reminders, and project/person/tag views.

## Active Delivery Scopes

- `annado-windows-compatible`: planned Delano project created on 2026-06-16. Outcome: Annado can
  build, launch, and preserve core task workflows on Windows without regressing macOS behavior.
  Current state: `spec=active`, `plan=active`, 5 planned workstreams, 21 ready tasks, and a
  completed Windows compatibility research intake folded into the project artifacts.

## Current Health

The React/Vite frontend and much of the Rust file/task logic appear portable in principle. The
desktop backend is not Windows-ready today. `src-tauri/src/calendar.rs` links Apple
EventKit/Foundation directly, `src-tauri/Cargo.toml` includes Apple-only `objc2` and `block2`, and
editor opening uses the macOS `open` command. The Windows plan also covers path separators,
platform-specific shortcuts, macOS titlebar assumptions, drag/drop behavior, deep links, tray,
notifications, packaging, documentation, and release smoke evidence.

The Delano runtime has been installed in the repo and `AGENTS.md` now defines the operating rules,
source-of-truth map, and Windows compatibility warning.
