import { parseNaturalDate } from './dateParser';
import { WhenValue } from '../types/task';
import { formatDateForStorage } from './dates';

export interface DateHint {
  type: 'when' | 'deadline';
  whenValue: WhenValue;    // ready to pass to task.when
  dateString: string;      // YYYY-MM-DD, ready to pass to task.deadline
  matchedPhrase: string;   // original phrase from the title (preserved case), for display
  label: string;           // resolved label from parseNaturalDate
  cleanTitle: string;      // title with the matched phrase (+ any deadline prefix) removed
}

const DEADLINE_PREFIXES = new Set([
  // Dutch
  'voor', 'vóór', 'uiterlijk', 'deadline',
  // English
  'by', 'due', 'before', 'deadline',
]);

export function detectDateHint(title: string): DateHint | null {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  for (let i = 0; i < words.length; i++) {
    const maxLen = Math.min(3, words.length - i);
    for (let len = maxLen; len >= 1; len--) {
      const windowWords = words.slice(i, i + len);

      // Strip leading/trailing punctuation so "morgen," still parses
      const stripped = windowWords.map(w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''));
      const phrase = stripped.join(' ').toLowerCase();
      if (!phrase) continue;

      // A single short word ("f", "ma", "do") is far more likely part of the
      // title than a date — only consider it from 3 characters up
      if (len === 1 && phrase.length < 3) continue;

      // Exact weekday matching: in free text, "fri" should hint but "f" never should
      const parsed = parseNaturalDate(phrase, undefined, { weekdayMatch: 'exact' });
      if (!parsed) continue;

      // Check word immediately before the match for a deadline indicator
      const prevWord = i > 0
        ? words[i - 1].toLowerCase().replace(/[^\p{L}]+$/gu, '')
        : '';
      const isDeadline = DEADLINE_PREFIXES.has(prevWord);

      // Remove the matched window (+ deadline prefix) from the word list
      const removeFrom = isDeadline && i > 0 ? i - 1 : i;
      const removeTo = i + len;
      const cleanWords = [...words.slice(0, removeFrom), ...words.slice(removeTo)];
      const rawClean = cleanWords.join(' ').trim();

      // Capitalise first letter, skipping any leading emoji/symbols
      const cleanTitle = rawClean ? rawClean.replace(/\p{L}/u, m => m.toUpperCase()) : '';

      return {
        type: isDeadline ? 'deadline' : 'when',
        whenValue: parsed.whenValue,
        dateString: formatDateForStorage(parsed.date),
        matchedPhrase: stripped.join(' '),
        label: parsed.label,
        cleanTitle,
      };
    }
  }

  return null;
}
