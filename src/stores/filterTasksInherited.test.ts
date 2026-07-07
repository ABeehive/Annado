import { describe, it, expect } from 'vitest';
import { filterTasks } from './filterTasks';
import type { Task } from '../types/task';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 't1', title: 'x', notes: '', when: 'anytime', deadline: null,
    tags: [], inheritedTags: [], checklist: [], completed: false,
    completedDate: null, createdDate: null, filePath: 'a.md', lineNumber: 1,
    projects: [], indentLevel: 0, priority: null, persons: [],
    recurrence: null, durationMinutes: null, scheduledTime: null,
    ...overrides,
  };
}

describe('tag filter includes inherited tags', () => {
  it('matches a task whose tag is only inherited', () => {
    const t = makeTask({ inheritedTags: ['projectx'] });
    const result = filterTasks([t], 'anytime', null, null, 'projectx');
    expect(result).toHaveLength(1);
  });

  it('matches nested descendants of an inherited tag', () => {
    const t = makeTask({ inheritedTags: ['werk/klanten'] });
    const result = filterTasks([t], 'anytime', null, null, 'werk');
    expect(result).toHaveLength(1);
  });
});
