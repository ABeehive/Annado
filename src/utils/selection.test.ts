import { describe, it, expect } from 'vitest';
import { flattenToVisibleOrder, rangeBetween } from './selection';
import type { Task } from '../types/task';

function makeTask(over: Partial<Task> & { id: string }): Task {
  return {
    title: over.title ?? over.id,
    notes: '',
    when: 'anytime',
    deadline: null,
    tags: [],
    inheritedTags: [],
    checklist: [],
    completed: false,
    completedDate: null,
    createdDate: null,
    filePath: 'tasks.md',
    lineNumber: 0,
    projects: [],
    indentLevel: 0,
    priority: null,
    persons: [],
    recurrence: null,
    durationMinutes: null,
    scheduledTime: null,
    ...over,
  };
}

const ids = (tasks: Task[]) => tasks.map((t) => t.id);

describe('flattenToVisibleOrder', () => {
  it('returns the filtered order untouched when not grouped', () => {
    const tasks = [makeTask({ id: 'a', projects: ['Z'] }), makeTask({ id: 'b' })];
    expect(ids(flattenToVisibleOrder(tasks, { isGrouped: false, isTodayView: false }))).toEqual(['a', 'b']);
  });

  it('groups by project: no-project first, then projects alphabetically', () => {
    const tasks = [
      makeTask({ id: 'p-b', projects: ['Beta'] }),
      makeTask({ id: 'loose' }),
      makeTask({ id: 'p-a', projects: ['Alpha'] }),
    ];
    // no-project (loose) first, then Alpha group, then Beta group.
    expect(ids(flattenToVisibleOrder(tasks, { isGrouped: true, isTodayView: false }))).toEqual([
      'loose', 'p-a', 'p-b',
    ]);
  });

  it('dedupes a task that belongs to several projects, keeping its first slot', () => {
    const tasks = [makeTask({ id: 'multi', projects: ['Beta', 'Alpha'] }), makeTask({ id: 'solo', projects: ['Alpha'] })];
    // `multi` appears under Alpha (first) and Beta; only the Alpha occurrence is kept.
    expect(ids(flattenToVisibleOrder(tasks, { isGrouped: true, isTodayView: false }))).toEqual(['multi', 'solo']);
  });

  it('places the evening section after the day section in Today view', () => {
    const tasks = [
      makeTask({ id: 'eve', when: 'evening' }),
      makeTask({ id: 'day1', when: 'today' }),
      makeTask({ id: 'day2', when: 'today' }),
    ];
    expect(ids(flattenToVisibleOrder(tasks, { isGrouped: true, isTodayView: true }))).toEqual([
      'day1', 'day2', 'eve',
    ]);
  });
});

describe('rangeBetween', () => {
  const order = ['a', 'b', 'c', 'd', 'e'];

  it('returns the inclusive range from anchor to target', () => {
    expect(rangeBetween(order, 'b', 'd')).toEqual(['b', 'c', 'd']);
  });

  it('works when the target is above the anchor', () => {
    expect(rangeBetween(order, 'd', 'b')).toEqual(['b', 'c', 'd']);
  });

  it('is just the target when anchor and target are the same', () => {
    expect(rangeBetween(order, 'c', 'c')).toEqual(['c']);
  });

  it('falls back to the target alone when there is no anchor', () => {
    expect(rangeBetween(order, null, 'c')).toEqual(['c']);
  });

  it('falls back to the target alone when the anchor is not in the list', () => {
    expect(rangeBetween(order, 'gone', 'c')).toEqual(['c']);
  });

  it('falls back to the target alone when the target is not in the list', () => {
    expect(rangeBetween(order, 'a', 'gone')).toEqual(['gone']);
  });
});
