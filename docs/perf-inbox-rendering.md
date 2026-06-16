# Rendering performance — Inbox & list views

> Context: the Inbox with ~3000 tasks renders and interacts slowly. This document
> maps the render path, identifies root causes, and tracks the fix series. Each
> fix ships as its own `list-performance-*` branch/PR, in additive order.

## Root causes

The list is slow for three **compounding** reasons:

1. **No virtualization** — all ~3000 tasks mount into the DOM at once
   (`TaskList` → `ProjectGroup` → `DraggableTaskItem` → `TaskItem`). The
   "Show N more" cap does not apply to the inbox's no-project bucket because that
   group defaults to expanded.
2. **A re-render storm** — every row subscribed to the whole `selectedTaskIds`
   array and `expandedTaskId` via `usePanelState()`. Selecting/expanding one task
   produced a new array reference and re-rendered **all** rows (and `TaskList`).
   `React.memo` on `TaskItem` does not help — it only catches *prop* changes, not
   hook-subscription changes.
3. **Each row is heavy** — a *collapsed* `TaskItem` runs ~20 hooks including two
   `useWikilinkSuggest()` calls, `detectDateHint()`, and the full title/notes/
   subtask editing machinery — none needed until the row is expanded.

Secondary costs: ~3000 dnd-kit `useDraggable` registrations; `getFilteredTasks()`
returns a fresh array each render and `groupTasksByProject` runs inline every
render.

## Fix series (additive order)

| PR | Branch | Fix | Status |
|----|--------|-----|--------|
| 1 | `list-performance-primitive-selectors` | Per-row primitive selectors — kill the re-render storm | ✅ |
| 2 | `list-performance-memoization` | Memoize filtered/grouped tasks | ✅ |
| 3 | `list-performance-split-expanded-row` | Split collapsed row from expanded editor (+ hoist shared Sets) | planned |
| 4 | `list-performance-virtualize` | Virtualize with `@tanstack/react-virtual` | planned |

### PR1 — primitive selectors (this branch)

`usePanelState()` no longer exposes `selectedTaskIds` / `expandedTaskId`. It keeps
navigation state + stable actions, so it re-renders only on navigation. A new
`usePanelTaskState(taskId)` returns `isSelected` / `isSoleSelection` /
`isExpanded` as primitives, so selecting or expanding a task re-renders only the
affected rows. `TaskList` now subscribes to `tasks` / `completingTaskIds`
directly to keep the list fresh after edits and completions (it previously
refreshed only as a side effect of `expandedTaskId` changing on collapse).

### PR2 — memoize filtered & grouped tasks

`getFilteredTasks()` returned a fresh array every render and the project/logbook
grouping ran inline on every render, so any `TaskList` re-render (after PR1:
data changes, navigation, side-panel toggle, calendar updates) re-filtered and
re-grouped all ~3000 tasks. Now the filtered `tasks` is memoized on its real
inputs, and `dayTasks` / `eveningTasks` / `groupedTasks` / `eveningGrouped` /
`logbookGroups` are `useMemo`s derived from it — moved above the early returns to
satisfy the rules of hooks. Referentially-stable grouped arrays also set up the
later virtualization work. (Shared-`Set` hoisting moved to PR3, which restructures
the row internals anyway.)

## How to measure

Use the React DevTools Profiler against a vault of ~3000 tasks: record (a) initial
mount, (b) selecting a task, (c) expanding a task. Before PR1, a single selection
commits ~3000 `TaskItem` renders; after PR1 it should commit ~2 (the newly- and
previously-selected rows).
