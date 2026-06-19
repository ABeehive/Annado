import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Task } from '../types/task';

// The store + ExpandedTaskCard pull in the Tauri bridge / opener at module load.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn().mockResolvedValue(undefined) }));

import { TaskItem } from './TaskItem';
import { ExpandedTaskCard } from './ExpandedTaskCard';
import { useTaskStore } from '../stores/taskStore';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'abc123', title: 'Buy groceries', notes: '', when: 'inbox', deadline: null,
    tags: [], checklist: [], completed: false, completedDate: null, createdDate: null,
    filePath: '/vault/Tasks.md', lineNumber: 4, projects: [], indentLevel: 0,
    priority: null, persons: [], recurrence: null, durationMinutes: null,
    scheduledTime: null, ...overrides,
  };
}

describe('delete affordances', () => {
  let deleteTask: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    deleteTask = vi.fn();
    // confirmDelete off → click deletes immediately (no dialog) so the test
    // asserts the wiring, not the dialog (the dialog is covered elsewhere).
    useTaskStore.setState({
      tasks: [makeTask()],
      deleteTask: deleteTask as unknown as (id: string) => Promise<void>,
      confirmDelete: false,
    });
  });

  it('collapsed row: renders a hover-revealed SVG delete button that calls deleteTask (AC-1, AC-8)', () => {
    render(<TaskItem task={makeTask()} />);

    const btn = screen.getByRole('button', { name: 'Delete task' });
    // AC-8: an SVG icon, not an emoji/text glyph.
    expect(btn.querySelector('svg')).not.toBeNull();
    // AC-1: hidden until the row is hovered (opacity-0 + group-hover reveal),
    // i.e. not part of the normal layout flow.
    expect(btn.className).toContain('opacity-0');
    expect(btn.className).toContain('group-hover:opacity-100');
    expect(btn.className).toContain('absolute');

    fireEvent.click(btn);
    expect(deleteTask).toHaveBeenCalledWith('abc123');
  });

  it('expanded card: renders a destructive Delete button with an SVG icon that calls deleteTask (AC-3, AC-8)', () => {
    render(<ExpandedTaskCard task={makeTask()} isCollapsing={false} isSoleSelection={false} />);

    const btn = screen.getByRole('button', { name: /delete/i });
    expect(btn.querySelector('svg')).not.toBeNull();
    expect(within(btn).getByText('Delete')).toBeInTheDocument();

    fireEvent.click(btn);
    expect(deleteTask).toHaveBeenCalledWith('abc123');
  });
});
