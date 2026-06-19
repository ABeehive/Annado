import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Task } from '../types/task';

// The store (pulled in transitively) imports the Tauri bridge at module load.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));

import { useConfirmableDelete } from './useConfirmableDelete';
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

function Harness({ task }: { task: Task }) {
  const { requestDelete, confirmModal } = useConfirmableDelete(task);
  return (
    <div>
      <button onClick={requestDelete}>trigger-delete</button>
      {confirmModal}
    </div>
  );
}

describe('useConfirmableDelete (AC-4)', () => {
  let deleteTask: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    deleteTask = vi.fn();
    useTaskStore.setState({ deleteTask: deleteTask as unknown as (id: string) => Promise<void> });
  });

  it('deletes immediately with no dialog when confirmDelete is off', () => {
    useTaskStore.setState({ confirmDelete: false });
    render(<Harness task={makeTask()} />);

    fireEvent.click(screen.getByText('trigger-delete'));

    expect(deleteTask).toHaveBeenCalledWith('abc123');
    expect(document.querySelector('[data-picker-portal]')).toBeNull();
  });

  it('opens a confirm dialog when confirmDelete is on; confirming deletes', () => {
    useTaskStore.setState({ confirmDelete: true });
    render(<Harness task={makeTask()} />);

    fireEvent.click(screen.getByText('trigger-delete'));
    // Dialog is shown and nothing is deleted until the user confirms.
    expect(document.querySelector('[data-picker-portal]')).not.toBeNull();
    expect(deleteTask).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteTask).toHaveBeenCalledWith('abc123');
  });

  it('cancel closes the dialog without deleting', () => {
    useTaskStore.setState({ confirmDelete: true });
    render(<Harness task={makeTask()} />);

    fireEvent.click(screen.getByText('trigger-delete'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(deleteTask).not.toHaveBeenCalled();
    expect(document.querySelector('[data-picker-portal]')).toBeNull();
  });
});
