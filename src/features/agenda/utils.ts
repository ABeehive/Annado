import { DAY_START, DAY_END, DEFAULT_DURATION, PIXELS_PER_MINUTE } from './constants';
import { Task, CalendarEvent } from '../../types/task';
import { AgendaBlock, WorkSchedule } from './types';
import { getProjectColor } from '../../utils/projectColors';
import { getToday, formatDateForStorage, parseLocalDate, SHORT_DAY_NAMES, SHORT_MONTH_NAMES } from '../../utils/dates';

/** YYYY-MM-DD string for today (timezone-safe, unlike toISOString().slice) */
export function getTodayStr(): string {
  return formatDateForStorage(getToday());
}

/** Current time as minutes from midnight */
export function getNowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** Shift a YYYY-MM-DD string by `days` days */
export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateForStorage(d);
}

/** "HH:MM" → minutes from midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minutes from midnight → "07:30" */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Minutes → "1h30m" / "45m" / "2h" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Default color for tasks with no project */
export const DEFAULT_TASK_COLOR = '#5C6BC0';

/** Get the display color for a task (first project color, or default) */
export function getTaskColor(
  task: Task,
  availableProjects: { name: string; parentFolder: string | null }[],
  projectColors: Record<string, string>,
): string {
  if (task.projects.length > 0) {
    const proj = availableProjects.find(p => p.name === task.projects[0]);
    return getProjectColor(task.projects[0], proj?.parentFolder, projectColors);
  }
  return DEFAULT_TASK_COLOR;
}

/** Scroll a container so the current time is ~2h from the top */
export function scrollToCurrentTime(el: HTMLElement): void {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const scrollTo = Math.max(0, (minutes - DAY_START - 120) * PIXELS_PER_MINUTE);
  el.scrollTop = scrollTo;
}

// ── Schedule blocks ─────────────────────────────────────────────────

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function getScheduleBlocks(dateStr: string, workSchedule: WorkSchedule): AgendaBlock[] {
  const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun
  const dayKey = DAY_KEYS[dayOfWeek];
  const daySchedule = workSchedule.days[dayKey];
  if (!daySchedule) return [];

  const blocks: AgendaBlock[] = [];

  if (!daySchedule.enabled) {
    blocks.push({
      type: 'schedule', id: `schedule-off-${dateStr}`, title: 'Off',
      startMinutes: DAY_START, endMinutes: DAY_END,
      color: '#E0E0E0', isBlocking: true,
    });
    return blocks;
  }

  const workStart = timeToMinutes(daySchedule.startTime);
  const workEnd = timeToMinutes(daySchedule.endTime);

  if (workStart > DAY_START) {
    blocks.push({
      type: 'schedule', id: `schedule-before-${dateStr}`, title: 'Before work',
      startMinutes: DAY_START, endMinutes: workStart,
      color: '#E0E0E0', isBlocking: true,
    });
  }

  if (workEnd < DAY_END) {
    blocks.push({
      type: 'schedule', id: `schedule-after-${dateStr}`, title: 'After work',
      startMinutes: workEnd, endMinutes: DAY_END,
      color: '#E0E0E0', isBlocking: true,
    });
  }

  for (const brk of workSchedule.breaks) {
    if (brk.days && brk.days.length > 0 && !brk.days.includes(dayKey)) continue;
    const brkStart = timeToMinutes(brk.startTime);
    const brkEnd = timeToMinutes(brk.endTime);
    if (brkEnd > brkStart) {
      blocks.push({
        type: 'schedule', id: `schedule-break-${brk.id}-${dateStr}`, title: brk.name,
        startMinutes: brkStart, endMinutes: brkEnd,
        color: '#E0E0E0', isBlocking: true,
      });
    }
  }

  return blocks;
}

// ── Event helpers (shared with useAgendaData) ───────────────────────

/** Resolve whether a calendar event is blocking, considering overrides and defaults */
export function isEventBlocking(
  eventId: string,
  calendarName: string,
  eventBlockingOverrides: Record<string, boolean>,
  calendarBlockingDefaults: Record<string, boolean>,
): boolean {
  return eventBlockingOverrides[eventId]
    ?? calendarBlockingDefaults[calendarName]
    ?? true;
}

/** Compute start/end minutes-from-midnight for a timed event on a given date,
 *  clamping to 0–1440 for multi-day events. */
export function getEventMinutesForDate(
  event: { startDate: string; endDate: string },
  dateStr: string,
): { startMinutes: number; endMinutes: number } {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const eventDateStr = event.startDate.slice(0, 10);
  const endDateStr = event.endDate.slice(0, 10);

  const startMinutes = eventDateStr === dateStr
    ? startDate.getHours() * 60 + startDate.getMinutes()
    : 0;

  const endMinutes = endDateStr === dateStr
    ? endDate.getHours() * 60 + endDate.getMinutes()
    : 24 * 60;

  return { startMinutes, endMinutes };
}

// ── Gap-finding utilities (shared with useAutoSchedule) ─────────────

export interface Gap {
  start: number;
  end: number;
}

