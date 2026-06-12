import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { detectDateHint } from './detectDateHints';

// Freeze time at Wednesday, 10 June 2026, noon — all expectations below derive from this.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
});

afterAll(() => {
  vi.useRealTimers();
});

describe('detectDateHint — no false positives', () => {
  it('ignores stray letters that prefix-match weekdays', () => {
    expect(detectDateHint('Fix f in layout')).toBeNull();
    expect(detectDateHint('Buy a TV')).toBeNull();
    expect(detectDateHint('Email ma about dinner')).toBeNull();
    expect(detectDateHint('Do laundry')).toBeNull();
  });

  it('ignores titles with no date phrase at all', () => {
    expect(detectDateHint('Groceries')).toBeNull();
    expect(detectDateHint('')).toBeNull();
  });
});

describe('detectDateHint — when hints', () => {
  it('detects a weekday and cleans the title', () => {
    const hint = detectDateHint('Call Lena friday');
    expect(hint).not.toBeNull();
    expect(hint!.type).toBe('when');
    expect(hint!.dateString).toBe('2026-06-12');
    expect(hint!.cleanTitle).toBe('Call Lena');
    expect(hint!.matchedPhrase).toBe('friday');
  });

  it('detects short weekday names of 3+ characters', () => {
    const hint = detectDateHint('Call Lena fri');
    expect(hint).not.toBeNull();
    expect(hint!.dateString).toBe('2026-06-12');
  });

  it('detects Dutch keywords', () => {
    const hint = detectDateHint('Boodschappen morgen');
    expect(hint).not.toBeNull();
    expect(hint!.whenValue).toBe('tomorrow');
    expect(hint!.cleanTitle).toBe('Boodschappen');
  });

  it('detects multi-word phrases', () => {
    const endOfMonth = detectDateHint('Pay rent end of month');
    expect(endOfMonth).not.toBeNull();
    expect(endOfMonth!.dateString).toBe('2026-06-30');
    expect(endOfMonth!.cleanTitle).toBe('Pay rent');

    const offset = detectDateHint('Send report in three weeks');
    expect(offset).not.toBeNull();
    expect(offset!.dateString).toBe('2026-07-01');
    expect(offset!.cleanTitle).toBe('Send report');

    const weekend = detectDateHint('Plan party next weekend');
    expect(weekend).not.toBeNull();
    expect(weekend!.dateString).toBe('2026-06-20');
    expect(weekend!.cleanTitle).toBe('Plan party');
  });
});

describe('detectDateHint — deadline hints', () => {
  it('detects a deadline prefix and removes it from the title', () => {
    const hint = detectDateHint('Submit taxes by tomorrow');
    expect(hint).not.toBeNull();
    expect(hint!.type).toBe('deadline');
    expect(hint!.dateString).toBe('2026-06-11');
    expect(hint!.cleanTitle).toBe('Submit taxes');
  });

  it('detects Dutch deadline prefixes', () => {
    const hint = detectDateHint('Belasting uiterlijk vrijdag');
    expect(hint).not.toBeNull();
    expect(hint!.type).toBe('deadline');
    expect(hint!.dateString).toBe('2026-06-12');
    expect(hint!.cleanTitle).toBe('Belasting');
  });
});
