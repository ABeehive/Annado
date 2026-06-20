import { Task } from '../types/task';
import { groupTasksByProject } from './taskGrouping';

/**
 * Flatten filtered tasks into the exact top-to-bottom order TaskList renders
 * rows in, so range-selection (shift-click) and select-all operate on the same
 * sequence the user sees. Mirrors TaskList's `groupedRows` and the keyboard
 * navigation reconstruction.
 *
 * - When `isGrouped` (Inbox/Today/Anytime/Someday with no project|person|tag
 *   filter), tasks are grouped by project: no-project first, then projects
 *   alphabetically. In Today view the evening section trails the day section.
 * - Otherwise (project|person|tag|upcoming|logbook views) the filtered order is
 *   used as-is, matching TaskList's `flatRows`.
 */
export function flattenToVisibleOrder(
  rawTasks: Task[],
  opts: { isGrouped: boolean; isTodayView: boolean },
): Task[] {
  if (!opts.isGrouped) return rawTasks;

  const dayTasks = opts.isTodayView ? rawTasks.filter((t) => t.when !== 'evening') : rawTasks;
  const eveningTasks = opts.isTodayView ? rawTasks.filter((t) => t.when === 'evening') : [];

  const flatten = (list: Task[]) => {
    const { noProject, projects } = groupTasksByProject(list);
    return [...noProject, ...projects.flatMap((g) => g.tasks)];
  };

  // A task can belong to several projects (so it renders under each); keep the
  // first occurrence so the order has no duplicate ids.
  const seen = new Set<string>();
  const out: Task[] = [];
  for (const t of [...flatten(dayTasks), ...flatten(eveningTasks)]) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

/**
 * The inclusive id range between `anchorId` and `toId` within `orderedIds`.
 * Falls back to just `[toId]` when either endpoint isn't in the list (no anchor
 * yet, or the anchored task scrolled out of the current filter) — a shift-click
 * with no usable anchor degrades to a plain single select.
 */
export function rangeBetween(orderedIds: string[], anchorId: string | null, toId: string): string[] {
  const to = orderedIds.indexOf(toId);
  if (to === -1) return [toId];
  const from = anchorId ? orderedIds.indexOf(anchorId) : -1;
  if (from === -1) return [toId];
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  return orderedIds.slice(lo, hi + 1);
}
