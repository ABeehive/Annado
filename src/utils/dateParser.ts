import { WhenValue } from '../types/task';
import {
  formatDateForStorage,
  getNextMonday,
  getThisWeekend,
  getNextWeekend,
  getNextMonth,
  getEndOfWeek,
  getEndOfMonth,
  getTomorrow,
  getDayAfterTomorrow,
  getToday,
} from './dates';
import { LOCALES } from '../config/locales';

export interface ParsedDate {
  date: Date;
  label: string;
  whenValue: WhenValue;
  confidence: 'exact' | 'fuzzy';
}

export interface DateSuggestion {
  label: string;
  detail: string;
  whenValue: WhenValue;
}

// ── Helpers ──────────────────────────────────────────────────────────

function toMidnight(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDatePreview(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function rollForwardIfPast(date: Date, ref: Date): Date {
  if (date < ref) {
    const rolled = new Date(date);
    rolled.setFullYear(rolled.getFullYear() + 1);
    return rolled;
  }
  return date;
}

function nextDayOfWeek(dayIndex: number, ref: Date): Date {
  const current = ref.getDay();
  let diff = dayIndex - current;
  if (diff <= 0) diff += 7;
  const result = new Date(ref);
  result.setDate(ref.getDate() + diff);
  return result;
}

// ── Intl-based month/day maps (built once at module load) ────────────

function buildMonthMap(localeCode: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (let m = 0; m < 12; m++) {
    const d = new Date(2000, m, 1);
    for (const style of ['long', 'short'] as const) {
      const name = new Intl.DateTimeFormat(localeCode, { month: style }).format(d).toLowerCase().replace(/\.$/, '');
      map[name] = m;
    }
  }
  return map;
}

function buildDayMap(localeCode: string): Record<string, number> {
  const map: Record<string, number> = {};
  // Jan 2 2000 was a Sunday (day 0)
  for (let d = 0; d < 7; d++) {
    const date = new Date(2000, 0, 2 + d);
    for (const style of ['long', 'short'] as const) {
      const name = new Intl.DateTimeFormat(localeCode, { weekday: style }).format(date).toLowerCase().replace(/\.$/, '');
      map[name] = d;
    }
  }
  return map;
}

const ALL_MONTHS: Record<string, number> = Object.assign({}, ...LOCALES.map(l => buildMonthMap(l.code)));
const DAY_NAMES_MAP: Record<string, number> = Object.assign({}, ...LOCALES.map(l => buildDayMap(l.code)));

const EN_DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Keyword lookup helpers ───────────────────────────────────────────

function matchesAny(raw: string, terms: string[]): boolean {
  return terms.some(t => t === raw);
}

function allNextPrefixes(): string[] {
  return LOCALES.flatMap(l => l.keywords.nextPrefix);
}

function allInPrefixes(): string[] {
  return LOCALES.flatMap(l => l.keywords.inPrefix);
}

function allDayTerms(): string[] {
  return LOCALES.flatMap(l => l.keywords.days);
}

function allWeekTerms(): string[] {
  return LOCALES.flatMap(l => l.keywords.weeks);
}

function allMonthTerms(): string[] {
  return LOCALES.flatMap(l => l.keywords.months);
}

const NUMBER_WORDS: Record<string, number> = Object.assign(
  {},
  ...LOCALES.map(l => l.keywords.numberWords)
);

// ── parseNaturalDate ────────────────────────────────────────────────

export interface ParseOptions {
  /**
   * How weekday names match. 'prefix' (default) lets partial input like "fr"
   * match Friday — right for the picker, where the user is mid-typing.
   * 'exact' requires a full variant (friday, fri, vrijdag, vr) — right for
   * scanning free text like task titles.
   */
  weekdayMatch?: 'prefix' | 'exact';
}

export function parseNaturalDate(
  input: string,
  referenceDate?: Date,
  opts: ParseOptions = {}
): ParsedDate | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  const weekdayMatch = opts.weekdayMatch ?? 'prefix';

  const ref = referenceDate ? toMidnight(referenceDate) : getToday();

  // 1. Symbolic keywords → WhenValue string
  if (matchesAny(raw, LOCALES.flatMap(l => l.keywords.today))) {
    return { date: ref, label: 'Today', whenValue: 'today', confidence: 'exact' };
  }
  if (matchesAny(raw, LOCALES.flatMap(l => l.keywords.tonight))) {
    return { date: ref, label: 'This Evening', whenValue: 'evening', confidence: 'exact' };
  }
  if (matchesAny(raw, LOCALES.flatMap(l => l.keywords.tomorrow))) {
    return { date: getTomorrow(), label: 'Tomorrow', whenValue: 'tomorrow', confidence: 'exact' };
  }
  if (matchesAny(raw, LOCALES.flatMap(l => l.keywords.anytime))) {
    return { date: ref, label: 'Anytime', whenValue: 'anytime', confidence: 'exact' };
  }
  if (matchesAny(raw, LOCALES.flatMap(l => l.keywords.someday))) {
    return { date: ref, label: 'Someday', whenValue: 'someday', confidence: 'exact' };
  }
  const dayAfterTerms = LOCALES.flatMap(l => l.keywords.dayAfterTomorrow ?? []);
  if (dayAfterTerms.length > 0 && matchesAny(raw, dayAfterTerms)) {
    const d = getDayAfterTomorrow();
    return { date: d, label: 'Day after tomorrow', whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
  }

  // 2. Relative keywords → { date: 'YYYY-MM-DD' }
  if (matchesAny(raw, LOCALES.flatMap(l => l.keywords.thisWeekend))) {
    const d = getThisWeekend();
    return { date: d, label: 'This Weekend', whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
  }
  if (matchesAny(raw, LOCALES.flatMap(l => l.keywords.nextWeekend))) {
    const d = getNextWeekend();
    return { date: d, label: 'Next Weekend', whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
  }
  if (matchesAny(raw, LOCALES.flatMap(l => l.keywords.nextWeek))) {
    const d = getNextMonday();
    return { date: d, label: 'Next Week', whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
  }
  if (matchesAny(raw, LOCALES.flatMap(l => l.keywords.nextMonth))) {
    const d = getNextMonth();
    return { date: d, label: 'Next Month', whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
  }
  if (matchesAny(raw, LOCALES.flatMap(l => l.keywords.endOfWeek))) {
    const d = getEndOfWeek();
    return { date: d, label: 'End of Week', whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
  }
  if (matchesAny(raw, LOCALES.flatMap(l => l.keywords.endOfMonth))) {
    const d = getEndOfMonth();
    return { date: d, label: 'End of Month', whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
  }

  // 3. Day names (with optional "next"/"volgende" prefix)
  {
    const nextPrefixPattern = allNextPrefixes().join('|');
    const prefixMatch = raw.match(new RegExp(`^(?:${nextPrefixPattern})\\s+(.+)$`));
    const dayName = prefixMatch ? prefixMatch[1] : raw;

    const matchedDay = Object.keys(DAY_NAMES_MAP).find(
      (k) => k === dayName || (weekdayMatch === 'prefix' && k.startsWith(dayName))
    );
    if (matchedDay) {
      const dayIdx = DAY_NAMES_MAP[matchedDay];
      const d = nextDayOfWeek(dayIdx, ref);
      const label = EN_DAY_LABELS[dayIdx];
      return { date: d, label, whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
    }
  }

  // 4. Relative offset: "in 3 days" / "in three weeks" / "over twee weken"
  {
    const inPrefixes = allInPrefixes().join('|');
    const dayTerms = allDayTerms().join('|');
    const weekTerms = allWeekTerms().join('|');
    const monthTerms = allMonthTerms().join('|');
    const numberWords = Object.keys(NUMBER_WORDS).join('|');
    const offsetPattern = new RegExp(
      `^(?:${inPrefixes})\\s+(\\d+|${numberWords})\\s+(${dayTerms}|${weekTerms}|${monthTerms})$`
    );
    const offsetMatch = raw.match(offsetPattern);
    if (offsetMatch) {
      const count = offsetMatch[1];
      const n = /^\d+$/.test(count) ? parseInt(count, 10) : NUMBER_WORDS[count];
      const unit = offsetMatch[2];
      const d = new Date(ref);
      if (allDayTerms().includes(unit)) {
        d.setDate(d.getDate() + n);
      } else if (allWeekTerms().includes(unit)) {
        d.setDate(d.getDate() + n * 7);
      } else if (allMonthTerms().includes(unit)) {
        d.setMonth(d.getMonth() + n);
      }
      const label = `In ${n} ${unit}`;
      return { date: d, label, whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
    }
  }

  // 5. Explicit date formats
  // YYYY-MM-DD
  {
    const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      if (!isNaN(d.getTime())) {
        return { date: d, label: formatDatePreview(d), whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
      }
    }
  }

  // DD-MM-YYYY or DD/MM/YYYY
  {
    const m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) {
      const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
      if (!isNaN(d.getTime())) {
        return { date: d, label: formatDatePreview(d), whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
      }
    }
  }

  // DD-MM or DD/MM (assume current year, roll forward if past)
  {
    const m = raw.match(/^(\d{1,2})[-/](\d{1,2})$/);
    if (m) {
      let d = new Date(ref.getFullYear(), parseInt(m[2]) - 1, parseInt(m[1]));
      d = rollForwardIfPast(d, ref);
      if (!isNaN(d.getTime())) {
        return { date: d, label: formatDatePreview(d), whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
      }
    }
  }

  // Month name + day: "feb 14", "14 feb", "14 februari", "march 15", "15 march"
  {
    // month day
    const m1 = raw.match(/^([a-zÀ-ÿ]+)\s+(\d{1,2})$/);
    if (m1 && m1[1] in ALL_MONTHS) {
      const monthIdx = ALL_MONTHS[m1[1]];
      let d = new Date(ref.getFullYear(), monthIdx, parseInt(m1[2]));
      d = rollForwardIfPast(d, ref);
      return { date: d, label: formatDatePreview(d), whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
    }

    // day month
    const m2 = raw.match(/^(\d{1,2})\s+([a-zÀ-ÿ]+)$/);
    if (m2 && m2[2] in ALL_MONTHS) {
      const monthIdx = ALL_MONTHS[m2[2]];
      let d = new Date(ref.getFullYear(), monthIdx, parseInt(m2[1]));
      d = rollForwardIfPast(d, ref);
      return { date: d, label: formatDatePreview(d), whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
    }

    // month day year: "march 15 2026"
    const m3 = raw.match(/^([a-zÀ-ÿ]+)\s+(\d{1,2})\s+(\d{4})$/);
    if (m3 && m3[1] in ALL_MONTHS) {
      const monthIdx = ALL_MONTHS[m3[1]];
      const d = new Date(parseInt(m3[3]), monthIdx, parseInt(m3[2]));
      return { date: d, label: formatDatePreview(d), whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
    }

    // day month year: "15 march 2026"
    const m4 = raw.match(/^(\d{1,2})\s+([a-zÀ-ÿ]+)\s+(\d{4})$/);
    if (m4 && m4[2] in ALL_MONTHS) {
      const monthIdx = ALL_MONTHS[m4[2]];
      const d = new Date(parseInt(m4[3]), monthIdx, parseInt(m4[1]));
      return { date: d, label: formatDatePreview(d), whenValue: { date: formatDateForStorage(d) }, confidence: 'exact' };
    }
  }

  return null;
}

// ── Suggestion entries ──────────────────────────────────────────────

interface SuggestionEntry {
  keywords: string[];
  label: string;
  resolve: () => WhenValue;
}

function buildSuggestionEntries(): SuggestionEntry[] {
  const entries: SuggestionEntry[] = [
    {
      keywords: LOCALES.flatMap(l => l.keywords.today),
      label: 'Today',
      resolve: () => 'today',
    },
    {
      keywords: LOCALES.flatMap(l => l.keywords.tonight),
      label: 'This Evening',
      resolve: () => 'evening',
    },
    {
      keywords: LOCALES.flatMap(l => l.keywords.tomorrow),
      label: 'Tomorrow',
      resolve: () => 'tomorrow',
    },
    {
      keywords: LOCALES.flatMap(l => l.keywords.dayAfterTomorrow ?? []),
      label: 'Day after tomorrow',
      resolve: () => ({ date: formatDateForStorage(getDayAfterTomorrow()) }),
    },
    {
      keywords: LOCALES.flatMap(l => l.keywords.thisWeekend),
      label: 'This Weekend',
      resolve: () => ({ date: formatDateForStorage(getThisWeekend()) }),
    },
    {
      keywords: LOCALES.flatMap(l => l.keywords.nextWeekend),
      label: 'Next Weekend',
      resolve: () => ({ date: formatDateForStorage(getNextWeekend()) }),
    },
    {
      keywords: LOCALES.flatMap(l => l.keywords.nextWeek),
      label: 'Next Week',
      resolve: () => ({ date: formatDateForStorage(getNextMonday()) }),
    },
    {
      keywords: LOCALES.flatMap(l => l.keywords.nextMonth),
      label: 'Next Month',
      resolve: () => ({ date: formatDateForStorage(getNextMonth()) }),
    },
    {
      keywords: LOCALES.flatMap(l => l.keywords.endOfWeek),
      label: 'End of Week',
      resolve: () => ({ date: formatDateForStorage(getEndOfWeek()) }),
    },
    {
      keywords: LOCALES.flatMap(l => l.keywords.endOfMonth),
      label: 'End of Month',
      resolve: () => ({ date: formatDateForStorage(getEndOfMonth()) }),
    },
    {
      keywords: LOCALES.flatMap(l => l.keywords.anytime),
      label: 'Anytime',
      resolve: () => 'anytime',
    },
    {
      keywords: LOCALES.flatMap(l => l.keywords.someday),
      label: 'Someday',
      resolve: () => 'someday',
    },
  ];

  // Day name entries: gather all locale day names per day index
  const EN_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const DAY_JS_INDICES = [1, 2, 3, 4, 5, 6, 0]; // JS getDay() values

  for (let i = 0; i < EN_DAYS.length; i++) {
    const dayIdx = DAY_JS_INDICES[i];
    const allNames = Object.keys(DAY_NAMES_MAP).filter(k => DAY_NAMES_MAP[k] === dayIdx);
    entries.push({
      keywords: allNames,
      label: EN_DAY_LABELS[dayIdx],
      resolve: () => {
        const ref = getToday();
        const d = nextDayOfWeek(dayIdx, ref);
        return { date: formatDateForStorage(d) } as WhenValue;
      },
    });
  }

  return entries;
}

const SUGGESTION_ENTRIES: SuggestionEntry[] = buildSuggestionEntries();

function resolveWhenValueToDate(wv: WhenValue): Date {
  if (typeof wv === 'string') {
    switch (wv) {
      case 'today': return getToday();
      case 'evening': return getToday();
      case 'tomorrow': return getTomorrow();
      case 'someday': return getToday();
      default: return getToday();
    }
  }
  return new Date(wv.date);
}

export function getDateSuggestions(input: string, _referenceDate?: Date): DateSuggestion[] {
  const raw = input.trim().toLowerCase();
  if (!raw) return [];

  const prefixMatches: DateSuggestion[] = [];
  const substringMatches: DateSuggestion[] = [];

  for (const entry of SUGGESTION_ENTRIES) {
    if (entry.keywords.length === 0) continue;
    let isPrefix = false;
    let isSubstring = false;

    for (const kw of entry.keywords) {
      if (kw.startsWith(raw)) {
        isPrefix = true;
        break;
      }
      if (kw.includes(raw)) {
        isSubstring = true;
      }
    }

    if (isPrefix || isSubstring) {
      const whenValue = entry.resolve();
      const date = resolveWhenValueToDate(whenValue);
      const suggestion: DateSuggestion = {
        label: entry.label,
        detail: formatDatePreview(date),
        whenValue,
      };

      if (isPrefix) {
        prefixMatches.push(suggestion);
      } else {
        substringMatches.push(suggestion);
      }
    }
  }

  return [...prefixMatches, ...substringMatches].slice(0, 6);
}
