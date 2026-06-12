import { WhenValue } from '../types/task';

export const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse a YYYY-MM-DD string safely (no timezone shift) */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Get today at midnight */
export function getToday(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

/** Difference in days between two dates (a - b), rounded to nearest integer */
export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** Check if a date string (YYYY-MM-DD) is today or earlier */
export function isDateTodayOrEarlier(dateStr: string): boolean {
  return parseLocalDate(dateStr).getTime() <= getToday().getTime();
}

/** Check if a date string (YYYY-MM-DD) is in the future */
export function isDateUpcoming(dateStr: string): boolean {
  return parseLocalDate(dateStr).getTime() > getToday().getTime();
}

/** Relative date label for the when pill. Returns null if no pill should be shown. */
export function formatWhenDisplay(when: WhenValue): string | null {
  if (typeof when === 'string') {
    switch (when) {
      case 'inbox':
      case 'anytime':
      case 'someday':
        return null;
      case 'today':
        return 'Today';
      case 'evening':
        return 'Evening';
      case 'tomorrow':
        return 'Tomorrow';
    }
  }

  if (typeof when === 'object' && 'date' in when) {
    const dateStr = when.date;
    if (!dateStr) return null;
    const date = parseLocalDate(dateStr);
    const today = getToday();
    const diff = diffDays(date, today);

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';

    const todayYear = today.getFullYear();
    const dateYear = date.getFullYear();

    if (diff >= 2 && diff <= 6) {
      return SHORT_DAY_NAMES[date.getDay()];
    }
    if (Math.abs(diff) <= 90 && dateYear === todayYear) {
      return `${date.getDate()} ${SHORT_MONTH_NAMES[date.getMonth()]}`;
    }
    // Past dates within same year also get short format
    if (diff < 0 && diff >= -90 && dateYear === todayYear) {
      return `${date.getDate()} ${SHORT_MONTH_NAMES[date.getMonth()]}`;
    }
    return `${date.getDate()} ${SHORT_MONTH_NAMES[date.getMonth()]} ${dateYear}`;
  }

  return null;
}

/** Countdown label for deadline display */
export function formatDeadlineCountdown(deadline: string): string {
  const date = parseLocalDate(deadline);
  const today = getToday();
  const diff = diffDays(date, today);

  if (diff < 0) return 'Overdue';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `${diff} days left`;
}

/** Urgency level for deadline coloring */
export function getDeadlineUrgency(deadline: string): 'overdue' | 'urgent' | 'approaching' | 'normal' {
  const diff = diffDays(parseLocalDate(deadline), getToday());

  if (diff < 0) return 'overdue';
  if (diff <= 2) return 'urgent';
  if (diff <= 7) return 'approaching';
  return 'normal';
}

/** Color map for deadline urgency levels */
export const DEADLINE_URGENCY_COLORS = {
  overdue: '#e84545',
  urgent: '#e84545',
  approaching: '#e89b45',
  normal: '#8b8fa3',
} as const;

/** Short date display: "15 Feb" or "15 Feb 2027" (if different year) */
export function formatDeadlineShort(deadline: string): string {
  const date = parseLocalDate(deadline);
  const today = getToday();
  const label = `${date.getDate()} ${SHORT_MONTH_NAMES[date.getMonth()]}`;
  if (date.getFullYear() !== today.getFullYear()) {
    return `${label} ${date.getFullYear()}`;
  }
  return label;
}

/**
 * Format a date string for display (e.g., "Jan 15, 2024")
 */
export function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Get next Monday from today
 */
export function getNextMonday(): Date {
  const today = getToday();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday;
}

/**
 * Get this weekend (Saturday). If already Sat/Sun, get next Saturday.
 */
export function getThisWeekend(): Date {
  const today = getToday();
  const dayOfWeek = today.getDay();
  let daysUntilSaturday: number;
  if (dayOfWeek === 6) {
    daysUntilSaturday = 7;
  } else if (dayOfWeek === 0) {
    daysUntilSaturday = 6;
  } else {
    daysUntilSaturday = 6 - dayOfWeek;
  }
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSaturday);
  return saturday;
}

/**
 * Get the end of the workweek: Friday of the current week.
 * If today is Friday, returns today; if Sat/Sun, the upcoming Friday.
 */
export function getEndOfWeek(): Date {
  const today = getToday();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 5 = Friday
  let daysUntilFriday = 5 - dayOfWeek;
  if (daysUntilFriday < 0) daysUntilFriday += 7;
  const friday = new Date(today);
  friday.setDate(today.getDate() + daysUntilFriday);
  return friday;
}

/**
 * Get the last day of the current month
 */
export function getEndOfMonth(): Date {
  const today = getToday();
  return new Date(today.getFullYear(), today.getMonth() + 1, 0);
}

