import { Task, ProjectInfo } from '../../types/task';
import { getProjectColor } from '../../utils/projectColors';
import { stripWikilinks } from '../../utils/textUtils';
import { parseLocalDate, formatDateForStorage, SHORT_DAY_NAMES, SHORT_MONTH_NAMES, getToday } from '../../utils/dates';
import { WrappedPeriod, WrappedDateRange, WrappedData } from './types';

function diffDays(a: string, b: string): number {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  return Math.round((db.getTime() - da.getTime()) / (86400000));
}

function getISOWeek(d: Date): number {
  const tmp = new Date(d.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/** Resolve the "area" for a project by walking up the metadata.up chain */
function resolveArea(
  projectName: string,
  projectMap: Map<string, ProjectInfo>,
): string {
  const visited = new Set<string>();
  let current = projectName;
  while (true) {
    if (visited.has(current)) break; // cycle guard
    visited.add(current);
    const info = projectMap.get(current);
    if (!info) break;
    const parent = info.metadata.up;
    if (!parent || !projectMap.has(parent)) {
      // This is the root — use parentFolder if available, else project name
      return info.parentFolder || current;
    }
    current = parent;
  }
  return current;
}

export function getWrappedDateRange(period: WrappedPeriod, offset: number = 0): WrappedDateRange {
  const now = getToday();

  if (period === 'weekly') {
    // ISO week: Monday = start
    const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const prevMonday = new Date(monday);
    prevMonday.setDate(monday.getDate() - 7);
    const prevSunday = new Date(monday);
    prevSunday.setDate(monday.getDate() - 1);
    return {
      start: formatDateForStorage(monday),
      end: formatDateForStorage(sunday),
      prevStart: formatDateForStorage(prevMonday),
      prevEnd: formatDateForStorage(prevSunday),
    };
  }

  if (period === 'monthly') {
    const year = now.getFullYear();
    const month = now.getMonth() + offset;
    const d = new Date(year, month, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const prevStart = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const prevEnd = new Date(d.getFullYear(), d.getMonth(), 0);
    return {
      start: formatDateForStorage(start),
      end: formatDateForStorage(end),
      prevStart: formatDateForStorage(prevStart),
      prevEnd: formatDateForStorage(prevEnd),
    };
  }

  // yearly
  const year = now.getFullYear() + offset;
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    prevStart: `${year - 1}-01-01`,
    prevEnd: `${year - 1}-12-31`,
  };
}

export function computeWrappedData(
  tasks: Task[],
  projects: ProjectInfo[],
  period: WrappedPeriod,
  range: WrappedDateRange,
  projectColors: Record<string, string>,
): WrappedData {
  const projectMap = new Map(projects.map((p) => [p.name, p]));

  // Filter completed tasks in range
  const completed = tasks.filter(
    (t) => t.completed && t.completedDate && t.completedDate >= range.start && t.completedDate <= range.end,
  );

  // Created tasks in range
  const created = tasks.filter(
    (t) => t.createdDate && t.createdDate >= range.start && t.createdDate <= range.end,
  );

  // Previous period completed
  const prevCompleted = range.prevStart && range.prevEnd
    ? tasks.filter(
        (t) => t.completed && t.completedDate && t.completedDate >= range.prevStart! && t.completedDate <= range.prevEnd!,
      )
    : null;

  const totalCompleted = completed.length;
  const totalCreated = created.length;
  const previousCompleted = prevCompleted ? prevCompleted.length : null;
  const deltaCompleted = previousCompleted !== null ? totalCompleted - previousCompleted : null;
  const completionRate = totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : 0;

  // Threshold
  const threshold = period === 'weekly' ? 3 : period === 'monthly' ? 10 : 20;
  const hasEnoughData = totalCompleted >= threshold;

  // --- Daily completed (for weekly) ---
  const dailyMap = new Map<string, number>();
  for (const t of completed) {
    const d = t.completedDate!;
    dailyMap.set(d, (dailyMap.get(d) || 0) + 1);
  }
  const dailyCompleted: { label: string; count: number }[] = [];
  if (period === 'weekly') {
    const start = parseLocalDate(range.start);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = formatDateForStorage(d);
      dailyCompleted.push({ label: SHORT_DAY_NAMES[d.getDay()], count: dailyMap.get(key) || 0 });
    }
  }

  // --- Weekly completed (for monthly) ---
  const weeklyCompleted: { label: string; count: number }[] = [];
  if (period === 'monthly') {
    const weekMap = new Map<number, number>();
    for (const t of completed) {
      const d = parseLocalDate(t.completedDate!);
      const w = getISOWeek(d);
      weekMap.set(w, (weekMap.get(w) || 0) + 1);
    }
    const startWeek = getISOWeek(parseLocalDate(range.start));
    const endWeek = getISOWeek(parseLocalDate(range.end));
    // Handle year boundary
    const weeks = endWeek >= startWeek
      ? Array.from({ length: endWeek - startWeek + 1 }, (_, i) => startWeek + i)
      : [...Array.from({ length: 53 - startWeek + 1 }, (_, i) => startWeek + i), ...Array.from({ length: endWeek }, (_, i) => i + 1)];
    for (const w of weeks) {
      weeklyCompleted.push({ label: `W${w}`, count: weekMap.get(w) || 0 });
    }
  }

  // --- Monthly completed (for yearly) ---
  const monthlyCompleted: { label: string; count: number }[] = [];
  if (period === 'yearly') {
    const monthMap = new Map<number, number>();
    for (const t of completed) {
      const d = parseLocalDate(t.completedDate!);
      monthMap.set(d.getMonth(), (monthMap.get(d.getMonth()) || 0) + 1);
    }
    for (let m = 0; m < 12; m++) {
      monthlyCompleted.push({ label: SHORT_MONTH_NAMES[m], count: monthMap.get(m) || 0 });
    }
  }

  // --- Weekday distribution ---
  const dayCount = new Array(7).fill(0);
  for (const t of completed) {
    const d = parseLocalDate(t.completedDate!);
    dayCount[d.getDay()]++;
  }
  const weekdayDistribution = SHORT_DAY_NAMES.map((day, i) => ({ day, count: dayCount[i] }));

  // --- Top projects (with previous-period momentum) ---
  const projectCount = new Map<string, number>();
  for (const t of completed) {
    for (const p of t.projects) {
      projectCount.set(p, (projectCount.get(p) || 0) + 1);
    }
  }
  const prevProjectCount = new Map<string, number>();
  if (prevCompleted) {
    for (const t of prevCompleted) {
      for (const p of t.projects) {
        prevProjectCount.set(p, (prevProjectCount.get(p) || 0) + 1);
      }
    }
  }
  const topProjects = [...projectCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, taskCount]) => {
      const info = projectMap.get(name);
      const prevTasks = prevProjectCount.get(name) ?? 0;
      const momentum: 'up' | 'down' | 'flat' =
        prevCompleted === null ? 'flat'
        : taskCount > prevTasks ? 'up'
        : taskCount < prevTasks ? 'down'
        : 'flat';
      return {
        name,
        area: info ? resolveArea(name, projectMap) : null,
        tasks: taskCount,
        color: getProjectColor(name, info?.parentFolder, projectColors),
        prevTasks,
        momentum,
      };
    });

  // --- Areas ---
  const areaCount = new Map<string, number>();
  const areaColors = new Map<string, string>();
  for (const t of completed) {
    for (const p of t.projects) {
      const info = projectMap.get(p);
      const area = info ? resolveArea(p, projectMap) : 'Other';
      areaCount.set(area, (areaCount.get(area) || 0) + 1);
      if (!areaColors.has(area) && info) {
        areaColors.set(area, getProjectColor(area, null, projectColors));
      }
    }
    if (t.projects.length === 0) {
      areaCount.set('No Project', (areaCount.get('No Project') || 0) + 1);
    }
  }
  const areaTotal = [...areaCount.values()].reduce((a, b) => a + b, 0) || 1;
  const areas = [...areaCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      tasks: count,
      pct: Math.round((count / areaTotal) * 100),
      color: areaColors.get(name) || '#5C6BC0',
    }));

  // --- Tags ---
  const tagCount = new Map<string, number>();
  for (const t of completed) {
    for (const tag of t.tags) {
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
    }
  }
  const topTags = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  // --- Persons ---
  const personCount = new Map<string, number>();
  for (const t of completed) {
    for (const p of t.persons) {
      personCount.set(p, (personCount.get(p) || 0) + 1);
    }
  }
  const topPersons = [...personCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, tasks: count }));

  // --- Longest task (completed - created) ---
  let longestTask: WrappedData['longestTask'] = null;
  for (const t of completed) {
    if (!t.createdDate || !t.completedDate) continue;
    const days = diffDays(t.createdDate, t.completedDate);
    if (days > 0 && (!longestTask || days > longestTask.days)) {
      longestTask = {
        title: stripWikilinks(t.title),
        days,
        project: t.projects[0] || null,
      };
    }
  }

  // --- Stalest open task ---
  let stalestTask: WrappedData['stalestTask'] = null;
  const today = formatDateForStorage(getToday());
  for (const t of tasks) {
    if (t.completed || !t.createdDate) continue;
    const daysOpen = diffDays(t.createdDate, today);
    if (daysOpen > 0 && (!stalestTask || daysOpen > stalestTask.daysOpen)) {
      stalestTask = { title: stripWikilinks(t.title), daysOpen };
    }
  }

  // --- Streak ---
  const completedDates = [...new Set(completed.map((t) => t.completedDate!))].sort();
  let longestStreak = 0;
  let currentStreak = 1;
  for (let i = 1; i < completedDates.length; i++) {
    if (diffDays(completedDates[i - 1], completedDates[i]) === 1) {
      currentStreak++;
    } else {
      longestStreak = Math.max(longestStreak, currentStreak);
      currentStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak);
  if (completedDates.length === 0) longestStreak = 0;

  // --- Priority breakdown ---
  const priorityBreakdown = { high: 0, medium: 0, low: 0, none: 0 };
  for (const t of completed) {
    if (t.priority === 1) priorityBreakdown.high++;
    else if (t.priority === 2) priorityBreakdown.medium++;
    else if (t.priority === 3) priorityBreakdown.low++;
    else priorityBreakdown.none++;
  }

  // --- Look-ahead ---
  const upcomingOpen = tasks.filter((t) => !t.completed);
  const upcomingTasks = upcomingOpen.length;
  const upcomingDeadlines = upcomingOpen
    .filter((t) => t.deadline && t.deadline >= today)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
    .slice(0, 5)
    .map((t) => ({ title: stripWikilinks(t.title), deadline: t.deadline! }));

  // --- Personality type (yearly only) ---
  let personalityType: string | undefined;
  let personalitySubtitle: string | undefined;
  if (period === 'yearly' && hasEnoughData) {
    const maxDay = weekdayDistribution.reduce((a, b) => (b.count > a.count ? b : a));
    const hasHighPriority = priorityBreakdown.high > totalCompleted * 0.3;
    const hasStreak = longestStreak >= 7;
    const projectDiversity = topProjects.length;

    if (hasStreak && hasHighPriority) {
      personalityType = 'The Streak Machine';
      personalitySubtitle = 'Consistent, focused, and high-priority driven';
    } else if (projectDiversity >= 5) {
      personalityType = 'The Juggler';
      personalitySubtitle = 'Balancing many projects with ease';
    } else if (maxDay.day === 'Sat' || maxDay.day === 'Sun') {
      personalityType = 'The Weekend Warrior';
      personalitySubtitle = 'Saving the best work for the weekend';
    } else if (longestStreak >= 5) {
      personalityType = 'The Marathoner';
      personalitySubtitle = 'Steady progress, day after day';
    } else if (hasHighPriority) {
      personalityType = 'The Prioritizer';
      personalitySubtitle = 'Always tackling what matters most';
    } else if (totalCompleted >= 100) {
      personalityType = 'The Powerhouse';
      personalitySubtitle = 'Sheer volume of work completed';
    } else {
      personalityType = 'The Steady Builder';
      personalitySubtitle = 'Consistent progress throughout the year';
    }
  }

  // --- Heatmap (yearly: every day in the year → count) ---
  const heatmapDays: { date: string; count: number }[] = [];
  if (period === 'yearly') {
    const heatMap = new Map<string, number>();
    for (const t of completed) {
      if (t.completedDate) heatMap.set(t.completedDate, (heatMap.get(t.completedDate) || 0) + 1);
    }
    const start = parseLocalDate(range.start);
    const end = parseLocalDate(range.end);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = formatDateForStorage(d);
      heatmapDays.push({ date: key, count: heatMap.get(key) || 0 });
    }
  }

  // --- Task age at completion ---
  const ageBuckets = [
    { label: 'Same day', min: 0, max: 0 },
    { label: '1–7 days', min: 1, max: 7 },
    { label: '1–4 weeks', min: 8, max: 28 },
    { label: '1–3 months', min: 29, max: 90 },
    { label: '3+ months', min: 91, max: Infinity },
  ];
  const ageCounts = new Array(ageBuckets.length).fill(0);
  for (const t of completed) {
    if (!t.createdDate || !t.completedDate) continue;
    const age = diffDays(t.createdDate, t.completedDate);
    if (age < 0) continue;
    const idx = ageBuckets.findIndex((b) => age >= b.min && age <= b.max);
    if (idx >= 0) ageCounts[idx]++;
  }
  const taskAgeBuckets = ageBuckets.map((b, i) => ({ label: b.label, count: ageCounts[i] }));

  // --- Period label ---
  let periodLabel: string;
  if (period === 'weekly') {
    const w = getISOWeek(parseLocalDate(range.start));
    periodLabel = `Week ${w}`;
  } else if (period === 'monthly') {
    const d = parseLocalDate(range.start);
    periodLabel = SHORT_MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
  } else {
    periodLabel = range.start.slice(0, 4);
  }

  return {
    period,
    periodLabel,
    dateRange: range,
    hasEnoughData,
    totalCompleted,
    totalCreated,
    completionRate,
    previousCompleted,
    deltaCompleted,
    dailyCompleted,
    weeklyCompleted,
    monthlyCompleted,
    weekdayDistribution,
    topProjects,
    areas,
    topTags,
    topPersons,
    longestTask,
    stalestTask,
    longestStreak,
    priorityBreakdown,
    upcomingTasks,
    upcomingDeadlines,
    personalityType,
    personalitySubtitle,
    heatmapDays,
    taskAgeBuckets,
  };
}
