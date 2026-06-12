import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFocusWhen } from '../../hooks/useFocus';
import { useTaskStore } from '../../stores/taskStore';
import { WhenValue } from '../../types/task';
import { getTagColor, filterTagSuggestions } from '../../utils/projectColors';
import { TagIcon } from '../../utils/viewIcons';
import { TagSuggestions } from '../../components/TagSuggestions';
import { modalShadow } from '../../utils/styles';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import { WhenButton } from '../../components/WhenDatePicker';
import { DeadlineButton } from '../../components/DeadlinePicker';
import { ProjectSelector } from '../../components/ProjectSelector';
import { PrioritySelector } from '../../components/PrioritySelector';
import { DurationPicker } from '../../components/DurationPicker';
import { WikilinkRenderer } from '../../components/WikilinkRenderer';
import { useAgendaNames } from './useAgendaNames';
import { useSubtaskAdder, SubtaskInputRow, SubtaskToolbarButton } from '../../components/SubtaskAdder';
import { ChecklistItemRow } from '../../components/ChecklistItemRow';
import { detectDateHint } from '../../utils/detectDateHints';
import { DateHintBanner } from '../../components/DateHintBanner';
import { getWhenType } from '../../types/task';

interface AgendaTaskModalProps {
  taskId: string;
  onClose: () => void;
}

