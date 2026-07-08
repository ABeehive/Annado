import { Task, ViewType, getWhenType, SmartListFilter } from '../types/task';
import { isDateTodayOrEarlier, isDateUpcoming, getToday, formatDateForStorage, parseLocalDate, diffDays } from '../utils/dates';
import { tagsMatchFilter } from '../utils/tags';

export function filterTasks(
  tasks: Task[],
  view: ViewType,
  project: string | null,
  person: string | null,
  tag: string | null
): Task[] {
  const getDateSortKey = (task: Task): number => {
    const today = getToday();
    const whenType = getWhenType(task.when);
    if (whenType === 'date' && typeof task.when === 'object' && 'date' in task.when) {
      const taskDate = new Date(task.when.date);
      taskDate.setHours(0, 0, 0, 0);
      const diff = taskDate.getTime() - today.getTime();
      if (diff < 0) return 0;
      if (diff === 0) return 1;
      return 2;
    }
    if (whenType === 'today' || whenType === 'evening') return 1;
    if (whenType === 'tomorrow') return 2;
    return 3;
  };

  if (tag) {
    return tasks
      .filter((task) => tagsMatchFilter([...task.tags, ...task.inheritedTags], tag) && !task.completed)
      .sort((a, b) => getDateSortKey(a) - getDateSortKey(b));
  }

  if (person) {
    return tasks
      .filter((task) => task.persons.includes(person) && !task.completed)
      .sort((a, b) => getDateSortKey(a) - getDateSortKey(b));
  }

  if (project) {
    return tasks
      .filter((task) => task.projects.includes(project) && !task.completed)
      .sort((a, b) => getDateSortKey(a) - getDateSortKey(b));
  }

  return tasks.filter((task) => {
    if (view === 'logbook') return task.completed;
    if (task.completed) return false;
    const whenType = getWhenType(task.when);
    switch (view) {
      case 'inbox':
        return whenType === 'inbox' && task.projects.length === 0;
      case 'today':
        if (whenType === 'today' || whenType === 'evening') return true;
        if (whenType === 'date' && typeof task.when === 'object' && 'date' in task.when) {
          return isDateTodayOrEarlier(task.when.date);
        }
        if (task.deadline && isDateTodayOrEarlier(task.deadline)) return true;
        return false;
      case 'upcoming':
        if (whenType === 'tomorrow') return true;
        if (whenType === 'date' && typeof task.when === 'object' && 'date' in task.when) {
          return isDateUpcoming(task.when.date);
        }
        if (task.deadline && isDateUpcoming(task.deadline)) return true;
        return false;
      case 'anytime':
        return whenType === 'anytime';
      case 'someday':
        return whenType === 'someday';
      case 'added-today': {
        const todayStr = formatDateForStorage(getToday());
        return task.createdDate === todayStr;
      }
      case 'wrapped':
      case 'agenda':
        return false;
      default:
        return true;
    }
  });
}

/**
 * Count the tasks a sidebar view shows in its badge. Standard views delegate to
 * `filterTasks` so the badge can never drift from the list; only views that
 * `filterTasks` doesn't compute (recurring templates, the unbadged Review) are
 * handled here.
 */
export function getViewCount(tasks: Task[], view: ViewType): number {
  if (view === 'recurring') {
    return tasks.filter((t) => t.recurrence && !t.completed).length;
  }
  // `filterTasks` has no 'review' case (its default would count everything) and the
  // Review view carries no badge — keep it explicitly unbadged.
  if (view === 'review') return 0;
  // Single source of truth: the badge counts exactly what the list shows, so the
  // two can never drift (e.g. the Today deadline rule stays in lockstep).
  return filterTasks(tasks, view, null, null, null).length;
}

/**
 * Run a task filter while keeping just-completed ("lingering") tasks visible.
 * Lingering tasks are masked as uncompleted so they pass view filters, then the
 * real task objects are substituted back so the UI shows the checked state.
 */
export function withCompletionLinger(
  tasks: Task[],
  lingeringIds: string[],
  filter: (tasks: Task[]) => Task[]
): Task[] {
  if (lingeringIds.length === 0) return filter(tasks);
  const lingering = new Set(lingeringIds);
  const masked = tasks.map((t) =>
    lingering.has(t.id) && t.completed ? { ...t, completed: false } : t
  );
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return filter(masked).map((t) => (lingering.has(t.id) ? byId.get(t.id)! : t));
}

export function filterTasksForSmartList(
  tasks: Task[],
  filter: SmartListFilter,
  todayStr: string,
): Task[] {
  let base = filter.baseView
    ? filterTasks(tasks, filter.baseView, null, null, null)
    : tasks.filter((t) => !t.completed);

  if (filter.priority !== undefined)
    base = base.filter((t) => t.priority === filter.priority);
  if (filter.hasDeadline !== undefined)
    base = base.filter((t) => filter.hasDeadline ? !!t.deadline : !t.deadline);
  if (filter.minAgeDays !== undefined)
    base = base.filter((t) => t.createdDate != null &&
      diffDays(parseLocalDate(todayStr), parseLocalDate(t.createdDate)) >= filter.minAgeDays!);
  if (filter.projects && filter.projects.length > 0)
    base = base.filter((t) => filter.projects!.some((p) => t.projects.includes(p)));
  if (filter.person)
    base = base.filter((t) => t.persons.includes(filter.person!));
  if (filter.tag)
    base = base.filter((t) => tagsMatchFilter([...t.tags, ...t.inheritedTags], filter.tag!));
  if (filter.dueWithin) {
    const { amount, unit } = filter.dueWithin;
    const cutoff = parseLocalDate(todayStr);
    if (unit === 'days')        cutoff.setDate(cutoff.getDate() + amount);
    else if (unit === 'weeks')  cutoff.setDate(cutoff.getDate() + amount * 7);
    else if (unit === 'months') cutoff.setMonth(cutoff.getMonth() + amount);
    const cutoffStr = formatDateForStorage(cutoff);
    base = base.filter((t) => {
      if (t.deadline && t.deadline >= todayStr && t.deadline <= cutoffStr) return true;
      if (typeof t.when === 'object' && 'date' in t.when)
        return t.when.date >= todayStr && t.when.date <= cutoffStr;
      return false;
    });
  }

  return base;
}
