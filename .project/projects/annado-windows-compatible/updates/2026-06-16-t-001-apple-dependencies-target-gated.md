---
timestamp: 2026-06-16T13:53:16Z
status: in-progress
task: T-001
stream: WS-A
---

# Progress Update

## Completed
- Target-gated direct block2/objc2 calendar dependencies under macOS, added a non-macOS calendar command stub with shared calendar DTOs, and kept the macOS EventKit implementation behind cfg(target_os = macos). Evidence: Windows cargo tree no longer prints objc2 or block2; macOS target tree still includes block2/objc2; Windows cargo check now reaches src/lib.rs RunEvent::Reopen instead of the prior objc2 failure.

## In Progress
- 

## Blockers
- None

## Next Actions
- 