export function AgendaTaskModal({ taskId, onClose }: AgendaTaskModalProps) {
  const { tasks, updateTask, toggleTaskComplete, tagColors, availableTags, availableProjects, projectColors, navigateToPerson, navigateToProject } = useTaskStore();
  const { personNames, projectNames } = useAgendaNames();
  const task = tasks.find(t => t.id === taskId);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [localDeadline, setLocalDeadline] = useState<string | null>(task?.deadline ?? null);
  const [tagInput, setTagInput] = useState('');
  const [tagHighlightedIndex, setTagHighlightedIndex] = useState(-1);
  const tagSuggestions = useMemo(() => filterTagSuggestions(tagInput, availableTags, tags), [tagInput, availableTags, tags]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);
  const {
    isAddingSubtask, subtaskDraft, setSubtaskDraft, subtaskInputRef,
    openSubtaskInput, commit: commitSubtask, closeSubtaskInput, resetSubtaskAdder,
  } = useSubtaskAdder(notes, async (newNotes) => {
    setNotes(newNotes);
    if (task) await updateTask({ id: task.id, notes: newNotes });
  });

  const hint = useMemo(() => detectDateHint(title), [title]);
  const [dismissedPhrase, setDismissedPhrase] = useState<string | null>(null);

  // Refs to track current values for save-before-close
  const titleRef = useRef(title);
  const notesRef = useRef(notes);
  titleRef.current = title;
  notesRef.current = notes;

  // Sync local state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes);
      setTags(task.tags);
      setLocalDeadline(task.deadline ?? null);
      resetSubtaskAdder();
    }
  }, [task?.id, task?.title, task?.notes, task?.tags, task?.deadline, resetSubtaskAdder]);

  useFocusWhen(titleInputRef, isEditingTitle);
  useFocusWhen(notesInputRef, isEditingNotes);

  // Save any pending title/notes changes
  const savePendingChanges = useCallback(async () => {
    if (!task) return;
    const updates: { id: string; title?: string; notes?: string } = { id: task.id };
    let hasChanges = false;

    if (titleRef.current !== task.title) {
      updates.title = titleRef.current;
      hasChanges = true;
    }
    if (notesRef.current !== task.notes) {
      updates.notes = notesRef.current;
      hasChanges = true;
    }

    if (hasChanges) {
      await updateTask(updates);
    }
  }, [task, updateTask]);

  // Close handler that saves first
  const handleClose = useCallback(async () => {
    await savePendingChanges();
    onClose();
  }, [savePendingChanges, onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  if (!task) return null;

  const handleTitleBlur = async () => {
    setIsEditingTitle(false);
    if (title !== task.title) {
      await updateTask({ id: task.id, title });
    }
  };

  const handlePersonClick = (name: string) => {
    navigateToPerson(name);
    handleClose();
  };

  const handleProjectClick = (name: string) => {
    navigateToProject(name);
    handleClose();
  };

  const handleNotesBlur = async () => {
    setIsEditingNotes(false);
    if (notes !== task.notes) {
      await updateTask({ id: task.id, notes });
    }
  };

  const handleWhenChange = async (when: WhenValue) => {
    await updateTask({ id: task.id, when });
  };

  const handleDeadlineChange = async (deadline: string | null) => {
    setLocalDeadline(deadline);
    await updateTask({ id: task.id, deadline });
  };

  const handleProjectChange = async (project: string) => {
    await updateTask({ id: task.id, projects: project ? [project] : [] });
  };

  const handlePriorityChange = async (priority: number | null) => {
    await updateTask({ id: task.id, priority });
  };

  const handleDurationChange = async (durationMinutes: number | null) => {
    if (durationMinutes === null) {
      // Removing duration unschedules the task from the timeline
      await updateTask({ id: task.id, durationMinutes: 0, scheduledTime: '' });
    } else {
      await updateTask({ id: task.id, durationMinutes });
    }
  };

  const handleCheckboxClick = async () => {
    await toggleTaskComplete(task.id);
  };

  const handleTagsChange = async (newTags: string[]) => {
    setTags(newTags);
    await updateTask({ id: task.id, tags: newTags });
  };

  const addTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      handleTagsChange([...tags, trimmed]);
    }
    setTagInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 dark:bg-black/40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className={`task-expanded relative w-full max-w-2xl mx-4 bg-white dark:bg-[#2A2A2A] rounded-xl ${modalShadow} flex flex-col max-h-[80vh]`}>
        {/* Title row */}
        <div className="flex items-start gap-4 px-5 py-4 flex-shrink-0">
          {/* Checkbox */}
          <TaskCheckbox
            completed={task.completed}
            onChange={handleCheckboxClick}
            size="lg"
            className={`mt-1 ${!task.completed ? 'hover:border-primary dark:hover:border-primary' : ''}`}
          />

          {/* Title */}
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleClose();
                }
              }}
              className="task-input flex-1 text-[15px] bg-transparent text-[#1A1A1A] dark:text-[#E8E8E8] placeholder-[#A0A0A0] dark:placeholder-[#666] font-normal"
              placeholder="Task title"
            />
          ) : (
            <div
              className="flex-1 cursor-text min-h-[24px]"
              onClick={() => setIsEditingTitle(true)}
            >
              <WikilinkRenderer
                title={title}
                personNames={personNames}
                projectNames={projectNames}
                onPersonClick={handlePersonClick}
                onProjectClick={handleProjectClick}
                projectColors={projectColors}
                availableProjects={availableProjects}
                className="text-[15px] text-[#1A1A1A] dark:text-[#E8E8E8] font-normal"
              />
            </div>
          )}
        </div>

        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1 min-h-0">

        {/* Date hint banner */}
        {(() => {
          const showHint = task && hint !== null
            && hint.matchedPhrase !== dismissedPhrase
            && (hint.type === 'when' ? getWhenType(task.when) === 'inbox' : !localDeadline);
          return showHint ? (
            <DateHintBanner
              hint={hint!}
              onAccept={async () => {
                setTitle(hint!.cleanTitle);
                await updateTask({ id: task!.id, title: hint!.cleanTitle });
                if (hint!.type === 'when') await handleWhenChange(hint!.whenValue);
                else await handleDeadlineChange(hint!.dateString);
                setDismissedPhrase(hint!.matchedPhrase);
              }}
              onDismiss={() => setDismissedPhrase(hint!.matchedPhrase)}
            />
          ) : null;
        })()}

        {/* Notes */}
        <div className="px-5 pb-4 pl-14">
          {isEditingNotes ? (
            <textarea
              ref={notesInputRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              rows={3}
              placeholder="Notes"
              className="task-input w-full text-[14px] text-[#555] dark:text-[#999] bg-transparent resize-none placeholder-[#AAA] dark:placeholder-[#666] leading-relaxed"
            />
          ) : (
            <div
              className="cursor-text min-h-[60px]"
              onClick={() => setIsEditingNotes(true)}
            >
              {notes ? (
                <div className="whitespace-pre-wrap text-[14px] text-[#555] dark:text-[#999] leading-relaxed">
                  {notes.split('\n').map((line, i) => (
                    <div key={i}>
                      {line ? (
                        <WikilinkRenderer
                          title={line}
                          personNames={personNames}
                          projectNames={projectNames}
                          onPersonClick={handlePersonClick}
                          onProjectClick={handleProjectClick}
                          projectColors={projectColors}
                          availableProjects={availableProjects}
                          autolinkUrls
                          openUnknownWikilinks
                        />
                      ) : (
                        <br />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[14px] text-[#AAA] dark:text-[#666]">Notes</span>
              )}
            </div>
          )}
        </div>

        {/* Checklist + new subtask input share one container for alignment */}
        {(task.checklist.length > 0 || isAddingSubtask) && (
          <div className="px-5 pb-3 pl-14 space-y-1.5">
            {task.checklist.map((item, index) => (
              <ChecklistItemRow key={index} item={item} index={index} taskId={task.id} size="sm" disabled={task.completed} />
            ))}
            {isAddingSubtask && (
              <SubtaskInputRow
                draft={subtaskDraft}
                setDraft={setSubtaskDraft}
                inputRef={subtaskInputRef}
                onCommit={commitSubtask}
                onClose={closeSubtaskInput}
              />
            )}
          </div>
        )}

        </div>{/* end scrollable content */}

        {/* Bottom toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 bg-[#FAFAFA] dark:bg-[#252525] rounded-b-xl flex-shrink-0">
          <WhenButton value={task.when} onChange={handleWhenChange} />
          <DeadlineButton value={localDeadline} onChange={handleDeadlineChange} />
          <ProjectSelector
            value={task.projects[0] || ''}
            onChange={handleProjectChange}
            className="px-2 py-1 text-[12px] rounded border border-[#E8E8E8] dark:border-[#3A3A3A] bg-white dark:bg-[#333] text-[#1A1A1A] dark:text-[#E0E0E0] cursor-pointer max-w-[110px]"
          />
          <PrioritySelector value={task.priority} onChange={handlePriorityChange} />
          <DurationPicker value={task.durationMinutes} onChange={handleDurationChange} />
          <SubtaskToolbarButton count={task.checklist.length} onClick={openSubtaskInput} />

          <div className="flex items-center gap-1.5">
            <TagIcon className="w-4 h-4 text-primary flex-shrink-0" circleFill="currentColor" />
            {tags.map((tag) => {
              const color = getTagColor(tag, tagColors);
              return (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  #{tag}
                  <button
                    onClick={() => handleTagsChange(tags.filter(t => t !== tag))}
                    className="hover:text-danger transition-colors"
                  >
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              );
            })}
            <div className="relative">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => { setTagInput(e.target.value); setTagHighlightedIndex(-1); }}
                onKeyDown={(e) => {
                  if (tagSuggestions.length > 0) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setTagHighlightedIndex(i => Math.min(i + 1, tagSuggestions.length - 1)); return; }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setTagHighlightedIndex(i => Math.max(i - 1, -1)); return; }
                    if ((e.key === 'Enter' || e.key === 'Tab') && tagHighlightedIndex >= 0 && tagSuggestions[tagHighlightedIndex]) {
                      e.preventDefault();
                      const name = tagSuggestions[tagHighlightedIndex].name;
                      if (!tags.includes(name)) handleTagsChange([...tags, name]);
                      setTagInput('');
                      setTagHighlightedIndex(-1);
                      return;
                    }
                  }
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault();
                    e.stopPropagation();
                    addTag();
                    setTagHighlightedIndex(-1);
                  }
                  if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                    handleTagsChange(tags.slice(0, -1));
                  }
                  if (e.key === 'Escape') { setTagInput(''); setTagHighlightedIndex(-1); }
                }}
                onBlur={() => { if (tagInput.trim()) addTag(); }}
                placeholder="Tags"
                className="task-input text-[11px] bg-transparent text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#AAA] dark:placeholder-[#666] w-16"
              />
              <TagSuggestions
                suggestions={tagSuggestions}
                highlightedIndex={tagHighlightedIndex}
                onSelect={(name) => {
                  if (!tags.includes(name)) handleTagsChange([...tags, name]);
                  setTagInput('');
                  setTagHighlightedIndex(-1);
                }}
                tagColors={tagColors}
              />
            </div>
          </div>

          <div className="ml-auto">
            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-[12px] text-[#888] dark:text-[#666] hover:text-[#1A1A1A] dark:hover:text-[#E0E0E0] transition-colors rounded"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
