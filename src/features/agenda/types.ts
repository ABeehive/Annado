import { Task, CalendarEvent } from '../../types/task';

export interface AgendaBlock {
  type: 'event' | 'task-pinned' | 'task-auto' | 'schedule';
  id: string;
  title: string;
  startMinutes: number;    // Minutes from midnight
  endMinutes: number;
  color: string;           // Calendar or project color
  isBlocking: boolean;     // Whether this block blocks auto-scheduling
  task?: Task;
  event?: CalendarEvent;
}

// ── Work Schedule types ────────────────────────────────────────────

export interface DaySchedule {
  enabled: boolean;
  startTime: string; // "HH:MM" e.g. "09:00"
  endTime: string;   // "HH:MM" e.g. "17:00"
}

export interface ScheduleBreak {
  id: string;        // nanoid or Date.now()
  name: string;      // "Lunch", "Focus time"
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  days?: string[];   // e.g. ['mon','tue','thu','fri'] — undefined/empty = all days
}

export interface WorkSchedule {
  days: Record<string, DaySchedule>; // keys: mon, tue, wed, thu, fri, sat, sun
  breaks: ScheduleBreak[];
}

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  days: {
    mon: { enabled: true,  startTime: '09:00', endTime: '17:00' },
    tue: { enabled: true,  startTime: '09:00', endTime: '17:00' },
    wed: { enabled: true,  startTime: '09:00', endTime: '17:00' },
    thu: { enabled: true,  startTime: '09:00', endTime: '17:00' },
    fri: { enabled: true,  startTime: '09:00', endTime: '17:00' },
    sat: { enabled: false, startTime: '09:00', endTime: '17:00' },
    sun: { enabled: false, startTime: '09:00', endTime: '17:00' },
  },
  breaks: [],
};

export interface WeekAllDayEvent {
  event: CalendarEvent;
  startDayIndex: number;  // 0-based into weekDays array (clamped)
  endDayIndex: number;    // inclusive
  row: number;            // row assignment for stacking
}

export interface DayAgenda {
  dateStr: string;
  blocks: AgendaBlock[];      // Sorted by startMinutes
  allDayEvents: CalendarEvent[];
  unscheduled: Task[];        // Tasks without time that didn't fit
  doesNotFit: Task[];         // Tasks scheduled for today but no room
}
