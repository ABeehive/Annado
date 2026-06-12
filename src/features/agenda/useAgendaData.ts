import { useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { Task, getWhenType } from '../../types/task';
import { AgendaBlock, DayAgenda, WeekAllDayEvent } from './types';
import { DEFAULT_DURATION, MAX_ALL_DAY_ROWS } from './constants';
import { timeToMinutes, getTaskColor, getTodayStr, DEFAULT_TASK_COLOR, getScheduleBlocks, isEventBlocking, getEventMinutesForDate } from './utils';
import { useAutoSchedule } from './useAutoSchedule';
import { parseLocalDate } from '../../utils/dates';

function isExactDateMatch(task: Task, dateStr: string): boolean {
  const whenType = getWhenType(task.when);
  if (whenType === 'date' && typeof task.when === 'object' && 'date' in task.when) {
    return task.when.date === dateStr;
  }
  return false;
}

function isDeadlineOnDate(task: Task, dateStr: string): boolean {
  return task.deadline === dateStr;
}

function isTodayOrEarlierWhenDate(task: Task, todayStr: string): boolean {
  const whenType = getWhenType(task.when);
  if (whenType === 'date' && typeof task.when === 'object' && 'date' in task.when) {
    return task.when.date <= todayStr;
  }
  if (whenType === 'today' || whenType === 'evening') return true;
  return false;
}

function isDeadlineTodayOrEarlier(task: Task, todayStr: string): boolean {
  if (!task.deadline) return false;
  return task.deadline <= todayStr;
}

/**
 * Split schedule blocks around real events/tasks so free-time zones
 * render as separate fragments that don't overlap real blocks.
 */
export function splitScheduleBlocksForDisplay(
  scheduleBlocks: AgendaBlock[],
  realBlocks: AgendaBlock[],
): AgendaBlock[] {
  const fragments: AgendaBlock[] = [];

  for (const sched of scheduleBlocks) {
    // Find real blocks that overlap this schedule block
    const overlapping = realBlocks
      .filter(r => r.startMinutes < sched.endMinutes && r.endMinutes > sched.startMinutes)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    if (overlapping.length === 0) {
      fragments.push(sched);
      continue;
    }

    let cursor = sched.startMinutes;
    let fragIndex = 0;

    for (const overlap of overlapping) {
      if (overlap.startMinutes > cursor) {
        // Emit fragment before this overlap
        const fragStart = cursor;
        const fragEnd = overlap.startMinutes;
        if (fragEnd - fragStart >= 10) {
          fragments.push({
            ...sched,
            id: `${sched.id}-frag-${fragIndex}`,
            title: fragIndex === 0 ? sched.title : '',
            startMinutes: fragStart,
            endMinutes: fragEnd,
          });
          fragIndex++;
        }
      }
      cursor = Math.max(cursor, overlap.endMinutes);
    }

    // Emit final fragment after all overlaps
    if (cursor < sched.endMinutes && sched.endMinutes - cursor >= 10) {
      fragments.push({
        ...sched,
        id: `${sched.id}-frag-${fragIndex}`,
        title: fragIndex === 0 ? sched.title : '',
        startMinutes: cursor,
        endMinutes: sched.endMinutes,
      });
    }
  }

  return fragments;
}

export function useAgendaData(dateStr: string): DayAgenda {
  const {
    tasks,
    calendarEvents,
    projectColors,
    availableProjects,
    calendarBlockingDefaults,
    eventBlockingOverrides,
    workSchedule,
    defaultTaskDuration,
  } = useTaskStore();

  const todayStr = getTodayStr();
  const isToday = dateStr === todayStr;
  const isFuture = dateStr > todayStr;

  // Filter calendar events for this date
  const dayEvents = useMemo(() => {
    return calendarEvents.filter(event => {
      const startDate = event.startDate.slice(0, 10);
      const endDate = event.endDate.slice(0, 10);
      if (event.isAllDay) {
        // EventKit end date is exclusive (midnight of the day after the last day).
        // When start === end (some birthdays), treat as a single-day match.
        if (endDate === startDate) return startDate === dateStr;
        return startDate <= dateStr && endDate > dateStr;
      }
      return startDate <= dateStr && endDate >= dateStr;
    });
  }, [calendarEvents, dateStr]);

  const allDayEvents = useMemo(() => dayEvents.filter(e => e.isAllDay), [dayEvents]);
  const timedEvents = useMemo(() => dayEvents.filter(e => !e.isAllDay), [dayEvents]);

  // Build event blocks
  const eventBlocks: AgendaBlock[] = useMemo(() => {
    return timedEvents.map(event => {
      const { startMinutes, endMinutes } = getEventMinutesForDate(event, dateStr);

      return {
        type: 'event' as const,
        id: `event-${event.id}`,
        title: event.title,
        startMinutes,
        endMinutes,
        color: event.calendarColor || DEFAULT_TASK_COLOR,
        isBlocking: isEventBlocking(event.id, event.calendarName, eventBlockingOverrides, calendarBlockingDefaults),
        event,
      };
    });
  }, [timedEvents, dateStr, calendarBlockingDefaults, eventBlockingOverrides]);

  // Get tasks for this date
  const { pinnedTasks, deadlineTasks, whenTasks, anytimeTasks } = useMemo(() => {
    const pinned: Task[] = [];
    const deadline: Task[] = [];
    const when: Task[] = [];
    const anytime: Task[] = [];

    for (const task of tasks) {
      if (task.completed) continue;

      if (isToday) {
        // TODAY: include overdue + today tasks + anytime
        if (task.scheduledTime && isTodayOrEarlierWhenDate(task, todayStr)) {
          pinned.push(task);
          continue;
        }

        if (!task.scheduledTime) {
          // Deadline tasks for today or overdue
          const hasDeadline = isDeadlineTodayOrEarlier(task, todayStr);
          const hasWhenDate = isTodayOrEarlierWhenDate(task, todayStr);

          if (hasDeadline) {
            deadline.push(task);
            continue;
          }
          if (hasWhenDate) {
            when.push(task);
            continue;
          }

          // Anytime tasks (fill remaining gaps)
          const whenType = getWhenType(task.when);
          if (whenType === 'anytime') {
            anytime.push(task);
            continue;
          }
        }
      } else if (isFuture) {
        // FUTURE: only tasks with exact when-date match or exact deadline match for this day
        // No overdue, no anytime
        if (task.scheduledTime && isExactDateMatch(task, dateStr)) {
          pinned.push(task);
          continue;
        }

        if (!task.scheduledTime) {
          const hasExactDate = isExactDateMatch(task, dateStr);
          const hasExactDeadline = isDeadlineOnDate(task, dateStr);

          if (hasExactDeadline) {
            deadline.push(task);
            continue;
          }
          if (hasExactDate) {
            when.push(task);
            continue;
          }
        }
      } else {
        // PAST: only exact date match (no overdue spillover to arbitrary past days)
        if (task.scheduledTime && isExactDateMatch(task, dateStr)) {
          pinned.push(task);
          continue;
        }

        if (!task.scheduledTime) {
          if (isExactDateMatch(task, dateStr)) {
            when.push(task);
            continue;
          }
          if (isDeadlineOnDate(task, dateStr)) {
            deadline.push(task);
            continue;
          }
        }
      }
    }

    return { pinnedTasks: pinned, deadlineTasks: deadline, whenTasks: when, anytimeTasks: anytime };
  }, [tasks, dateStr, isToday, isFuture, todayStr]);

  // Build pinned task blocks
  const pinnedBlocks: AgendaBlock[] = useMemo(() => {
    return pinnedTasks.map(task => {
      const startMinutes = task.scheduledTime ? timeToMinutes(task.scheduledTime) : 0;
      const duration = task.durationMinutes || defaultTaskDuration || DEFAULT_DURATION;
      const color = getTaskColor(task, availableProjects, projectColors);

      return {
        type: 'task-pinned' as const,
        id: `pinned-${task.id}`,
        title: task.title,
        startMinutes,
        endMinutes: startMinutes + duration,
        color,
        isBlocking: true,
        task,
      };
    });
  }, [pinnedTasks, projectColors, availableProjects]);

  // Schedule-based blocking blocks (work hours, off-days, breaks)
  const scheduleBlocks = useMemo(() => {
    return getScheduleBlocks(dateStr, workSchedule);
  }, [dateStr, workSchedule]);

  // All blocking blocks for auto-scheduling
  const blockingBlocks = useMemo(() => {
    return [...eventBlocks.filter(b => b.isBlocking), ...pinnedBlocks, ...scheduleBlocks];
  }, [eventBlocks, pinnedBlocks, scheduleBlocks]);

  // Auto-schedule remaining tasks
  const { autoBlocks, doesNotFit } = useAutoSchedule(
    dateStr,
    blockingBlocks,
    deadlineTasks,
    whenTasks,
    anytimeTasks,
    projectColors,
    availableProjects,
  );

  // Combine all blocks sorted by start time
  // Schedule blocks are split around real blocks for display only
  const allBlocks = useMemo(() => {
    const realBlocks = [...eventBlocks, ...pinnedBlocks, ...autoBlocks];
    const displaySchedule = splitScheduleBlocksForDisplay(scheduleBlocks, realBlocks);
    return [...realBlocks, ...displaySchedule]
      .sort((a, b) => a.startMinutes - b.startMinutes);
  }, [eventBlocks, pinnedBlocks, autoBlocks, scheduleBlocks]);

  return {
    dateStr,
    blocks: allBlocks,
    allDayEvents,
    unscheduled: anytimeTasks.filter(t => doesNotFit.includes(t)),
    doesNotFit: doesNotFit.filter(t => !anytimeTasks.includes(t) || deadlineTasks.includes(t) || whenTasks.includes(t)),
  };
}

/**
 * Compute the local start and inclusive end date for an all-day event.
 * EventKit uses exclusive end dates (endDate = midnight of day AFTER the last day).
 * Instead of trying to detect midnight, we use the duration in days:
 * - span = max(1, durationDays) so birthdays (start==end) still show as 1 day
 * - inclusive end = start + span - 1
 */
function getAllDayRange(startIso: string, endIso: string): { start: string; end: string } {
  const s = parseLocalDate(startIso.slice(0, 10));
  const e = parseLocalDate(endIso.slice(0, 10));

  const durationDays = Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000));
  const spanDays = Math.max(1, durationDays);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const startStr = fmt(s);
  const endD = new Date(s.getTime());
  endD.setDate(endD.getDate() + spanDays - 1);

  return { start: startStr, end: fmt(endD) };
}

