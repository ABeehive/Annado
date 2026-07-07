import { describe, it, expect } from 'vitest';
import { Task } from '../types/task';
import { groupTasksByProject, buildGroupedRows } from './taskGrouping';

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: overrides.id,
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
    ...overrides,
  };
}

const noResolve = () => ({});

describe('buildGroupedRows — unique row keys (react-virtual needs them)', () => {
  it('a task in two projects yields two task rows with distinct keys (no collision)', () => {
    // groupTasksByProject deliberately puts a multi-project task in each of its groups.
    const multi = makeTask({ id: 't-multi', projects: ['Code', 'Familie'] });
    const rows = buildGroupedRows(groupTasksByProject([multi]), null, noResolve);

    const taskRows = rows.filter((r) => r.kind === 'task');
    expect(taskRows).toHaveLength(2); // shown under both projects
    expect(taskRows[0].key).not.toBe(taskRows[1].key);

    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length); // every row key is unique
  });

  it('the same task in the day and evening sections does not collide', () => {
    const t = makeTask({ id: 't-1', projects: ['Code'] });
    const rows = buildGroupedRows(groupTasksByProject([t]), groupTasksByProject([t]), noResolve);
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
