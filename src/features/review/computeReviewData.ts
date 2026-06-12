import { Task, ProjectInfo, getWhenType } from '../../types/task';
import { formatDateForStorage, getToday } from '../../utils/dates';

export interface ReviewData {
  inboxTasks: Task[];
  overdueTasks: Task[];
  stalledTasks: Task[];
  quietProjects: ProjectInfo[];
  nextWeekTasks: Task[];
}

export function computeReviewData(tasks: Task[], projects: ProjectInfo[]): ReviewData {
  const todayStr = formatDateForStorage(getToday());
  const open = tasks.filter(t => !t.completed);

  const inboxTasks = open.filter(t =>
    getWhenType(t.when) === 'inbox' && t.projects.length === 0
  );

  const overdueTasks = open.filter(t => {
    if (t.deadline && t.deadline < todayStr) return true;
    if (typeof t.when === 'object' && 'date' in t.when && t.when.date < todayStr) return true;
    return false;
  });

  const staleDate = getToday();
  staleDate.setDate(staleDate.getDate() - 14);
  const staleThreshold = formatDateForStorage(staleDate);
  const overdueSet = new Set(overdueTasks.map(t => t.id));
  const inboxSet = new Set(inboxTasks.map(t => t.id));

  const stalledTasks = open.filter(t => {
    if (overdueSet.has(t.id) || inboxSet.has(t.id)) return false;
    if (!t.createdDate || t.createdDate > staleThreshold) return false;
    if (t.deadline) return false;
    const w = getWhenType(t.when);
    return w === 'inbox' || w === 'anytime';
  });

  const openTaskProjects = new Set(open.flatMap(t => t.projects));
  const quietProjects = projects.filter(p => !openTaskProjects.has(p.name));

  const tomorrow = getToday();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateForStorage(tomorrow);
  const nextWeekEnd = getToday();
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  const nextWeekEndStr = formatDateForStorage(nextWeekEnd);

  const nextWeekTasks = open.filter(t => {
    if (typeof t.when !== 'object' || !('date' in t.when)) return false;
    return t.when.date >= tomorrowStr && t.when.date <= nextWeekEndStr;
  });

  return { inboxTasks, overdueTasks, stalledTasks, quietProjects, nextWeekTasks };
}
