import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { filterTasks, filterTasksForSmartList, withCompletionLinger } from './filterTasks';
import { Task } from '../types/task';

// Freeze time at Wednesday, 10 June 2026 — matches dates.test.ts.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
});

afterAll(() => {
  vi.useRealTimers();
});

let nextId = 0;
function makeTask(overrides: Partial<Task> = {}): Task {
  nextId += 1;
  return {
    id: `task-${nextId}`,
    title: `Task ${nextId}`,
    notes: '',
    when: 'inbox',
    deadline: null,
    tags: [],
    checklist: [],
    completed: false,
    completedDate: null,
    createdDate: null,
    filePath: 'Daily Notes/2026-06-10.md',
    lineNumber: nextId,
    projects: [],
    indentLevel: 0,
    priority: null,
    persons: [],
    recurringTemplateId: null,
    durationMinutes: null,
    scheduledTime: null,
    ...overrides,
  };
}

describe('filterTasks — views', () => {
  it('inbox: unscheduled tasks without projects', () => {
    const inInbox = makeTask({ when: 'inbox' });
    const withProject = makeTask({ when: 'inbox', projects: ['Brand Refresh'] });
    const scheduled = makeTask({ when: 'today' });
    const result = filterTasks([inInbox, withProject, scheduled], 'inbox', null, null, null);
    expect(result).toEqual([inInbox]);
  });

  it('today: includes today, evening, past/today dates, and due deadlines', () => {
    const today = makeTask({ when: 'today' });
    const evening = makeTask({ when: 'evening' });
    const overdueDate = makeTask({ when: { date: '2026-06-08' } });
    const dueToday = makeTask({ when: 'anytime', deadline: '2026-06-10' });
    const future = makeTask({ when: { date: '2026-06-15' } });
    const done = makeTask({ when: 'today', completed: true });
    const result = filterTasks(
      [today, evening, overdueDate, dueToday, future, done],
      'today',
      null,
      null,
      null
    );
    expect(result).toEqual([today, evening, overdueDate, dueToday]);
  });

  it('upcoming: tomorrow, future dates, and future deadlines', () => {
    const tomorrow = makeTask({ when: 'tomorrow' });
    const futureDate = makeTask({ when: { date: '2026-06-20' } });
    const futureDeadline = makeTask({ when: 'anytime', deadline: '2026-07-01' });
    const pastDate = makeTask({ when: { date: '2026-06-01' } });
    const result = filterTasks(
      [tomorrow, futureDate, futureDeadline, pastDate],
      'upcoming',
      null,
      null,
      null
    );
    expect(result).toEqual([tomorrow, futureDate, futureDeadline]);
  });

  it('anytime / someday / logbook', () => {
    const anytime = makeTask({ when: 'anytime' });
    const someday = makeTask({ when: 'someday' });
    const done = makeTask({ completed: true, completedDate: '2026-06-09' });
    const all = [anytime, someday, done];
    expect(filterTasks(all, 'anytime', null, null, null)).toEqual([anytime]);
    expect(filterTasks(all, 'someday', null, null, null)).toEqual([someday]);
    expect(filterTasks(all, 'logbook', null, null, null)).toEqual([done]);
  });

  it('added-today: matches createdDate', () => {
    const addedToday = makeTask({ createdDate: '2026-06-10' });
    const addedEarlier = makeTask({ createdDate: '2026-06-01' });
    expect(filterTasks([addedToday, addedEarlier], 'added-today', null, null, null)).toEqual([
      addedToday,
    ]);
  });
});

describe('filterTasks — project/person/tag filters', () => {
  it('filters by project and sorts by date urgency (overdue, today, tomorrow, unscheduled)', () => {
    const unscheduled = makeTask({ projects: ['P'], when: 'anytime' });
    const todayTask = makeTask({ projects: ['P'], when: 'today' });
    const overdue = makeTask({ projects: ['P'], when: { date: '2026-06-01' } });
    const tomorrow = makeTask({ projects: ['P'], when: 'tomorrow' });
    const otherProject = makeTask({ projects: ['Q'], when: 'today' });
    const result = filterTasks(
      [unscheduled, todayTask, overdue, tomorrow, otherProject],
      'today',
      'P',
      null,
      null
    );
    expect(result).toEqual([overdue, todayTask, tomorrow, unscheduled]);
  });

  it('filters by person and excludes completed', () => {
    const mine = makeTask({ persons: ['Lena Hartmann'] });
    const done = makeTask({ persons: ['Lena Hartmann'], completed: true });
    expect(filterTasks([mine, done], 'today', null, 'Lena Hartmann', null)).toEqual([mine]);
  });

  it('filters by tag', () => {
    const tagged = makeTask({ tags: ['call'] });
    const other = makeTask({ tags: ['email'] });
    expect(filterTasks([tagged, other], 'today', null, null, 'call')).toEqual([tagged]);
  });
});

