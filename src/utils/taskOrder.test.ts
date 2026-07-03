import { describe, it, expect } from 'vitest';
import { sortTasksByDocumentOrder } from './taskOrder';
import { Task } from '../types/task';

function makeTask(filePath: string, lineNumber: number): Task {
  return {
    id: `${filePath}:${lineNumber}`,
    title: '',
    notes: '',
    when: 'inbox',
    deadline: null,
    tags: [],
    checklist: [],
    completed: false,
    completedDate: null,
    createdDate: null,
    filePath,
    lineNumber,
    projects: [],
    indentLevel: 0,
    priority: null,
    persons: [],
    recurrence: null,
    durationMinutes: null,
    scheduledTime: null,
  };
}

const order = (tasks: Task[]) => tasks.map((t) => `${t.filePath}:${t.lineNumber}`);

describe('sortTasksByDocumentOrder', () => {
  it('sorts by file path, then line number', () => {
    const input = [
      makeTask('Work/notes.md', 5),
      makeTask('Daily/2026-06-25.md', 7),
      makeTask('Projects/Roof.md', 14),
      makeTask('Daily/2026-06-25.md', 3),
      makeTask('Projects/Roof.md', 12),
    ];
    expect(order(sortTasksByDocumentOrder(input))).toEqual([
      'Daily/2026-06-25.md:3',
      'Daily/2026-06-25.md:7',
      'Projects/Roof.md:12',
      'Projects/Roof.md:14',
      'Work/notes.md:5',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [makeTask('b.md', 1), makeTask('a.md', 1)];
    const before = order(input);
    sortTasksByDocumentOrder(input);
    expect(order(input)).toEqual(before);
  });

  it('keeps survivors in the same order after a delete (no reshuffle)', () => {
    const sorted = sortTasksByDocumentOrder([
      makeTask('a.md', 1),
      makeTask('a.md', 2),
      makeTask('a.md', 3),
      makeTask('b.md', 1),
    ]);
    // Remove a middle task, then re-sort (mirrors a re-scan after delete).
    const afterDelete = sortTasksByDocumentOrder(
      sorted.filter((t) => !(t.filePath === 'a.md' && t.lineNumber === 2)),
    );
    expect(order(afterDelete)).toEqual(['a.md:1', 'a.md:3', 'b.md:1']);
  });
});
