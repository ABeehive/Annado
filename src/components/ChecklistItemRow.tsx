import { useState } from 'react';
import { ChecklistItem } from '../types/task';
import { useTaskStore } from '../stores/taskStore';
import { TaskCheckbox } from './TaskCheckbox';

interface ChecklistItemRowProps {
  item: ChecklistItem;
  index: number;
  taskId: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function ChecklistItemRow({ item, index, taskId, size = 'md', disabled = false }: ChecklistItemRowProps) {
  const toggleChecklistItem = useTaskStore((s) => s.toggleChecklistItem);
  const renameChecklistItem = useTaskStore((s) => s.renameChecklistItem);
  const deleteChecklistItem = useTaskStore((s) => s.deleteChecklistItem);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const textSize = size === 'sm' ? 'text-[12px]' : 'text-[13px]';

  const startEditing = () => {
    if (disabled) return;
    setDraft(item.title);
    setIsEditing(true);
  };

  const commit = async () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (!trimmed) {
      await deleteChecklistItem(taskId, index);
    } else if (trimmed !== item.title) {
      await renameChecklistItem(taskId, index, trimmed);
    }
  };

  return (
    <div className="group flex items-center gap-2">
      {!disabled && !isEditing ? (
        <button
          onClick={() => deleteChecklistItem(taskId, index)}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-full border-[1.5px] border-[#CCC] dark:border-[#555] flex items-center justify-center text-[#999] dark:text-[#666] hover:text-danger flex-shrink-0"
          title="Delete subtask"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" d="M5 12h14" />
          </svg>
        </button>
      ) : (
        <div className="w-4 h-4 flex-shrink-0" />
      )}
      <TaskCheckbox
        completed={item.completed}
        onChange={() => toggleChecklistItem(taskId, index)}
        size={size}
      />
      {isEditing ? (
        <input
          autoFocus
          className={`${textSize} bg-transparent border-b border-primary outline-none flex-1 min-w-0`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          onBlur={commit}
        />
      ) : (
        <span
          className={`${textSize} cursor-text flex-1 min-w-0 ${
            item.completed
              ? 'line-through text-[#A0A0A0]'
              : 'text-[#1A1A1A] dark:text-[#E0E0E0]'
          }`}
          onClick={startEditing}
        >
          {item.title}
        </span>
      )}
    </div>
  );
}
