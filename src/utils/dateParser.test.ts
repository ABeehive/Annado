import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { parseNaturalDate, getDateSuggestions } from './dateParser';
import { formatDateForStorage } from './dates';

// Freeze time at Wednesday, 10 June 2026, noon — all expectations below derive from this.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
});

afterAll(() => {
  vi.useRealTimers();
});

function parsedDateStr(input: string): string | null {
  const parsed = parseNaturalDate(input);
  return parsed ? formatDateForStorage(parsed.date) : null;
}

describe('parseNaturalDate — symbolic keywords', () => {
  it('parses today/tonight/tomorrow to WhenValue strings', () => {
    expect(parseNaturalDate('today')?.whenValue).toBe('today');
    expect(parseNaturalDate('tonight')?.whenValue).toBe('evening');
    expect(parseNaturalDate('tomorrow')?.whenValue).toBe('tomorrow');
    expect(parseNaturalDate('anytime')?.whenValue).toBe('anytime');
    expect(parseNaturalDate('someday')?.whenValue).toBe('someday');
  });

  it('parses Dutch keywords', () => {
    expect(parseNaturalDate('vandaag')?.whenValue).toBe('today');
    expect(parseNaturalDate('morgen')?.whenValue).toBe('tomorrow');
    expect(parsedDateStr('overmorgen')).toBe('2026-06-12');
  });
});

describe('parseNaturalDate — relative phrases', () => {
  it('parses this weekend and next weekend', () => {
    expect(parsedDateStr('this weekend')).toBe('2026-06-13');
    expect(parsedDateStr('next weekend')).toBe('2026-06-20');
    expect(parsedDateStr('volgend weekend')).toBe('2026-06-20');
  });

  it('parses next week and next month', () => {
    expect(parsedDateStr('next week')).toBe('2026-06-15');
    expect(parsedDateStr('volgende week')).toBe('2026-06-15');
    expect(parsedDateStr('next month')).toBe('2026-07-01');
  });

  it('parses end of week as Friday of the current week', () => {
    expect(parsedDateStr('end of week')).toBe('2026-06-12');
    expect(parsedDateStr('end of the week')).toBe('2026-06-12');
    expect(parsedDateStr('eind van de week')).toBe('2026-06-12');
  });

  it('parses end of month as the last day of the current month', () => {
    expect(parsedDateStr('end of month')).toBe('2026-06-30');
    expect(parsedDateStr('einde van de maand')).toBe('2026-06-30');
  });
});

describe('parseNaturalDate — weekday names', () => {
  it('parses full and short weekday names to the next occurrence', () => {
    expect(parsedDateStr('friday')).toBe('2026-06-12');
    expect(parsedDateStr('fri')).toBe('2026-06-12');
    expect(parsedDateStr('vrijdag')).toBe('2026-06-12');
    // Today is Wednesday, so "wednesday" means next week's
    expect(parsedDateStr('wednesday')).toBe('2026-06-17');
  });

  it('parses "next <day>"', () => {
    expect(parsedDateStr('next friday')).toBe('2026-06-12');
    expect(parsedDateStr('volgende vrijdag')).toBe('2026-06-12');
  });

  it('prefix mode (default) matches partial weekday input', () => {
    expect(parsedDateStr('f')).toBe('2026-06-12');
    expect(parsedDateStr('fr')).toBe('2026-06-12');
  });

  it('exact mode rejects partial weekday input but keeps full variants', () => {
    expect(parseNaturalDate('f', undefined, { weekdayMatch: 'exact' })).toBeNull();
    expect(parseNaturalDate('frid', undefined, { weekdayMatch: 'exact' })).toBeNull();
    const exact = parseNaturalDate('friday', undefined, { weekdayMatch: 'exact' });
    expect(exact && formatDateForStorage(exact.date)).toBe('2026-06-12');
    const short = parseNaturalDate('fri', undefined, { weekdayMatch: 'exact' });
    expect(short && formatDateForStorage(short.date)).toBe('2026-06-12');
  });
});

describe('parseNaturalDate — relative offsets', () => {
  it('parses digit offsets', () => {
    expect(parsedDateStr('in 3 days')).toBe('2026-06-13');
    expect(parsedDateStr('in 3 weeks')).toBe('2026-07-01');
    expect(parsedDateStr('in 2 months')).toBe('2026-08-10');
    expect(parsedDateStr('over 2 weken')).toBe('2026-06-24');
  });

  it('parses spelled-out number words', () => {
    expect(parsedDateStr('in three weeks')).toBe('2026-07-01');
    expect(parsedDateStr('in two weeks')).toBe('2026-06-24');
    expect(parsedDateStr('in five days')).toBe('2026-06-15');
    expect(parsedDateStr('over twee weken')).toBe('2026-06-24');
    expect(parsedDateStr('over drie dagen')).toBe('2026-06-13');
  });

  it('parses articles as one', () => {
    expect(parsedDateStr('in a week')).toBe('2026-06-17');
    expect(parsedDateStr('in a month')).toBe('2026-07-10');
    expect(parsedDateStr('over een week')).toBe('2026-06-17');
  });

  it('normalizes the label to digits', () => {
    expect(parseNaturalDate('in three weeks')?.label).toBe('In 3 weeks');
  });
});

describe('parseNaturalDate — explicit dates', () => {
  it('parses ISO and EU formats', () => {
    expect(parsedDateStr('2026-12-25')).toBe('2026-12-25');
    expect(parsedDateStr('25-12-2026')).toBe('2026-12-25');
    expect(parsedDateStr('25/12/2026')).toBe('2026-12-25');
  });

  it('rolls compact day-month forward when the date has passed', () => {
    expect(parsedDateStr('22/5')).toBe('2027-05-22');
    expect(parsedDateStr('22-5')).toBe('2027-05-22');
    expect(parsedDateStr('25/12')).toBe('2026-12-25');
  });

  it('parses month names and rolls forward past dates', () => {
    expect(parsedDateStr('22 mei')).toBe('2027-05-22');
    expect(parsedDateStr('22 may')).toBe('2027-05-22');
    expect(parsedDateStr('feb 14')).toBe('2027-02-14');
    expect(parsedDateStr('14 september')).toBe('2026-09-14');
    expect(parsedDateStr('march 15 2027')).toBe('2027-03-15');
    expect(parsedDateStr('15 maart 2027')).toBe('2027-03-15');
  });
});

describe('parseNaturalDate — non-dates', () => {
  it('returns null for unrelated input', () => {
    expect(parseNaturalDate('')).toBeNull();
    expect(parseNaturalDate('groceries')).toBeNull();
    expect(parseNaturalDate('in many weeks')).toBeNull();
  });
});

describe('getDateSuggestions', () => {
  it('ranks prefix matches first', () => {
    const labels = getDateSuggestions('to').map(s => s.label);
    expect(labels[0]).toBe('Today');
    expect(labels).toContain('Tomorrow');
  });

  it('suggests the new end-of phrases', () => {
    const labels = getDateSuggestions('end').map(s => s.label);
    expect(labels).toContain('End of Week');
    expect(labels).toContain('End of Month');
  });

  it('suggests next weekend', () => {
    const labels = getDateSuggestions('next week').map(s => s.label);
    expect(labels).toContain('Next Weekend');
    expect(labels).toContain('Next Week');
  });
});
