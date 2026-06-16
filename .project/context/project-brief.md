# Project Brief

## Problem

Annado is valuable because it gives users a polished task manager while keeping their data as plain
Markdown. The current implementation and documentation are macOS-centered, but the Tauri bundle
configuration and Windows icon assets suggest a future Windows path. That path is blocked by
unconditional macOS backend code and unverified desktop behavior outside macOS.

Delano is being used to keep the Windows compatibility effort explicit: scope, probes, evidence,
and closure should live in `.project/projects/annado-windows-compatible/`.

## Target Outcome

The active target is not "all features identical everywhere" yet. The first measurable outcome is:
Annado builds and launches on Windows, preserves core Markdown task workflows, and does not regress
macOS behavior.

## Scope Boundaries

In scope:

- Target-gate or replace macOS-only Rust dependencies and commands.
- Preserve core vault scanning, Markdown parsing, task editing, file watching, and Tauri launch.
- Define Windows behavior for Calendar, editor opening, tray, notifications, shortcuts, and deep
  links before claiming support.
- Add evidence through focused build/test checks and manual smoke testing.

Out of scope until explicitly planned:

- Mobile support.
- Remote sync or proprietary storage.
- Replacing the plain Markdown data model.
- Full feature parity claims for OS integrations that do not have a Windows implementation yet.
