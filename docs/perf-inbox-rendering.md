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
| 3 | `list-performance-split-expanded-row` | Split collapsed row from expanded editor (+ hoist shared Sets) | ✅ |
| 4 | `list-performance-content-visibility` | `content-visibility: auto` — skip layout/paint for off-screen rows | ✅ |
| 5 | `list-performance-virtualize` | True windowing with `@tanstack/react-virtual` | ✅ |

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

### PR3 — split collapsed row from expanded editor

A *collapsed* `TaskItem` previously ran ~20 hooks — two `useWikilinkSuggest()`
calls, `detectDateHint()`, the title/notes/subtask editing state, and several
effects — none needed until expanded. Now:

- `TaskItem` is a thin wrapper that reads this row's selection/expansion state
  and drives the collapse animation, then renders either `CollapsedTaskRow` (no
  editing hooks) or `ExpandedTaskCard`.
- `ExpandedTaskCard` (new) owns the entire editing experience — title/notes
  state, wikilink suggestions, date-hint detection, subtask adder, pickers, save
  and click-outside — and is mounted only while a row is expanded (one at a
  time).
- Person/project name `Set`s are built once per list and shared via
  `WikilinkNamesContext`, instead of being rebuilt per row.

Because the detail wrapper now mounts on expand (rather than always being
present), `ExpandedTaskCard` animates open by rendering at `0fr` and flipping to
`1fr` on the next animation frame; `TaskItem` keeps it mounted ~200ms during
collapse so the close animation still plays.

**Manual test checklist** (no automated UI tests cover this):
expand/collapse animation, title autofocus on expand, click-outside saves &
collapses, When/Deadline shortcuts open their pickers (`Cmd+S`/`Cmd+D` on macOS,
`Ctrl+Shift+S`/`Ctrl+Shift+D` on Windows), Enter collapses, keyboard nav
keeps the selected row in view, and the check-off linger animation.

### PR4 — content-visibility for off-screen rows

After PRs 1–3 the dominant remaining cost is the engine laying out and painting
~3000 DOM subtrees. `content-visibility: auto` on the collapsed-row element
(`.task-row-cv`) lets WebKit skip style/layout/paint for rows that aren't near
the viewport and render them just-in-time on scroll; `contain-intrinsic-size:
auto 44px` reserves the box (and `auto` remembers each row's real height after
first render, so variable-height rows don't cause scroll jump). Only collapsed
rows get it — the expanded card is excluded so its open/close animation and
autofocus are never deferred.

This keeps all ~3000 React components/DOM nodes (so it doesn't reduce memory or
reconciliation), but it erases the layout/paint cost that dominates first paint
and scroll. It composes with drag-and-drop and every view with no structural
change. PR5 (`@tanstack/react-virtual`) is the heavier follow-up that also
removes the nodes themselves.

**Verify visually:** scroll a ~3000-item inbox (should stay smooth), fast-scroll
for any scrollbar jump, and confirm Quick Find (`Cmd+F` on macOS, `Ctrl+F` on
Windows) / keyboard-nav scroll-into-view still
reach off-screen rows.

### PR5 — true windowing with @tanstack/react-virtual

Only the rows near the viewport are mounted (~40 instead of ~3000), which cuts
DOM nodes, React reconciliation, and memory — the things PR4's content-visibility
couldn't. Scope: the grouped-by-project (inbox/today/anytime/someday) path and
the flat project/person/tag lists. Upcoming (day sections) and Logbook (already
paginated at 100) keep their existing rendering.

How it works:
- The grouped view is flattened into one `TaskRow[]` (`groupedRows`) — project/
  evening headers and task rows in a single array — and the flat views into
  `flatRows`. `ProjectGroup` is gone (its "show 5 more" was already vestigial,
  since groups defaulted to expanded).
- `VirtualTaskList` runs `useVirtualizer` against the shared scroll container,
  measures each row's real height (`measureElement`, so collapsed rows and the
  taller expanded card both size correctly), and uses a `scrollMargin` for any
  content rendered above the list (e.g. the Today calendar block).
- Keyboard-selected rows can be outside the window, so a selection-driven
  `scrollToIndex` brings the sole-selected row into view (the per-row
  `scrollIntoView` only works for already-mounted rows).
- Drag-and-drop is unchanged structurally (drop targets are the view-zone/day
  containers, not rows) and now registers `useDraggable` only for visible rows.

**Trade-off vs PR4:** strictly more capable but a much larger change. Test
PR4 first — if it's enough, this PR can wait.

**⚠️ Manual test checklist** (jsdom can't exercise windowing, so tests don't
cover it): smooth scroll through ~3000 items; expand/collapse re-measures and
shifts rows below; drag-and-drop within the list + auto-scroll near edges;
keyboard nav (arrow keys or `Ctrl+J`/`Ctrl+K`) scrolls off-screen selections into
view; When/Deadline shortcuts on a
selected row; switching views resets cleanly; the "New To-Do" footer in
project/person views.

## Results (measured locally on a ~3000-task vault)

- PRs 1–3 removed the per-interaction cost: selecting/expanding a task no longer
  scales with the total row count, and collapsed rows are cheap.
- PR4 (`content-visibility`) helped but was **not** enough on its own to make
  scrolling smooth at ~3000 items.
- PR5 (`@tanstack/react-virtual`) was the **decisive** win — the list scrolls
  smoothly at ~3000 tasks even in an unoptimized dev build (StrictMode
  double-render, unminified). PR4 still helps the views PR5 doesn't virtualize
  (Upcoming, Logbook).

## How to measure

Use the React DevTools Profiler against a vault of ~3000 tasks: record (a) initial
mount, (b) selecting a task, (c) expanding a task. Before PR1, a single selection
commits ~3000 `TaskItem` renders; after PR1 it should commit ~2 (the newly- and
previously-selected rows).