/**
 * Collect all-day events for a week view with row-packing for stacking.
 */
export function useWeekAllDayEvents(weekDays: string[]): {
  allDayEvents: WeekAllDayEvent[];
  rowCount: number;
} {
  const { calendarEvents } = useTaskStore();

  return useMemo(() => {
    if (weekDays.length === 0) return { allDayEvents: [], rowCount: 0 };

    const weekStart = weekDays[0];
    const weekEnd = weekDays[weekDays.length - 1];

    // Filter all-day events that overlap the week
    const relevant = calendarEvents.filter(e => {
      if (!e.isAllDay) return false;
      const { start: eStart, end: eEnd } = getAllDayRange(e.startDate, e.endDate);
      return eStart <= weekEnd && eEnd >= weekStart;
    });

    // Map to WeekAllDayEvent (without row yet)
    const mapped = relevant.map(event => {
      const { start: eStart, end: eEnd } = getAllDayRange(event.startDate, event.endDate);
      let startIdx = 0;
      for (let i = 0; i < weekDays.length; i++) {
        if (weekDays[i] >= eStart) { startIdx = i; break; }
      }
      let endIdx = weekDays.length - 1;
      for (let i = weekDays.length - 1; i >= 0; i--) {
        if (weekDays[i] <= eEnd) { endIdx = i; break; }
      }
      const startDayIndex = startIdx;
      const endDayIndex = endIdx;
      return { event, startDayIndex, endDayIndex, row: 0 };
    });

    // Sort: longest span first, then by start index
    mapped.sort((a, b) => {
      const spanA = a.endDayIndex - a.startDayIndex;
      const spanB = b.endDayIndex - b.startDayIndex;
      if (spanB !== spanA) return spanB - spanA;
      return a.startDayIndex - b.startDayIndex;
    });

    // Greedy row packing
    // rows[r][c] = true if column c in row r is occupied
    const rows: boolean[][] = [];

    for (const item of mapped) {
      let placed = false;
      for (let r = 0; r < rows.length; r++) {
        let free = true;
        for (let c = item.startDayIndex; c <= item.endDayIndex; c++) {
          if (rows[r][c]) { free = false; break; }
        }
        if (free) {
          item.row = r;
          for (let c = item.startDayIndex; c <= item.endDayIndex; c++) rows[r][c] = true;
          placed = true;
          break;
        }
      }
      if (!placed) {
        const newRow = new Array(weekDays.length).fill(false);
        for (let c = item.startDayIndex; c <= item.endDayIndex; c++) newRow[c] = true;
        item.row = rows.length;
        rows.push(newRow);
      }
    }

    const rowCount = Math.min(rows.length, MAX_ALL_DAY_ROWS);
    const visible = mapped.filter(e => e.row < MAX_ALL_DAY_ROWS);

    return { allDayEvents: visible, rowCount };
  }, [calendarEvents, weekDays]);
}
