---
timestamp: 2026-06-16T13:59:20Z
status: in-progress
task: T-003
stream: WS-A
---

# Progress Update

## Completed
- Replaced macOS-only open usage in open_file_in_editor with tauri_plugin_opener::open_path for system and Sublime launches, and added shell-free custom command template parsing that substitutes {file}/{line} after quote-aware argument parsing. Evidence: npm run build passes; cargo test --manifest-path src-tauri/Cargo.toml editor_command_tests --lib passes 3 tests, including Windows paths with spaces.

## In Progress
- 

## Blockers
- None

## Next Actions
- 
