---
timestamp: 2026-06-16T13:55:49Z
status: in-progress
task: T-002
stream: WS-A
---

# Progress Update

## Completed
- Implemented explicit non-macOS Calendar command behavior: unsupported calendar commands return a clear platform error, calendarSlice stores that message, disables persisted calendar polling on unsupported platforms, clears stale calendar data, and Settings displays the backend message instead of macOS-only permission copy. Evidence: npm run build passes; npm run lint exits 0 with pre-existing warnings; Windows cargo check reaches the known src/lib.rs RunEvent::Reopen error with no calendar command symbol errors.

## In Progress
- 

## Blockers
- None

## Next Actions
- 
