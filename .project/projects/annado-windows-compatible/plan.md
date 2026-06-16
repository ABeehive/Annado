---
name: Annado Windows Compatible
status: active
lead: team
created: 2026-06-16T13:26:15Z
updated: 2026-06-16T13:49:21Z
linear_project_id: 
risk_level: high
spec_status_at_plan_time: planned
---

# Delivery Plan: Annado Windows Compatible

## What Changed After Probe

Initial research found that Windows compatibility is broader than the known `objc2` compile failure.
The plan now covers compile gates, path normalization, native integrations, Windows UX/input,
packaging, smoke testing, and macOS regression.

## Technical Context

Annado uses React/Vite/TypeScript in `src/` and Tauri/Rust in `src-tauri/`. The blocking build issue
is Apple-only Rust code and dependencies. The high-risk runtime issue is path handling: several
backend and frontend paths are string-split with `/`, while Windows paths use `\`. The high-risk UX
issue is macOS-centered shortcuts/titlebar/calendar/tray language and behavior.

Official Tauri evidence used during planning:

- Windows development requires Microsoft C++ Build Tools and WebView2.
- Windows builds run on WebView2 and installers can configure WebView2 install modes.
- Windows/Linux deep links are delivered as command-line arguments to a new process unless
  single-instance routing is used.
- `titleBarStyle` is a macOS titlebar option.
- HTML5 drag/drop on Windows may require disabling Tauri webview drag/drop handling.

## Architecture Decisions

- Keep macOS Calendar/EventKit code behind macOS-only compilation.
- Keep frontend command names stable where possible, but make unsupported platform responses explicit.
- Normalize app-internal vault-relative paths to forward slashes or structured path components before
  parsing/filtering logic sees them.
- Use platform-aware UI labels and shortcut defaults rather than treating `meta` as universal.
- Treat a Windows artifact plus smoke evidence as the release gate, not a successful compile alone.

## Policy and Contract Checks

- [x] `.project` remains the execution source of truth
- [x] Probe decision is explicit
- [x] Evidence gates are defined before handoff
- [x] External sync writes require dry-run or operator approval

## Generated Artifact Map

- `spec.md`: Created by `delano project create`, then folded forward from
  `research/windows-compatibility-audit`.
- `plan.md`: Created by `delano project create`, then updated with this delivery plan.
- `workstreams/`: Created by `delano workstream add`.
- `tasks/`: Created by `delano task add`.
- `research/windows-compatibility-audit/`: Research intake for compatibility findings.

## Workstream Design

- WS-A Compile Gates And Platform Architecture: remove build blockers and prove Windows Rust compile.
- WS-B Path And Markdown Data Portability: make vault paths, links, exclusions, and file derivation
  work with Windows separators.
- WS-C Windows Native Integrations: define and verify Calendar, deep link, tray, notification, and
  editor behavior.
- WS-D Windows UX And Input Parity: make shortcuts, labels, titlebar/chrome, and drag/drop usable.
- WS-E Windows Packaging And Release Verification: configure bundle, smoke test Windows, regress
  macOS, update README/docs, and produce artifact evidence.

## Milestone Strategy

1. Compile milestone: T-001 through T-004 produce a clean Windows `cargo check`.
2. Data milestone: T-010 through T-013 prove Windows path and Markdown logic with tests.
3. Integration milestone: T-020 through T-023 decide and verify native platform integrations.
4. UX milestone: T-030 through T-033 make Windows input/window behavior usable.
5. Release milestone: T-040 through T-044 produce and document a built Windows artifact.

Task frontmatter `depends_on` values are intentionally empty because the local Delano validator
treats `ready` tasks with unresolved local dependencies as invalid. Execution order is authoritative
in this milestone strategy and the workstream dependency sections.

## Rollout Strategy

Do not advertise general Windows support until T-044 is complete. If Calendar or other native
features remain unsupported, document those limitations and prevent broken UI paths on Windows.

## Test Strategy

- Rust: `cargo check --manifest-path src-tauri/Cargo.toml` on Windows, then targeted Rust tests for
  parser/vault path behavior.
- Frontend: `npm run test`, focused Vitest additions for path URLs and shortcuts, then `npm run build`.
- Desktop: `npm run tauri -- build` on Windows.
- Manual Windows smoke: vault selection, scan, create/edit/complete, persistence, restart, editor
  open behavior, tray/notification/deep-link where supported.
- Mac regression: run macOS build/checks or explicit maintainer verification for macOS-gated code.

## Rollback Strategy

Keep platform gates small. If a Windows-native integration is unstable, ship it as disabled/unsupported
behind UI gating while preserving core Markdown workflows. Revert or isolate only the affected
platform module rather than undoing shared parser/vault work.

## Remaining Delivery Risks

- Additional Windows compile errors are hidden behind the current `objc2` failure.
- Calendar scope may expand if true Windows calendar provider parity is required.
- Tauri plugin behavior for tray, global shortcuts, notifications, and deep links needs real Windows
  runtime evidence.
- Code signing or installer policy may become a release blocker if required.
