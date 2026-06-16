---
timestamp: 2026-06-16T14:20:44Z
status: in-progress
task: T-021
stream: WS-C
---

# Progress Update

## Completed
- Added tauri-plugin-single-instance with the deep-link feature and registered it first in the Tauri builder. The secondary-instance callback focuses the existing main window while the existing deep-link plugin handler preserves URL parsing and event delivery. Windows smoke with src-tauri\\target\\debug\\annado.exe: cold annado://quickadd launch stayed running, warm annado://quickadd launch exited, and only one Annado process remained. Evidence: cargo check --manifest-path src-tauri\\Cargo.toml passed; cargo test --manifest-path src-tauri\\Cargo.toml --lib passed 30 tests; cargo tree confirmed tauri-plugin-single-instance feature deep-link. macOS runtime check remains queued for T-042, with existing macOS on_open_url code path unchanged by inspection.

## In Progress
- 

## Blockers
- None

## Next Actions
- 
