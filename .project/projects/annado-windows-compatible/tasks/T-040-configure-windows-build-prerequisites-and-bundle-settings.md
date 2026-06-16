---
id: T-040
name: Configure Windows build prerequisites and bundle settings
status: done
workstream: WS-E
created: 2026-06-16T13:38:09Z
updated: 2026-06-16T15:18:58Z
linear_issue_id: 
github_issue: 
github_pr: 
depends_on: []
conflicts_with: [src-tauri/tauri.conf.json, src-tauri/tauri.windows.conf.json, README.md]
parallel: false
priority: high
estimate: M
story_id: US-001
acceptance_criteria_ids: [AC-001]
---

# Task: Configure Windows build prerequisites and bundle settings

## Description

Define the Windows build environment and Tauri bundle configuration needed for a usable Windows
artifact.

## Acceptance Criteria

- [x] Windows prerequisites are documented: Microsoft C++ Build Tools, Rust, Node/npm, WebView2.
- [x] Tauri Windows bundle target decision is recorded: NSIS, MSI, or both.
- [x] WebView2 installer mode/minimum version decision is recorded and configured if needed.
- [x] Icon/resource requirements are verified for Windows.
- [x] Signing requirement is recorded as required or deferred.

## Technical Notes

Official Tauri docs identify WebView2 as the Windows runtime and expose installer options for
bootstrapper/offline/fixed/skip modes.

## Definition of Done

- [x] Bundle config reviewed
- [x] Build prerequisites documented
- [x] Evidence recorded

## Evidence Log

- 2026-06-16T15:18:58Z: Configured src-tauri/tauri.windows.conf.json for NSIS-only Windows bundles, WebView2 downloadBootstrapper silent mode, and current-user NSIS install mode. README documents Microsoft C++ Build Tools, Rust MSVC, Node/npm, WebView2, MSI/VBSCRIPT note, icon requirements, and deferred signing. Verified with tauri info, debug no-bundle build, and unsigned debug NSIS bundle at src-tauri/target/debug/bundle/nsis/Annado_0.1.2_x64-setup.exe.

- 2026-06-16T15:18:21Z: Added `src-tauri/tauri.windows.conf.json` with Windows-specific
  `bundle.targets: ["nsis"]`, WebView2 `downloadBootstrapper` mode with `silent: true`, and NSIS
  `installMode: "currentUser"`. The base cross-platform config remains unchanged for non-Windows
  bundle targets.
- 2026-06-16T15:18:21Z: README documents Windows prerequisites: Microsoft C++ Build Tools with the
  Desktop development workload, Rust stable MSVC, Node/npm, and WebView2 Runtime. Official Tauri docs
  consulted: `https://v2.tauri.app/start/prerequisites/` and
  `https://v2.tauri.app/distribute/windows-installer/`.
- 2026-06-16T15:18:21Z: Decisions recorded in `decisions.md`: D-010 NSIS first artifact, D-011
  WebView2 download bootstrapper with no pinned minimum version, and D-012 signing deferred for the
  first smoke artifact but required before public Windows distribution.
- 2026-06-16T15:18:21Z: Icon requirements verified. `src-tauri/icons/icon.ico` contains 16, 24, 32,
  48, 64, 128, and 256px 32-bit layers; PNG icons are square RGBA assets.
- 2026-06-16T15:18:21Z: Verification passed: `npm run tauri -- info` reported WebView2
  149.0.4022.69, Visual Studio Build Tools 2022, stable MSVC Rust, Node 26.2.0, npm 11.13.0, and
  Tauri CLI 2.9.6. `npm run tauri -- build --debug --no-bundle` passed, and
  `npm run tauri -- bundle --debug --bundles nsis --ci --no-sign` produced the unsigned debug NSIS
  installer at `src-tauri/target/debug/bundle/nsis/Annado_0.1.2_x64-setup.exe`.
- 2026-06-16T15:16:47Z: Configuring Windows-specific bundle settings and documenting Windows build prerequisites.

- 2026-06-16T13:38:09Z: Created from `.project/templates/task.md` by `delano task add`.
