---
type: research_intake
project: annado-windows-compatible
slug: windows-compatibility-audit
owner: team
status: folded-forward
created: 2026-06-16T13:33:30Z
updated: 2026-06-16T13:40:00Z
---

# Research Plan: Windows Compatibility Audit

## Goal

Identify the compatibility issues that block a real Windows build and fold the findings into
`spec.md`, `plan.md`, workstreams, tasks, and decisions.

## Primary Question

What compatibility issues must be resolved so Annado can build, launch, and preserve core task
workflows on Windows without regressing macOS?

## Scope

In scope: Rust/Tauri compilation, platform-specific native integrations, Windows path behavior,
frontend shortcut/window assumptions, packaging, smoke testing, documentation, and macOS regression.

Out of scope: implementing the fixes during this research pass, mobile support, proprietary storage,
Microsoft Store release, code signing, or full Windows Calendar provider parity unless later selected.

## Current Phase

Folded forward

## Phases

- [x] Open research intake
- [x] Investigate sources and options
- [x] Summarize findings
- [x] Fold forward into canonical project artifacts

## Decisions Made

| Decision | Rationale |
| --- | --- |
| Build artifact is the final outcome | A passing frontend or Rust check alone does not prove desktop compatibility. |
| macOS integrations stay behind gates | Deleting macOS functionality would regress current users. |
| Windows Calendar can be gated before provider parity | Core task workflows can be delivered before Calendar parity if UI is honest. |
| Path normalization is a first-class workstream | Windows separators affect discovery, filtering, links, IDs, and editor URLs. |

## Blockers

| Blocker | Owner | Check-back |
| --- | --- | --- |
| Windows Calendar stance needs product decision | team | before project activation |
| Installer target/signing requirements need owner decision | team | before release workstream closure |
