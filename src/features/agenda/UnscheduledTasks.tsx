import { useState, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Task } from '../../types/task';
import { useTaskStore } from '../../stores/taskStore';
import { useAgendaNames } from './useAgendaNames';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import { WikilinkRenderer } from '../../components/WikilinkRenderer';
import { formatDuration, formatTime, SlotSuggestion } from './utils';
import { DEFAULT_DURATION } from './constants';
import { useRescheduleSuggestions } from './useRescheduleSuggestions';

function DraggableTask({ task }: { task: Task }) {
  const {
    toggleTaskComplete,
    availableProjects, projectColors,
    navigateToPerson, navigateToProject,
    defaultTaskDuration,
  } = useTaskStore();
  const { personNames, projectNames } = useAgendaNames();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `agenda-${task.id}`,
    data: { task },
  });

  const durationLabel = formatDuration(task.durationMinutes || defaultTaskDuration || DEFAULT_DURATION);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#2A2A2A] border border-[#E8E8E8] dark:border-[#3A3A3A] cursor-grab hover:shadow-sm transition-shadow ${isDragging ? 'opacity-50' : ''}`}
    >
      <TaskCheckbox
        completed={false}
        onClick={(e) => {
          e.stopPropagation();
          toggleTaskComplete(task.id);
        }}
        size="md"
        className="hover:border-primary"
      />
      <WikilinkRenderer
        title={task.title}
        personNames={personNames}
        projectNames={projectNames}
        onPersonClick={(name) => navigateToPerson(name)}
        onProjectClick={(name) => navigateToProject(name)}
        projectColors={projectColors}
        availableProjects={availableProjects}
        className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] truncate flex-1"
      />
      <span className="text-[11px] text-[#999] dark:text-[#666] flex-shrink-0">
        {durationLabel}
      </span>
    </div>
  );
}

function RescheduleSuggestions({ suggestions, onMove, onDismiss }: {
  suggestions: SlotSuggestion[];
  onMove: (suggestion: SlotSuggestion) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 ml-7 mt-1 flex-wrap">
      {suggestions.map(s => (
        <button
          key={`${s.dateStr}-${s.startMinutes}`}
          onClick={() => onMove(s)}
          className="text-[12px] font-medium py-1.5 px-3 rounded-[6px] bg-[#F0F7FF] text-[#3A7AB8] border border-[rgba(74,144,217,0.2)] hover:bg-[#E4F0FF] dark:bg-[#1A2A3A] dark:text-[#6BA3D6] dark:border-[rgba(74,144,217,0.3)] dark:hover:bg-[#1E3348]"
        >
          → {s.dayLabel}, {s.timeLabel}
        </button>
      ))}
      <button
        onClick={onDismiss}
        className="text-[12px] py-1.5 px-3 rounded-[6px] bg-transparent text-[#B0ADA6] border border-[#F0EEEA] hover:bg-[#F5F4F2] dark:text-[#666] dark:border-[#333] dark:hover:bg-[#2A2A2A]"
      >
        Dismiss
      </button>
    </div>
  );
}

interface UnscheduledTasksProps {
  tasks: Task[];
  doesNotFit: Task[];
  currentDateStr: string;
}

export function UnscheduledTasks({ tasks, doesNotFit, currentDateStr }: UnscheduledTasksProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'agenda-unscheduled' });
  const { updateTask } = useTaskStore();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const suggestions = useRescheduleSuggestions(doesNotFit, currentDateStr);

  // Reset dismissed state when doesNotFit list changes
  const doesNotFitKey = doesNotFit.map(t => t.id).join(',');
  useEffect(() => {
    setDismissedIds(new Set());
  }, [doesNotFitKey]);

  const handleMove = async (taskId: string, suggestion: SlotSuggestion) => {
    await updateTask({
      id: taskId,
      when: { date: suggestion.dateStr },
      scheduledTime: formatTime(suggestion.startMinutes),
    });
  };

  const handleDismiss = (taskId: string) => {
    setDismissedIds(prev => new Set([...prev, taskId]));
  };

  if (tasks.length === 0 && doesNotFit.length === 0) return null;

  return (
    <div
      ref={setNodeRef}
      className={`mt-4 rounded-lg border-2 border-dashed transition-colors ${
        isOver
          ? 'border-primary bg-primary/5'
          : 'border-[#E0E0E0] dark:border-[#3A3A3A]'
      } p-3`}
    >
      {doesNotFit.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-danger" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
            <span className="text-[12px] font-medium text-danger">
              Doesn't fit today ({doesNotFit.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {doesNotFit.map(task => {
              const taskSuggestions = suggestions.get(task.id);
              const isDismissed = dismissedIds.has(task.id);
              return (
                <div key={task.id}>
                  <DraggableTask task={task} />
                  {taskSuggestions && taskSuggestions.length > 0 && !isDismissed && (
                    <RescheduleSuggestions
                      suggestions={taskSuggestions}
                      onMove={(s) => handleMove(task.id, s)}
                      onDismiss={() => handleDismiss(task.id)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-[#8A8A8A] dark:text-[#666] uppercase tracking-wide mb-2">
            Unscheduled
          </h3>
          <div className="space-y-1.5">
            {tasks.map(task => (
              <DraggableTask key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
