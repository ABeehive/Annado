---
name: Annado Windows Compatible
slug: annado-windows-compatible
owner: team
created: 2026-06-16T13:26:15Z
updated: 2026-06-16T13:40:00Z
---

# Decisions: Annado Windows Compatible

## Active Decisions

- D-001: Windows compatibility is not complete until a Windows artifact is built and smoke-tested.
  A clean compile is an intermediate milestone only.
- D-002: Keep macOS-native integrations available on macOS by target-gating rather than deleting them.
- D-003: App-internal task paths should be normalized before project/person/exclusion/Obsidian logic
  depends on separators.
- D-004: Unsupported Windows integrations must be explicit in UI and command responses; silent broken
  calls are not acceptable.
- D-005: The first Windows delivery ships Calendar event integration as explicitly unsupported.
  macOS keeps the EventKit provider, Windows disables Calendar event overlays/settings, and
  schedule-based auto-scheduling remains available without external calendar events.
- D-006: Windows notification support uses the Tauri notification plugin for OS toasts. Test
  notification failures must be visible in settings, the deadline/overdue scheduler must no-op
  cleanly when no vault or tasks are available, and the launch banner is treated as in-app behavior
  rather than a Windows OS notification.
- D-007: Windows shortcut defaults avoid the Windows key. In-app defaults use Ctrl-based bindings,
  task-specific commands use Ctrl+Shift or Ctrl+Enter where Ctrl conflicts with navigation, and
  system-wide shortcuts use Ctrl+Alt to avoid reserved Win-key combinations. Existing saved
  keybindings remain valid and are merged over the active platform defaults.
- D-008: Keep Tauri `titleBarStyle: Overlay` for macOS and handle Windows/native-chrome spacing in
  frontend runtime styling. The app sets `data-platform` before React renders, renders the custom
  drag overlay only on macOS, and disables `.titlebar-drag` plus traffic-light padding on non-macOS
  platforms.
- D-009: Set Tauri `dragDropEnabled: false` for the main window. Annado task, panel, and agenda
  drag/drop use dnd-kit pointer sensors rather than native file drag/drop events, so disabling
  Tauri's native WebView drag/drop handler avoids WebView2 interception without disabling in-app
  pointer dragging.
- D-010: The first Windows artifact targets NSIS only via `src-tauri/tauri.windows.conf.json`.
  NSIS produces a setup executable, avoids the WiX/VBSCRIPT path required for MSI, and keeps
  current-user installation as the default. MSI can be added later if enterprise deployment needs it.
- D-011: Use Tauri's WebView2 `downloadBootstrapper` installer mode with `silent: true` and no pinned
  `minimumWebview2Version`. This keeps the installer small, repairs missing WebView2 at install time,
  and avoids asserting a WebView2 floor before Annado depends on a version-specific WebView2 feature.
- D-012: Code signing is deferred for the first Windows smoke artifact. Public Windows distribution
  remains blocked until a signing path is chosen and configured, such as `bundle.windows.signCommand`
  or certificate-based signing.

## Superseded Decisions

- None.

## Open Decision Questions

- None.
