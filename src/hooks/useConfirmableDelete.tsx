import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTaskStore } from '../stores/taskStore';
import { Task } from '../types/task';
import { ConfirmModal } from '../components/ConfirmModal';

export interface ConfirmableDelete {
  /**
   * Trigger a delete of the task. If the `confirmDelete` setting is on, this
   * opens a confirmation modal (render `confirmModal`); otherwise it deletes
   * immediately. The delete is undoable via ⌘Z (restore_task).
   */
  requestDelete: () => void;
  /** The confirm modal element to render (null when not confirming). */
  confirmModal: React.ReactNode;
}

/**
 * Shared delete-with-confirmation wiring for the inline (collapsed row) and
 * expanded-card delete affordances. Keeps the ConfirmModal state local to the
 * row that owns it, so App-level modal state never has to thread through the
 * memoized list.
 */
export function useConfirmableDelete(task: Task): ConfirmableDelete {
  const { deleteTask, confirmDelete } = useTaskStore(
    useShallow((s) => ({ deleteTask: s.deleteTask, confirmDelete: s.confirmDelete }))
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const requestDelete = useCallback(() => {
    if (confirmDelete) {
      setConfirmingDelete(true);
    } else {
      deleteTask(task.id);
    }
  }, [confirmDelete, deleteTask, task.id]);

  const confirmModal = (
    <ConfirmModal
      open={confirmingDelete}
      message="Delete this task?"
      onConfirm={() => {
        deleteTask(task.id);
        setConfirmingDelete(false);
      }}
      onCancel={() => setConfirmingDelete(false)}
    />
  );

  return { requestDelete, confirmModal };
}
