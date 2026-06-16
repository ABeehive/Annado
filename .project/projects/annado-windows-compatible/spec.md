---
name: Annado Windows Compatible
slug: annado-windows-compatible
owner: team
status: active
created: 2026-06-16T13:26:15Z
updated: 2026-06-16T13:51:19Z
outcome: Annado can build, launch, and preserve core task workflows on Windows without regressing macOS behavior.
uncertainty: high
probe_required: true
probe_status: completed
---

# Spec: Annado Windows Compatible

## Executive Summary

Annado currently presents as a macOS Tauri app. The Windows compatibility goal is to reach a real
Windows desktop build, not just make the frontend run in a browser. Success means the app compiles,
launches, selects a Markdown/Obsidian vault, scans tasks, edits tasks back to disk, and produces a
Windows installer/artifact with evidence. macOS behavior must remain intact.

## Problem and Users

Users who keep tasks in Markdown should be able to run Annado on a Windows PC. Today the backend
unconditionally compiles Apple-only Calendar/EventKit code and uses macOS shell commands. The app
also has path, shortcut, titlebar, tray, notification, deep-link, and packaging assumptions that must
be resolved or explicitly scoped.

## Outcome and Success Metrics

- `cargo check --manifest-path src-tauri/Cargo.toml` passes on Windows.
- `npm run build` passes.
- `npm run tauri -- build` produces a Windows desktop artifact.
- A Windows smoke test proves: first launch, vault selection, Markdown scan, task create/edit/complete,
  file persistence, app restart, and no blank screens or unhandled command failures.
- macOS regression checks pass after platform gates.
- Unsupported or different Windows integrations are hidden, disabled, or implemented with clear UI
  behavior.

## User Stories

- US-001: As a Windows user, I want to install and launch Annado, so that I can manage Markdown tasks
  without a macOS machine.
- US-002: As a Markdown/Obsidian user, I want vault paths and task files to work with Windows path
  separators, so that my tasks are discovered and edited correctly.
- US-003: As an existing macOS user, I want macOS Calendar, shortcuts, tray, and editor integrations
  to keep working after Windows support is added.
- US-004: As a maintainer, I want Windows limitations and test evidence recorded, so that release
  claims stay honest.

## Acceptance Scenarios

- AC-001: Given a Windows development environment with Tauri prerequisites installed, when the build
  commands run, then Rust, frontend, and Tauri build steps complete successfully.
- AC-002: Given a test vault using Windows paths, when Annado scans the vault, then projects, people,
  exclusions, recurring templates, areas, and task file links resolve correctly.
- AC-003: Given Calendar integration is not implemented on Windows, when the app runs on Windows, then
  Calendar UI is disabled or uses a Windows implementation without panics or broken command calls.
- AC-004: Given a built Windows app, when a user exercises core task workflows, then Markdown files are
  updated correctly and the app remains usable after restart.
- AC-005: Given platform-specific code is changed, when macOS checks run, then existing macOS behavior
  remains available.

## Scope

### In Scope

- Target-gating or replacing Apple-only Rust dependencies and modules.
- Cross-platform command behavior for Calendar, editor opening, tray, notifications, deep links,
  shortcuts, and window handling.
- Windows path normalization for vault scanning, filtering, project/person derivation, links, and
  external editor URLs.
- Windows bundling configuration, WebView2/runtime assumptions, installer output, and release docs.
- Focused automated tests plus manual desktop smoke evidence.

### Out of Scope

- Mobile support.
- Replacing Markdown as the data source.
- Adding proprietary sync or cloud storage.
- Full Windows Calendar provider parity unless explicitly selected during execution.
- Microsoft Store release, code signing, or auto-update unless added as a later project.

## Functional Requirements

- FR-001: The Rust backend must compile on Windows without Apple-only crates or frameworks in the
  Windows dependency graph.
- FR-002: Calendar commands must be available to the frontend on every desktop platform, either as
  native implementations or explicit unsupported no-op/error responses handled by UI.
- FR-003: File and editor opening must use platform-appropriate mechanisms and handle paths with
  spaces.
