import { Task } from '../types/task';
import { getToday, parseLocalDate, formatDateForDisplay } from './dates';

/** Effective date of a task for day-based grouping: when-date, else deadline. */
export function getTaskDate(task: Task): string | null {
  if (task.when === 'today') {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }
  if (task.when === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  if (typeof task.when === 'object' && task.when !== null && task.when.date) {
    return task.when.date;
  }
  return task.deadline ?? null;
}

/** Cap how many tasks render across date groups (Logbook can hold thousands of rows). */
export function limitGroupedTasks(
  groups: { label: string; tasks: Task[] }[],
  limit: number
): { label: string; tasks: Task[] }[] {
  const out: { label: string; tasks: Task[] }[] = [];
  let count = 0;
  for (const group of groups) {
    if (count >= limit) break;
    const remaining = limit - count;
    out.push(remaining >= group.tasks.length ? group : { label: group.label, tasks: group.tasks.slice(0, remaining) });
    count += group.tasks.length;
  }
  return out;
}

/** Group completed tasks by completion date for the Logbook view (newest first). */
export function groupTasksByCompletionDate(tasks: Task[]): { label: string; tasks: Task[] }[] {
  const today = getToday();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Separate tasks with and without completedDate
  const dated: Task[] = [];
  const undated: Task[] = [];

  for (const task of tasks) {
    if (task.completedDate) {
      dated.push(task);
    } else {
      undated.push(task);
    }
  }

  // Sort dated tasks by completedDate descending (newest first)
  dated.sort((a, b) => b.completedDate!.localeCompare(a.completedDate!));

  // Group by date string
  const groupMap = new Map<string, Task[]>();
  for (const task of dated) {
    const date = task.completedDate!;
    const existing = groupMap.get(date) || [];
    existing.push(task);
    groupMap.set(date, existing);
  }

  // Convert to labeled groups
  const groups: { label: string; tasks: Task[] }[] = [];

  for (const [dateStr, groupTasks] of groupMap) {
    const date = parseLocalDate(dateStr);
    let label: string;
    if (date.getTime() === today.getTime()) {
      label = 'Today';
    } else if (date.getTime() === yesterday.getTime()) {
      label = 'Yesterday';
    } else {
      label = formatDateForDisplay(dateStr);
    }
    groups.push({ label, tasks: groupTasks });
  }

  // Add undated tasks at the bottom
  if (undated.length > 0) {
    groups.push({ label: 'Earlier', tasks: undated });
  }

  return groups;
}

/** Group tasks by project (a task appears under each of its projects). */
export function groupTasksByProject(tasks: Task[]): {
  noProject: Task[];
  projects: { project: string; tasks: Task[] }[];
} {
  const noProject: Task[] = [];
  const projectMap: Map<string, Task[]> = new Map();

  for (const task of tasks) {
    if (task.projects.length > 0) {
      // Add task to each project it belongs to
      for (const project of task.projects) {
        const existing = projectMap.get(project) || [];
        existing.push(task);
        projectMap.set(project, existing);
      }
    } else {
      noProject.push(task);
    }
  }

  const projects = Array.from(projectMap.entries())
    .map(([project, tasks]) => ({ project, tasks }))
    .sort((a, b) => a.project.localeCompare(b.project));

  return { noProject, projects };
}

export type GroupedByProject = {
  noProject: Task[];
  projects: { project: string; tasks: Task[] }[];
};

// Flattened row model for the virtualized list. Project/evening headers and task
// rows live in a single array so the whole grouped/flat list can be windowed.
export type TaskRow =
  | { kind: 'task'; key: string; task: Task; showProject: boolean }
  | { kind: 'projectHeader'; key: string; name: string; color?: string; path?: string }
  | { kind: 'eveningHeader'; key: string };

// Flatten one grouped-by-project section into virtualizer rows. `keyPrefix` scopes the
// task keys so a task that appears in several projects (or in both the day and evening
// sections) never produces duplicate keys — react-virtual's per-key size cache needs
// unique keys, and duplicates make rows overlap.
function flattenSection(
  grouped: GroupedByProject,
  opts: {
    keyPrefix: string;
    headerKeyPrefix: string;
    resolve: (project: string) => { color?: string; path?: string };
  },
): TaskRow[] {
  const { keyPrefix, headerKeyPrefix, resolve } = opts;
  const out: TaskRow[] = [];
  for (const task of grouped.noProject) {
    out.push({ kind: 'task', key: `${keyPrefix}noproj:${task.id}`, task, showProject: true });
  }
  for (const { project, tasks } of grouped.projects) {
    const { color, path } = resolve(project);
    out.push({ kind: 'projectHeader', key: `${headerKeyPrefix}${project}`, name: project, color, path });
    for (const task of tasks) {
      out.push({ kind: 'task', key: `${keyPrefix}proj:${project}:${task.id}`, task, showProject: false });
    }
  }
  return out;
}

// Build the full grouped row list (day section + optional evening section) for the
// virtualized task list, with globally-unique row keys. `resolve` supplies each
// project's color/path (kept out of here so this stays a pure, testable function).
export function buildGroupedRows(
  day: GroupedByProject | null,
  evening: GroupedByProject | null,
  resolve: (project: string) => { color?: string; path?: string },
): TaskRow[] {
  if (!day) return [];
  const rows = flattenSection(day, { keyPrefix: '', headerKeyPrefix: 'header:', resolve });
  if (evening) {
    rows.push({ kind: 'eveningHeader', key: 'evening-header' });
    rows.push(...flattenSection(evening, { keyPrefix: 'evening-', headerKeyPrefix: 'evening-header:', resolve }));
  }
  return rows;
}
