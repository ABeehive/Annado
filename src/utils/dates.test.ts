import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  parseLocalDate,
  getToday,
  diffDays,
  isDateTodayOrEarlier,
  isDateUpcoming,
  formatWhenDisplay,
  formatDeadlineCountdown,
  getDeadlineUrgency,
  formatDeadlineShort,
  formatDateForStorage,
  isSameDay,
  getDateGroup,
  getNextMonday,
  getThisWeekend,
  getNextWeekend,
  getNextMonth,
  getEndOfWeek,
  getEndOfMonth,
  getTomorrow,
  getCalendarDays,
  getDaySections,
} from './dates';

// Freeze time at Wednesday, 10 June 2026, noon — all expectations below derive from this.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
});

afterAll(() => {
  vi.useRealTimers();
});

describe('parseLocalDate', () => {
  it('parses YYYY-MM-DD without timezone shift', () => {
    const d = parseLocalDate('2026-06-10');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(10);
    expect(d.getHours()).toBe(0);
  });
});

describe('getToday / diffDays', () => {
  it('returns today at midnight', () => {
    const t = getToday();
    expect(formatDateForStorage(t)).toBe('2026-06-10');
    expect(t.getHours()).toBe(0);
  });

  it('computes day differences', () => {
    expect(diffDays(parseLocalDate('2026-06-15'), getToday())).toBe(5);
    expect(diffDays(parseLocalDate('2026-06-05'), getToday())).toBe(-5);
    expect(diffDays(getToday(), getToday())).toBe(0);
  });
});

describe('isDateTodayOrEarlier / isDateUpcoming', () => {
  it('classifies past, today, and future dates', () => {
    expect(isDateTodayOrEarlier('2026-06-10')).toBe(true);
    expect(isDateTodayOrEarlier('2026-06-09')).toBe(true);
    expect(isDateTodayOrEarlier('2026-06-11')).toBe(false);
    expect(isDateUpcoming('2026-06-11')).toBe(true);
    expect(isDateUpcoming('2026-06-10')).toBe(false);
  });
});

describe('formatWhenDisplay', () => {
  it('returns null for views without a pill', () => {
    expect(formatWhenDisplay('inbox')).toBeNull();
    expect(formatWhenDisplay('anytime')).toBeNull();
    expect(formatWhenDisplay('someday')).toBeNull();
  });

  it('labels string when-values', () => {
    expect(formatWhenDisplay('today')).toBe('Today');
    expect(formatWhenDisplay('evening')).toBe('Evening');
    expect(formatWhenDisplay('tomorrow')).toBe('Tomorrow');
  });

  it('labels date when-values relative to today', () => {
    expect(formatWhenDisplay({ date: '2026-06-10' })).toBe('Today');
    expect(formatWhenDisplay({ date: '2026-06-11' })).toBe('Tomorrow');
    // 2-6 days out: weekday name
    expect(formatWhenDisplay({ date: '2026-06-13' })).toBe('Sat');
    expect(formatWhenDisplay({ date: '2026-06-16' })).toBe('Tue');
    // within 90 days, same year: short date
    expect(formatWhenDisplay({ date: '2026-06-20' })).toBe('20 Jun');
    // beyond 90 days: with year
    expect(formatWhenDisplay({ date: '2026-12-25' })).toBe('25 Dec 2026');
    expect(formatWhenDisplay({ date: '2027-01-05' })).toBe('5 Jan 2027');
  });

  it('returns null for empty date', () => {
    expect(formatWhenDisplay({ date: '' })).toBeNull();
  });
});

describe('formatDeadlineCountdown / getDeadlineUrgency', () => {
  it('formats countdown labels', () => {
    expect(formatDeadlineCountdown('2026-06-09')).toBe('Overdue');
    expect(formatDeadlineCountdown('2026-06-10')).toBe('Today');
    expect(formatDeadlineCountdown('2026-06-11')).toBe('Tomorrow');
    expect(formatDeadlineCountdown('2026-06-15')).toBe('5 days left');
  });

  it('maps deadlines to urgency buckets', () => {
    expect(getDeadlineUrgency('2026-06-09')).toBe('overdue');
    expect(getDeadlineUrgency('2026-06-10')).toBe('urgent');
    expect(getDeadlineUrgency('2026-06-12')).toBe('urgent');
    expect(getDeadlineUrgency('2026-06-17')).toBe('approaching');
    expect(getDeadlineUrgency('2026-06-18')).toBe('normal');
  });
});