- FR-004: App-internal task paths must be normalized so Windows separators do not break project,
  person, area, recurring-template, exclusion, or Obsidian logic.
- FR-005: Keyboard defaults, shortcut labels, and hard-coded modifier handlers must be platform-aware.
- FR-006: Window chrome, titlebar spacing, drag region, and drag/drop behavior must be verified under
  WebView2.
- FR-007: Tray, notification, deep-link, and global shortcut behavior must be implemented or clearly
  disabled on Windows with no runtime crashes.
- FR-008: Windows packaging must produce a usable artifact and document required prerequisites.

## Non-Functional Requirements

- Preserve macOS functionality and current Markdown semantics.
- Keep platform differences explicit and testable.
- Avoid broad rewrites unless required by platform boundaries.
- Do not claim Windows support until a Windows artifact and smoke evidence exist.

## Assumptions

- Windows support can initially mean core task workflows plus honest limitations for OS integrations.
- Tauri 2 remains the desktop framework.
- WebView2 is the Windows webview runtime; installer behavior must account for it.
- A Windows development environment with Microsoft C++ Build Tools and WebView2 is available for final
  verification.

## Needs Clarification

- Whether Windows Calendar integration should be unsupported initially or implemented through a
  Windows-native provider.
- Whether default Windows shortcuts should use `Ctrl`, `Alt`, or another convention for global
  actions.
- Which installer format is required for first delivery: NSIS, MSI, or both.
- Whether code signing is required for the first Windows artifact.

## Hypotheses and Unknowns

- After removing Apple-only dependencies, additional Windows compile errors may surface.
- WebView2 drag/drop may interfere with dnd-kit unless Tauri `dragDropEnabled` is configured.
- Tray popup positioning may need Windows-specific behavior around the taskbar notification area.
- Deep links may need the single-instance plugin to route warm links into the existing process.

## Touchpoints to Exercise

- `src-tauri/Cargo.toml`
- `src-tauri/src/calendar.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/parser.rs`
- `src-tauri/src/vault.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`
- `src/utils/obsidian.ts`
- `src/utils/openInEditor.ts`
- `src/utils/keybindings.ts`
- `src/stores/slices/calendarSlice.ts`
- `src/hooks/useKeyboardHandler.ts`
- `src/components/SettingsModal.tsx`
- `src/features/notifications/NotificationSettings.tsx`
- `src/features/tray/TrayPopup.tsx`
- `README.md`
- `docs/`

## Probe Findings

- `cargo check --manifest-path src-tauri/Cargo.toml` fails on Windows because `objc2` only works on
  Apple platforms.
- Tauri docs state Windows development requires Microsoft C++ Build Tools and WebView2.
- Tauri docs state WebView2 is the Windows runtime and Windows installers can configure WebView2
  install modes/minimum versions.
- Tauri docs state deep links on Windows/Linux are delivered as command-line arguments to a new app
  process unless single-instance handling is used.
- Tauri config docs state `titleBarStyle` is a macOS titlebar option and HTML5 drag/drop on Windows
  may require disabling Tauri's webview drag/drop handling.

## Footguns Discovered

- Gating only `calendar.rs` is insufficient if `objc2`/`block2` remain unconditional Cargo
  dependencies.
- A clean Rust compile is not proof that task workflows work; path normalization needs separate tests.
- UI can still call unsupported native commands unless Calendar/editor/tray/notification state is
  platform-gated.
- `meta` maps to the Windows/Super key, not the normal Windows app shortcut convention.

## Remaining Unknowns

- Final Windows Calendar scope.
- Installer format and signing requirements.
- Exact Windows shortcut defaults.
- Which additional compile errors appear after Apple-only dependencies are removed.

## Dependencies

- Tauri Windows prerequisites: Microsoft C++ Build Tools and WebView2.
- Access to a Windows desktop environment for build and manual smoke testing.
- macOS environment or existing macOS maintainer workflow for regression checks.

## Approval Notes

Start with probe/compile tasks before claiming execution readiness. Activate the project only after
the Windows Calendar stance, shortcut defaults, and installer target are decided.