/**
 * Get next weekend: Saturday of next week
 */
export function getNextWeekend(): Date {
  const saturday = getNextMonday();
  saturday.setDate(saturday.getDate() + 5);
  return saturday;
}

/**
 * Get the 1st of next month
 */
export function getNextMonth(): Date {
  const today = getToday();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return nextMonth;
}

/**
 * Get array of dates for a calendar grid (includes prev/next month padding)
 */
export function getCalendarDays(year: number, month: number, weekStartsOn: 'monday' | 'sunday' = 'monday'): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Calculate leading padding days
  let startPadding: number;
  if (weekStartsOn === 'sunday') {
    startPadding = firstDay.getDay(); // Sun=0, Mon=1, ...
  } else {
    // Monday = 0 in our grid, adjust from JS where Sunday = 0
    startPadding = firstDay.getDay() - 1;
    if (startPadding < 0) startPadding = 6;
  }

  // Add previous month's days for padding
  for (let i = startPadding - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push(d);
  }

  // Add current month's days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  // Add next month's days to fill the grid (6 rows x 7 days = 42)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

/**
 * Format date as YYYY-MM-DD for storage
 */
export function formatDateForStorage(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Date group types for the Upcoming view
 */
export type DateGroup = 'tomorrow' | 'this-week' | 'next-week' | 'next-month' | 'later';

/**
 * Get the date group for a given date string
 */
export function getDateGroup(dateStr: string): DateGroup {
  const date = parseLocalDate(dateStr);
  const today = getToday();

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Tomorrow: exactly 1 day from today
  if (isSameDay(date, tomorrow)) {
    return 'tomorrow';
  }

  // End of current week (Sunday)
  const endOfThisWeek = new Date(today);
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  endOfThisWeek.setDate(today.getDate() + daysUntilSunday);

  // This Week: after tomorrow, up to end of current week
  if (date > tomorrow && date <= endOfThisWeek) {
    return 'this-week';
  }

  // Next week boundaries
  const startOfNextWeek = new Date(endOfThisWeek);
  startOfNextWeek.setDate(startOfNextWeek.getDate() + 1);
  const endOfNextWeek = new Date(startOfNextWeek);
  endOfNextWeek.setDate(endOfNextWeek.getDate() + 6);

  // Next Week: Monday to Sunday of next week
  if (date >= startOfNextWeek && date <= endOfNextWeek) {
    return 'next-week';
  }

  // Next month boundaries
  const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  // Next Month: within the calendar month after current
  if (date >= startOfNextMonth && date <= endOfNextMonth) {
    return 'next-month';
  }

  // Later: everything else (2+ months out)
  return 'later';
}

/**
 * Get display label for a date group
 */
export function getDateGroupLabel(group: DateGroup): string {
  switch (group) {
    case 'tomorrow':
      return 'Tomorrow';
    case 'this-week':
      return 'This Week';
    case 'next-week':
      return 'Next Week';
    case 'next-month':
      return 'Next Month';
    case 'later':
      return 'Later';
  }
}

/**
 * Get tomorrow's date
 */
export function getTomorrow(): Date {
  const today = getToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return tomorrow;
}

/**
 * Get the day after tomorrow
 */
export function getDayAfterTomorrow(): Date {
  const today = getToday();
  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);
  return dayAfter;
}

const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface DaySection {
  dateStr: string;         // YYYY-MM-DD
  dayNumber: number;       // day of month (1-31)
  dayName: string;         // "Tomorrow", "Saturday", etc.
  monthLabel: string | null; // e.g. "March" when month changes, null otherwise
}

/**
 * Generate individual day sections starting from tomorrow.
 * Each section contains a dateStr, dayNumber, dayName, and optional monthLabel.
 */
export function getDaySections(numDays: number = 60): DaySection[] {
  const today = getToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sections: DaySection[] = [];
  let lastMonth = today.getMonth(); // track month changes, starting from today's month

  for (let i = 0; i < numDays; i++) {
    const date = new Date(tomorrow);
    date.setDate(tomorrow.getDate() + i);

    const dayOfWeek = date.getDay();
    let dayName: string;
    if (i === 0) {
      dayName = 'Tomorrow';
    } else {
      dayName = FULL_DAY_NAMES[dayOfWeek];
    }

    let monthLabel: string | null = null;
    if (date.getMonth() !== lastMonth) {
      monthLabel = FULL_MONTH_NAMES[date.getMonth()];
      lastMonth = date.getMonth();
    }

    sections.push({
      dateStr: formatDateForStorage(date),
      dayNumber: date.getDate(),
      dayName,
      monthLabel,
    });
  }

  return sections;
}