export function findGaps(
  occupiedSlots: { start: number; end: number }[],
  startFrom?: number,
): Gap[] {
  const sorted = [...occupiedSlots].sort((a, b) => a.start - b.start);
  const gaps: Gap[] = [];
  let cursor = startFrom != null ? Math.max(DAY_START, startFrom) : DAY_START;

  for (const slot of sorted) {
    if (slot.start > cursor) {
      gaps.push({ start: cursor, end: slot.start });
    }
    cursor = Math.max(cursor, slot.end);
  }

  if (cursor < DAY_END) {
    gaps.push({ start: cursor, end: DAY_END });
  }

  return gaps;
}

export function fitTaskInGaps(
  gaps: Gap[],
  duration: number,
): { gapIndex: number; startMinutes: number } | null {
  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    if (gap.end - gap.start >= duration) {
      return { gapIndex: i, startMinutes: gap.start };
    }
  }
  return null;
}

// ── Reschedule-suggestion slot finder ───────────────────────────────

export interface SlotSuggestion {
  dateStr: string;       // "YYYY-MM-DD"
  startMinutes: number;  // minutes from midnight
  dayLabel: string;      // "Today", "Tomorrow", "Thu", "Thu 26 Feb", etc.
  timeLabel: string;     // "09:00"
}

function makeDayLabel(candidateDate: string, todayDate: Date): string {
  const candDate = parseLocalDate(candidateDate);
  const diff = Math.round((candDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff >= 2 && diff <= 6) return SHORT_DAY_NAMES[candDate.getDay()];
  const dayName = SHORT_DAY_NAMES[candDate.getDay()];
  const monthName = SHORT_MONTH_NAMES[candDate.getMonth()];
  const dayNum = candDate.getDate();
  if (candDate.getFullYear() !== todayDate.getFullYear()) {
    return `${dayName} ${dayNum} ${monthName} ${candDate.getFullYear()}`;
  }
  return `${dayName} ${dayNum} ${monthName}`;
}

export function findNextAvailableSlots(
  taskDuration: number,
  currentDateStr: string,
  workSchedule: WorkSchedule,
  calendarEvents: CalendarEvent[],
  tasks: Task[],
  calendarBlockingDefaults: Record<string, boolean>,
  eventBlockingOverrides: Record<string, boolean>,
  maxResults: number = 3,
  maxDaysForward: number = 14,
): SlotSuggestion[] {
  const todayStr = getTodayStr();
  const todayDate = parseLocalDate(todayStr);
  const viewedDate = parseLocalDate(currentDateStr);

  // Build candidate list: earlier days first (closest to viewed date), then forward
  const candidates: string[] = [];

  // Days between today and viewed date (exclusive), closest-to-viewed first
  const daysBetween = Math.round((viewedDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));
  if (daysBetween > 0) {
    for (let offset = 1; offset < daysBetween; offset++) {
      candidates.push(addDays(currentDateStr, -offset));
    }
    // Include today itself
    candidates.push(todayStr);
  }

  // Days after viewed date
  for (let offset = 1; offset <= maxDaysForward; offset++) {
    candidates.push(addDays(currentDateStr, offset));
  }

  // Filter out dates before today and the viewed date itself
  const validCandidates = candidates.filter(d => d >= todayStr && d !== currentDateStr);

  const results: SlotSuggestion[] = [];

  for (const candidateDate of validCandidates) {
    if (results.length >= maxResults) break;

    // 1. Schedule blocks
    const schedBlocks = getScheduleBlocks(candidateDate, workSchedule);
    const occupiedSlots: { start: number; end: number }[] = schedBlocks.map(b => ({
      start: b.startMinutes,
      end: b.endMinutes,
    }));

    // 2. Timed calendar events on this date (blocking only)
    for (const event of calendarEvents) {
      if (event.isAllDay) continue;
      const startDate = event.startDate.slice(0, 10);
      const endDate = event.endDate.slice(0, 10);
      if (startDate > candidateDate || endDate < candidateDate) continue;

      if (!isEventBlocking(event.id, event.calendarName, eventBlockingOverrides, calendarBlockingDefaults)) continue;

      const { startMinutes: startMin, endMinutes: endMin } = getEventMinutesForDate(event, candidateDate);
      occupiedSlots.push({ start: startMin, end: endMin });
    }

    // 3. Pinned tasks on this date
    for (const task of tasks) {
      if (task.completed) continue;
      if (!task.scheduledTime) continue;
      if (typeof task.when !== 'object' || !('date' in task.when) || task.when.date !== candidateDate) continue;
      const start = timeToMinutes(task.scheduledTime);
      const dur = task.durationMinutes || DEFAULT_DURATION;
      occupiedSlots.push({ start, end: start + dur });
    }

    // 4. Find gaps and try to fit
    const isToday = candidateDate === todayStr;
    const gaps = findGaps(occupiedSlots, isToday ? getNowMinutes() : undefined);
    const fit = fitTaskInGaps(gaps, taskDuration);
    if (!fit) continue;

    results.push({
      dateStr: candidateDate,
      startMinutes: fit.startMinutes,
      dayLabel: makeDayLabel(candidateDate, todayDate),
      timeLabel: formatTime(fit.startMinutes),
    });
  }

  return results;
}
