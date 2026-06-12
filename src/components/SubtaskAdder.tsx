import { useState, useRef, useCallback } from 'react';
import { TaskCheckbox } from './TaskCheckbox';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSubtaskAdder(
  notes: string,
  onNotesChange: (newNotes: string) => void | Promise<void>,
) {
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  // Guards the blur handler during and briefly after a rapid-entry commit
  const blockClose = useRef(false);

  const openSubtaskInput = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsAddingSubtask(true);
    setTimeout(() => subtaskInputRef.current?.focus(), 0);
  }, []);

  // Note: `notes` is intentionally captured per-call so we always append to the latest value.
  const commitSubtask = useCallback(async (draft: string, currentNotes: string) => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    blockClose.current = true;
    const newNotes = currentNotes ? currentNotes + '\n- [ ] ' + trimmed : '- [ ] ' + trimmed;
    setSubtaskDraft('');
    await onNotesChange(newNotes);
    setTimeout(() => { subtaskInputRef.current?.focus(); }, 0);
    // Keep blockClose true long enough for any file-watcher re-render blur to be absorbed
    setTimeout(() => { blockClose.current = false; }, 300);
  }, [onNotesChange]);

  const closeSubtaskInput = useCallback(() => {
    if (blockClose.current) return;
    setIsAddingSubtask(false);
    setSubtaskDraft('');
  }, []);

  // Stable reset — safe to call from useEffect dependency arrays.
  // Skipped during rapid-entry (blockClose) so a file-watcher re-render on the
  // notes field doesn't close the input between consecutive subtasks.
  const resetSubtaskAdder = useCallback(() => {
    if (blockClose.current) return;
    setIsAddingSubtask(false);
    setSubtaskDraft('');
  }, []);

  return {
    isAddingSubtask,
    subtaskDraft,
    setSubtaskDraft,
    subtaskInputRef,
    openSubtaskInput,
    commitSubtask,
    closeSubtaskInput,
    resetSubtaskAdder,
    // Convenience: binds draft + notes for callers that have them in scope
    commit: useCallback(() => commitSubtask(subtaskDraft, notes), [commitSubtask, subtaskDraft, notes]),
  };
}

// ─── SubtaskInputRow ──────────────────────────────────────────────────────────

interface SubtaskInputRowProps {
  draft: string;
  setDraft: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onCommit: () => Promise<void>;
  onClose: () => void;
  // No default padding — place inside a shared container (TaskItem, AgendaTaskModal)
  // or pass an explicit className (QuickAdd standalone)
  className?: string;
}

export function SubtaskInputRow({
  draft, setDraft, inputRef, onCommit, onClose, className = '',
}: SubtaskInputRowProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Spacer matching ChecklistItemRow's delete-button width so checkboxes line up */}
      <div className="w-4 h-4 flex-shrink-0" />
      <TaskCheckbox completed={false} onChange={() => {}} size="md" />
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Subtask"
        className="flex-1 text-[13px] bg-transparent focus:outline-none text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#CCC] dark:placeholder-[#444]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={async (e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            if (draft.trim()) {
              await onCommit();
              // Don't call onClose — blockClose in hook keeps the input open for rapid entry
            } else {
              onClose();
            }
          } else if (e.key === 'Escape') {
            onClose();
          }
        }}
        onBlur={async () => {
          if (draft.trim()) await onCommit();
          onClose();
        }}
      />
    </div>
  );
}

// ─── SubtaskToolbarButton ─────────────────────────────────────────────────────

interface SubtaskToolbarButtonProps {
  count: number;
  onClick: (e: React.MouseEvent) => void;
}

export function SubtaskToolbarButton({ count, onClick }: SubtaskToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Add subtask"
      className={`flex items-center gap-1 px-2 py-1 text-[12px] rounded border transition-colors ${
        count > 0
          ? 'border-primary text-primary bg-primary/5'
          : 'border-[#E8E8E8] dark:border-[#3A3A3A] text-[#888] dark:text-[#666] hover:border-primary'
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <circle cx="3" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1" />
        <circle cx="3" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1" />
        <line x1="6.5" y1="3.5" x2="12" y2="3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="6.5" y1="10.5" x2="12" y2="10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