describe('formatDeadlineShort', () => {
  it('omits the year for same-year dates', () => {
    expect(formatDeadlineShort('2026-02-15')).toBe('15 Feb');
    expect(formatDeadlineShort('2027-02-15')).toBe('15 Feb 2027');
  });
});

describe('formatDateForStorage / isSameDay', () => {
  it('round-trips with parseLocalDate', () => {
    expect(formatDateForStorage(parseLocalDate('2026-01-05'))).toBe('2026-01-05');
  });

  it('compares calendar days, not timestamps', () => {
    expect(isSameDay(new Date(2026, 5, 10, 1), new Date(2026, 5, 10, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 5, 10), new Date(2026, 5, 11))).toBe(false);
  });
});

describe('relative date helpers (from Wed 2026-06-10)', () => {
  it('getTomorrow', () => {
    expect(formatDateForStorage(getTomorrow())).toBe('2026-06-11');
  });

  it('getNextMonday lands on a Monday', () => {
    const m = getNextMonday();
    expect(formatDateForStorage(m)).toBe('2026-06-15');
    expect(m.getDay()).toBe(1);
  });

  it('getThisWeekend lands on Saturday', () => {
    const s = getThisWeekend();
    expect(formatDateForStorage(s)).toBe('2026-06-13');
    expect(s.getDay()).toBe(6);
  });

  it('getNextMonth is the 1st of next month', () => {
    expect(formatDateForStorage(getNextMonth())).toBe('2026-07-01');
  });

  it('getEndOfWeek lands on Friday of the current week', () => {
    const f = getEndOfWeek();
    expect(formatDateForStorage(f)).toBe('2026-06-12');
    expect(f.getDay()).toBe(5);
  });

  it('getEndOfWeek rolls to next Friday on the weekend', () => {
    vi.setSystemTime(new Date(2026, 5, 13, 12, 0, 0)); // Saturday
    expect(formatDateForStorage(getEndOfWeek())).toBe('2026-06-19');
    vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0)); // restore Wednesday
  });

  it('getEndOfMonth is the last day of the current month', () => {
    expect(formatDateForStorage(getEndOfMonth())).toBe('2026-06-30');
  });

  it('getNextWeekend is Saturday of next week', () => {
    const s = getNextWeekend();
    expect(formatDateForStorage(s)).toBe('2026-06-20');
    expect(s.getDay()).toBe(6);
  });
});

describe('getDateGroup (from Wed 2026-06-10)', () => {
  it('groups dates into upcoming buckets', () => {
    expect(getDateGroup('2026-06-11')).toBe('tomorrow');
    expect(getDateGroup('2026-06-12')).toBe('this-week');
    expect(getDateGroup('2026-06-14')).toBe('this-week'); // Sunday = end of week
    expect(getDateGroup('2026-06-15')).toBe('next-week');
    expect(getDateGroup('2026-06-21')).toBe('next-week');
    expect(getDateGroup('2026-07-01')).toBe('next-month');
    expect(getDateGroup('2026-07-31')).toBe('next-month');
    expect(getDateGroup('2026-09-01')).toBe('later');
  });

  it('puts the gap between next week and next month into "later" (documents current behavior)', () => {
    expect(getDateGroup('2026-06-25')).toBe('later');
  });
});

describe('getCalendarDays', () => {
  it('always returns a 6x7 grid', () => {
    expect(getCalendarDays(2026, 5)).toHaveLength(42);
    expect(getCalendarDays(2026, 5, 'sunday')).toHaveLength(42);
  });

  it('starts the monday grid on a Monday', () => {
    // June 2026 starts on a Monday — no leading padding
    const days = getCalendarDays(2026, 5, 'monday');
    expect(days[0].getDay()).toBe(1);
    expect(formatDateForStorage(days[0])).toBe('2026-06-01');
  });

  it('pads with previous-month days for sunday start', () => {
    const days = getCalendarDays(2026, 5, 'sunday');
    expect(days[0].getDay()).toBe(0);
    expect(formatDateForStorage(days[0])).toBe('2026-05-31');
  });
});

describe('getDaySections', () => {
  it('starts at tomorrow and labels month changes', () => {
    const sections = getDaySections(30);
    expect(sections[0].dateStr).toBe('2026-06-11');
    expect(sections[0].dayName).toBe('Tomorrow');
    expect(sections[0].monthLabel).toBeNull();
    const july1 = sections.find((s) => s.dateStr === '2026-07-01');
    expect(july1?.monthLabel).toBe('July');
    expect(july1?.dayName).toBe('Wednesday');
  });
});