describe('filterTasksForSmartList', () => {
  const todayStr = '2026-06-10';

  it('filters by priority', () => {
    const high = makeTask({ priority: 1 });
    const low = makeTask({ priority: 3 });
    const none = makeTask();
    expect(filterTasksForSmartList([high, low, none], { priority: 1 }, todayStr)).toEqual([high]);
  });

  it('filters by hasDeadline in both directions', () => {
    const withDeadline = makeTask({ deadline: '2026-06-20' });
    const without = makeTask();
    expect(
      filterTasksForSmartList([withDeadline, without], { hasDeadline: true }, todayStr)
    ).toEqual([withDeadline]);
    expect(
      filterTasksForSmartList([withDeadline, without], { hasDeadline: false }, todayStr)
    ).toEqual([without]);
  });

  it('filters by minimum age in days', () => {
    const old = makeTask({ createdDate: '2026-05-01' });
    const fresh = makeTask({ createdDate: '2026-06-09' });
    const unknown = makeTask({ createdDate: null });
    expect(filterTasksForSmartList([old, fresh, unknown], { minAgeDays: 14 }, todayStr)).toEqual([
      old,
    ]);
  });

  it('filters by dueWithin using deadline or scheduled date', () => {
    const dueSoon = makeTask({ deadline: '2026-06-12' });
    const scheduledSoon = makeTask({ when: { date: '2026-06-13' } });
    const dueLater = makeTask({ deadline: '2026-08-01' });
    const overdue = makeTask({ deadline: '2026-06-01' });
    const result = filterTasksForSmartList(
      [dueSoon, scheduledSoon, dueLater, overdue],
      { dueWithin: { amount: 1, unit: 'weeks' } },
      todayStr
    );
    expect(result).toEqual([dueSoon, scheduledSoon]);
  });

  it('respects baseView before applying extra filters', () => {
    const todayHigh = makeTask({ when: 'today', priority: 1 });
    const somedayHigh = makeTask({ when: 'someday', priority: 1 });
    const result = filterTasksForSmartList(
      [todayHigh, somedayHigh],
      { baseView: 'today', priority: 1 },
      todayStr
    );
    expect(result).toEqual([todayHigh]);
  });

  it('excludes completed tasks when no baseView is given', () => {
    const open = makeTask();
    const done = makeTask({ completed: true });
    expect(filterTasksForSmartList([open, done], {}, todayStr)).toEqual([open]);
  });
});

describe('withCompletionLinger', () => {
  const todayFilter = (ts: Task[]) => filterTasks(ts, 'today', null, null, null);

  it('keeps a just-completed task visible with its real completed state', () => {
    const lingering = makeTask({ when: 'today', completed: true, completedDate: '2026-06-10' });
    const open = makeTask({ when: 'today' });
    const result = withCompletionLinger([lingering, open], [lingering.id], todayFilter);
    expect(result).toEqual([lingering, open]);
    expect(result[0].completed).toBe(true); // real task object, not the masked copy
  });

  it('drops the task once it stops lingering', () => {
    const done = makeTask({ when: 'today', completed: true });
    const open = makeTask({ when: 'today' });
    expect(withCompletionLinger([done, open], [], todayFilter)).toEqual([open]);
  });

  it('does not resurrect tasks completed outside the linger set', () => {
    const doneEarlier = makeTask({ when: 'today', completed: true });
    const lingering = makeTask({ when: 'today', completed: true });
    const result = withCompletionLinger([doneEarlier, lingering], [lingering.id], todayFilter);
    expect(result).toEqual([lingering]);
  });
});
