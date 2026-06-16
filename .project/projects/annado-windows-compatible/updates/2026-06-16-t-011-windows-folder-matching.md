---
timestamp: 2026-06-16T14:07:43Z
status: in-progress
task: T-011
stream: WS-B
---

# Progress Update

## Completed
- Normalized folder matching for exclusions, project/person discovery, wiki-link path parsing, and recurring-template folder skips. Project/person records now emit app-relative slash paths, and regression tests cover native path exclusions, Windows separator wikilinks, project/person depth/parent output, and recurring template skip behavior. Evidence: cargo test --manifest-path src-tauri/Cargo.toml --lib passes 29 tests; cargo check passes; npm run build passes.

## In Progress
- 

## Blockers
- None

## Next Actions
- 
