import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Task, getWhenType, WhenValue } from '../types/task';
import { useTaskStore } from '../stores/taskStore';
import { usePanelState } from '../hooks/usePanelState';
import { PRIORITY_CONFIG } from '../utils/projectColors';
import { formatWhenDisplay, formatDeadlineCountdown, getDeadlineUrgency, formatDateForDisplay, getToday } from '../utils/dates';
import { openInEditor, editorLabel } from '../utils/openInEditor';
import { WikilinkRenderer } from './WikilinkRenderer';
import { useSubtaskAdder, SubtaskInputRow, SubtaskToolbarButton } from './SubtaskAdder';
import { WhenButton } from './WhenDatePicker';
import { DeadlineButton } from './DeadlinePicker';
import { ProjectSelector } from './ProjectSelector';
import { PrioritySelector } from './PrioritySelector';
import { DurationPicker } from './DurationPicker';
import { ChecklistItemRow } from './ChecklistItemRow';
import { MarkdownNotesRenderer } from './MarkdownNotesRenderer';
import { TagEditor } from './TagEditor';
import { WikilinkSuggestions } from './WikilinkSuggestions';
import { useWikilinkSuggest, applyWikilink, buildWikilinkKeyHandler } from '../hooks/useWikilinkSuggest';
import { detectDateHint } from '../utils/detectDateHints';
import { DateHintBanner } from './DateHintBanner';

interface TaskItemProps {
  task: Task;
  showProject?: boolean;
}


export const TaskItem = memo(function TaskItem({ task, showProject = true }: TaskItemProps) {
  const { selectedTaskIds, toggleTaskSelection, expandedTaskId, expandTask, setSelectedPerson, setSelectedProject, setSelectedTag, currentView } = usePanelState();
  const { toggleTaskComplete, updateTask, availableProjects, availablePeople, vaultPath, projectColors, tagColors, openWhenPicker, openDeadlinePicker, isObsidianVault, editorType, editorCustomCommand } = useTaskStore(useShallow((s) => ({
    toggleTaskComplete: s.toggleTaskComplete,
    updateTask: s.updateTask,
    availableProjects: s.availableProjects,
    availablePeople: s.availablePeople,
    vaultPath: s.vaultPath,
    projectColors: s.projectColors,
    tagColors: s.tagColors,
    openWhenPicker: s.openWhenPicker,
    openDeadlinePicker: s.openDeadlinePicker,
    isObsidianVault: s.isObsidianVault,
    editorType: s.editorType,
    editorCustomCommand: s.editorCustomCommand,
  })));
  // Per-row derived flags: only this row re-renders when its picker opens or it lingers
  const whenPickerForceOpen = useTaskStore((s) => s.taskIdWithOpenWhenPicker === task.id);
  const deadlinePickerForceOpen = useTaskStore((s) => s.taskIdWithOpenDeadlinePicker === task.id);
  const isLingeringCompleted = useTaskStore((s) => task.completed && s.completingTaskIds.includes(task.id));

  // Create sets of person and project names for wiki-link rendering
  const personNames = useMemo(() => new Set(availablePeople.map(p => p.name)), [availablePeople]);
  const projectNames = useMemo(() => new Set(availableProjects.map(p => p.name)), [availableProjects]);
  const isSelected = selectedTaskIds.includes(task.id);
  const isExpanded = expandedTaskId === task.id;
  const whenType = getWhenType(task.when);

  // Track collapse animation
  const [isCollapsing, setIsCollapsing] = useState(false);
  const prevExpandedRef = useRef(isExpanded);

  // Detect expand → collapse transition synchronously (before paint) to avoid flash
  useLayoutEffect(() => {
    if (prevExpandedRef.current && !isExpanded) {
      setIsCollapsing(true);
    }
    prevExpandedRef.current = isExpanded;
  }, [isExpanded]);

  // Separate effect for the collapse timeout cleanup
  useEffect(() => {
    if (isCollapsing) {
      const timer = setTimeout(() => setIsCollapsing(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isCollapsing]);

  // Check if task is overdue (deadline past takes priority, then when date)
  const isOverdue = useMemo(() => {
    if (task.completed) return false;
    const today = getToday();
    // Check deadline first (takes priority)
    if (task.deadline) {
      const deadlineDate = new Date(task.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      if (deadlineDate.getTime() < today.getTime()) return true;
    }
    // Then check when date
    if (whenType === 'date' && typeof task.when === 'object' && 'date' in task.when) {
      const taskDate = new Date(task.when.date);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate.getTime() < today.getTime();
    }
    return false;
  }, [task.completed, task.when, task.deadline, whenType]);
  const expandedRef = useRef<HTMLDivElement>(null);

  // When a date shortcut (Cmd+S / Cmd+D) targets this task, scroll its expanded card to
  // the top of the list so the picker that's about to open is fully in view.
  const isPickerTarget = whenPickerForceOpen || deadlinePickerForceOpen;
  useLayoutEffect(() => {
    if (isPickerTarget && expandedRef.current) {
      expandedRef.current.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  }, [isPickerTarget]);

  // Keep the selected row visible during keyboard navigation (↑/↓, ctrl+j/k).
  // block:'nearest' makes this a no-op for click-selection (already in view).
  const isSoleSelection = isSelected && selectedTaskIds.length === 1;
  useLayoutEffect(() => {
    if (isSoleSelection && expandedRef.current) {
      expandedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSoleSelection]);

  // Local state for editing (only used when expanded)
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);

  const [localPriority, setLocalPriority] = useState<number | null>(task.priority);
  const [localDeadline, setLocalDeadline] = useState<string | null>(task.deadline ?? null);
  const [projects, setProjects] = useState(task.projects);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [titleCursor, setTitleCursor] = useState(0);
  const [notesCursor, setNotesCursor] = useState(0);
  const [titleWikiHighlight, setTitleWikiHighlight] = useState(-1);
  const [notesWikiHighlight, setNotesWikiHighlight] = useState(-1);
  const titleWiki = useWikilinkSuggest(title, titleCursor);
  const notesWiki = useWikilinkSuggest(notes, notesCursor);
  const hint = useMemo(() => detectDateHint(title), [title]);
  const [dismissedPhrase, setDismissedPhrase] = useState<string | null>(null);
  // Reset dismissed state when task changes
  useEffect(() => { setDismissedPhrase(null); }, [task.id]);
  const {
    isAddingSubtask, subtaskDraft, setSubtaskDraft, subtaskInputRef,
    openSubtaskInput, commit: commitSubtask, closeSubtaskInput, resetSubtaskAdder,
  } = useSubtaskAdder(notes, async (newNotes) => {
    setNotes(newNotes);
    await updateTask({ id: task.id, notes: newNotes });
  });

  // Refs to track current values for the click-outside handler
  const titleRef = useRef(title);
  const notesRef = useRef(notes);
  titleRef.current = title;
  notesRef.current = notes;

  // Reset local state when task changes or when expanded
  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes);
    setLocalPriority(task.priority);
    setLocalDeadline(task.deadline ?? null);
    setProjects(task.projects);
    setIsEditingNotes(false);
    resetSubtaskAdder();
  }, [task.id, task.title, task.notes, task.when, task.priority, task.deadline, task.projects, isExpanded, resetSubtaskAdder]);

  // Focus notes textarea when entering edit mode
  useEffect(() => {
    if (isEditingNotes && notesTextareaRef.current) {
      notesTextareaRef.current.focus();
      const len = notesTextareaRef.current.value.length;
      notesTextareaRef.current.setSelectionRange(len, len);
      const el = notesTextareaRef.current;
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, [isEditingNotes]);


  // Save any pending changes
  const savePendingChanges = async () => {
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
  };

  // Handle click outside to collapse expanded task
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = async (event: MouseEvent) => {
      const target = event.target as Element;
      // If target was removed from DOM before this listener fired (e.g. a dropdown
      // that hides itself on mousedown), don't treat it as an outside click.
      if (!document.contains(target)) return;
      const insideTask = expandedRef.current?.contains(target);
      const insidePicker = !!target.closest?.('[data-picker-portal]');
      if (!insideTask && !insidePicker) {
        await savePendingChanges();
        expandTask(null);
      }
    };

    // Use mousedown instead of click for more immediate response
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded, expandTask, task.id, task.title, task.notes, updateTask]);

  const handleClick = (e: React.MouseEvent) => {
    // Single click = select/highlight
    toggleTaskSelection(task.id, e.metaKey || e.ctrlKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Double click = expand for editing
    e.stopPropagation();
    expandTask(task.id);
  };

  const handleCheckboxClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleTaskComplete(task.id);
  };

  const handleTitleBlur = () => { savePendingChanges(); };

  const handleNotesBlur = () => { savePendingChanges(); };

  const handleWhenChange = async (newWhen: WhenValue) => {
    await updateTask({ id: task.id, when: newWhen });
  };

  const handleProjectChange = async (newProject: string) => {
    const newProjects = newProject ? [newProject] : [];
    setProjects(newProjects);
    await updateTask({ id: task.id, projects: newProjects });
  };

  const handlePriorityChange = async (newPriority: number | null) => {
    setLocalPriority(newPriority);
    await updateTask({ id: task.id, priority: newPriority });
  };

  const handleDeadlineChange = async (newDeadline: string | null) => {
    setLocalDeadline(newDeadline);
    await updateTask({ id: task.id, deadline: newDeadline });
  };

  const getWhenPill = () => {
    if (task.completed) return null;
    const label = formatWhenDisplay(task.when);
    if (!label) return null;
    if (currentView === 'today' && (task.when === 'today' || task.when === 'evening')) return null;
    if (label === 'Today') {
      // Hide star in Today view — it's redundant
      if (currentView === 'today') return null;
      return (
        <svg className="w-4 h-4 mt-[3px] -mr-1 flex-shrink-0" viewBox="0 0 24 24" fill="#F5C000">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
      );
    }
    return (
      <div className="flex items-center bg-[#f0f1f5] dark:bg-[#3a3d4a] rounded-md px-2 py-0.5 flex-shrink-0">
        <span className="text-[12px] text-[#555] dark:text-[#bbb] font-medium">{label}</span>
      </div>
    );
  };

  const getDeadlineDisplay = () => {
    if (!task.deadline || task.completed) return null;
    const urgency = getDeadlineUrgency(task.deadline);
    const isOverdueDeadline = urgency === 'overdue';
    const color = isOverdueDeadline ? '#e84545' : undefined;
    const countdown = formatDeadlineCountdown(task.deadline);
    return (
      <div className="flex items-center gap-1 flex-shrink-0">
        <svg className={`w-3.5 h-3.5 ${isOverdueDeadline ? '' : 'text-[#555] dark:text-[#999]'}`} style={color ? { color } : undefined} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <rect x="3.5" y="15" width="1" height="7" />
        </svg>
        <span className={`text-[11px] font-medium ${isOverdueDeadline ? '' : 'text-[#555] dark:text-[#999]'}`}
              style={isOverdueDeadline ? { color } : undefined}>
          {countdown}
        </span>
      </div>
    );
  };

  const getPriorityIndicator = () => {
    if (!task.priority) return null;

    const config = PRIORITY_CONFIG[task.priority];
    if (!config) return null;

    return (
      <span
        className="text-[11px] font-bold"
        style={{ color: config.color }}
        title={`Priority ${task.priority}`}
      >
        {config.label}
      </span>
    );
  };

  // Collapse the expanded card (saves pending changes first)
  const handleCollapse = async () => {
    await savePendingChanges();
    expandTask(null);
  };

  // Handle Enter key in expanded task to collapse
  const handleExpandedKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleCollapse();
    }
  };

  const showExpandedContent = (isExpanded || isCollapsing) && !task.completed;

  // Just checked off: row lingers with the checked state, then animates out (see App.css)
  const isLingering = isLingeringCompleted;

  // Regular (collapsed) task row
  const cardClasses = isSelected
    ? 'bg-[#D6E4FA] dark:bg-[#1E3A5F] ml-[36px] mr-4 rounded-lg px-4 py-1.5'
    : isOverdue
      ? 'ml-[36px] mr-4 px-4 py-1.5 hover:bg-[#F5F5F5] dark:hover:bg-[#252525] rounded-lg'
      : 'ml-[36px] mr-4 px-4 py-1.5 hover:bg-[#F5F5F5] dark:hover:bg-[#252525] rounded-lg';

  return (
    <div
      ref={expandedRef}
      className={showExpandedContent
        ? 'scroll-mt-2 ml-[36px] mr-4 my-1 overflow-x-clip bg-white dark:bg-[#2A2A2A] rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.08),0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_8px_rgba(0,0,0,0.3),0_4px_24px_rgba(0,0,0,0.25)] border border-[#E8E8E8] dark:border-[#3A3A3A]'
        : `group cursor-pointer transition-all ${cardClasses}${isLingering ? ' task-completing' : ''}`
      }
      onClick={!showExpandedContent ? handleClick : undefined}
      onDoubleClick={!showExpandedContent ? handleDoubleClick : undefined}
    >
      {/* Title row — stays in place, becomes card header when expanded */}
      <div
        className={showExpandedContent
          ? 'flex items-start gap-3 px-5 py-4 cursor-pointer'
          : 'flex items-start gap-3'
        }
        onDoubleClick={showExpandedContent ? handleCollapse : undefined}
      >
        {/* Checkbox */}
        <button
          onClick={handleCheckboxClick}
          className={`mt-[3px] w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all flex-shrink-0 ${
            task.completed
              ? 'bg-primary border-primary'
              : 'border-black/20 dark:border-white/25 hover:border-primary dark:hover:border-primary'
          }${isLingering ? ' checkbox-pop' : ''}`}
        >
          {task.completed && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* When pill - only in collapsed */}
        {!showExpandedContent && getWhenPill()}

        {/* Duration indicator */}
        {!showExpandedContent && !task.completed && task.durationMinutes && !task.scheduledTime && (
          <div className="flex items-center gap-0.5 flex-shrink-0 mt-[2px]">
            <svg className="w-3 h-3 text-[#999] dark:text-[#666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] text-[#999] dark:text-[#666]">
              {task.durationMinutes >= 60
                ? `${Math.floor(task.durationMinutes / 60)}h${task.durationMinutes % 60 ? task.durationMinutes % 60 + 'm' : ''}`
                : `${task.durationMinutes}m`
              }
            </span>
          </div>
        )}

        {/* Title content */}
        {showExpandedContent ? (
          <div className="flex-1 min-w-0 flex items-center gap-2 relative">
            {getPriorityIndicator()}
            <div className="relative flex-1">
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setTitleCursor(e.target.selectionStart ?? 0); setTitleWikiHighlight(-1); }}
                onClick={(e) => { e.stopPropagation(); setTitleCursor((e.target as HTMLInputElement).selectionStart ?? 0); }}
                onKeyUp={(e) => setTitleCursor((e.target as HTMLInputElement).selectionStart ?? 0)}
                onBlur={handleTitleBlur}
                onKeyDown={buildWikilinkKeyHandler(titleWiki.suggestions, titleWikiHighlight, title, titleCursor, titleInputRef, setTitleWikiHighlight, setTitle, setTitleCursor, handleExpandedKeyDown)}
                onDoubleClick={(e) => e.stopPropagation()}
                className="task-input w-full text-[15px] font-normal bg-transparent text-[#1A1A1A] dark:text-[#E8E8E8] focus:outline-none"
                placeholder="Task title"
                autoFocus
              />
              <WikilinkSuggestions
                suggestions={titleWiki.suggestions}
                highlightedIndex={titleWikiHighlight}
                onSelect={(name) => {
                  const { newValue, newCursorPos } = applyWikilink(title, titleCursor, name);
                  setTitle(newValue);
                  setTitleCursor(newCursorPos);
                  setTitleWikiHighlight(-1);
                  setTimeout(() => { if (titleInputRef.current) { titleInputRef.current.selectionStart = titleInputRef.current.selectionEnd = newCursorPos; titleInputRef.current.focus(); } }, 0);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {!task.completed && getPriorityIndicator()}
              <WikilinkRenderer
                title={task.title}
                personNames={personNames}
                projectNames={projectNames}
                onPersonClick={setSelectedPerson}
                onProjectClick={setSelectedProject}
                onRemoveLink={(raw) => {
                  const newTitle = task.title.replace(raw, '').replace(/\s+/g, ' ').trim();
                  updateTask({ id: task.id, title: newTitle });
                }}
                projectColors={projectColors}
                availableProjects={availableProjects}
                isObsidianVault={isObsidianVault}
                className={`text-[14px] leading-[1.4] ${
                  task.completed
                    ? 'line-through text-[#A0A0A0] dark:text-[#666]'
                    : 'text-black/85 dark:text-white/85'
                }`}
              />
              {task.notes && !task.completed && (
                <svg className="w-3.5 h-3.5 text-[#B0B0B0] dark:text-[#666] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
              )}
              {!task.completed && task.tags.map((tag) => {
                // Subtle tint when the tag has a custom color; neutral gray otherwise
                const customColor = tagColors[tag];
                return (
                  <button
                    key={tag}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTag(tag);
                    }}
                    className="inline-flex items-center text-[11px] px-2 py-[1px] rounded-full border border-[#D0D0D5] dark:border-[#555] bg-transparent text-[#B0B0B5] dark:text-[#777] hover:bg-[#F0F0F0] dark:hover:bg-[#3A3A3A] transition-colors flex-shrink-0"
                    style={customColor ? { color: `${customColor}CC`, borderColor: `${customColor}73` } : undefined}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Checklist indicator */}
            {!task.completed && task.checklist.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[11px] text-[#888] flex items-center gap-0.5">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {task.checklist.filter((c) => c.completed).length}/{task.checklist.length}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Right side indicators - only in collapsed */}
        {!showExpandedContent && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {task.recurringTemplateId && !task.completed && (
              <svg className="w-3 h-3 text-success flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {showProject && task.projects.length > 0 && !task.completed && (
              <div className="flex items-center gap-1 min-w-0 max-w-[180px]">
                <svg className="w-3 h-3 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="5" />
                </svg>
                <span className="text-[11px] text-[#888] dark:text-[#777] truncate" title={task.projects.join(', ')}>
                  {task.projects.join(', ')}
                </span>
              </div>
            )}
            {currentView === 'logbook' && task.completedDate && (
              <span className="text-[11px] text-[#999] dark:text-[#666]">
                {formatDateForDisplay(task.completedDate)}
              </span>
            )}
            {getDeadlineDisplay()}
          </div>
        )}
      </div>

      {/* Expandable detail section — always in DOM, animates height via CSS grid */}
      <div className="task-expand-detail" data-expanded={isExpanded && !isCollapsing}>
        <div>
          {showExpandedContent && (
            <div className={isCollapsing ? 'pointer-events-none' : ''}>
              {/* Date hint banner */}
              {(() => {
                const showHint = hint !== null
                  && hint.matchedPhrase !== dismissedPhrase
                  && (hint.type === 'when' ? whenType === 'inbox' : !localDeadline);
                return showHint ? (
                  <DateHintBanner
                    hint={hint!}
                    onAccept={async () => {
                      setTitle(hint!.cleanTitle);
                      if (hint!.type === 'deadline') setLocalDeadline(hint!.dateString);
                      const updates: Parameters<typeof updateTask>[0] = { id: task.id, title: hint!.cleanTitle };
                      if (hint!.type === 'when') updates.when = hint!.whenValue;
                      else updates.deadline = hint!.dateString;
                      await updateTask(updates);
                      setDismissedPhrase(hint!.matchedPhrase);
                    }}
                    onDismiss={() => setDismissedPhrase(hint!.matchedPhrase)}
                  />
                ) : null;
              })()}

              {/* Notes - rendered view with clickable links, click to edit */}
              <div className="px-5 pb-5 pl-14">
                {isEditingNotes ? (
                  <div className="relative">
                    <textarea
                      ref={notesTextareaRef}
                      value={notes}
                      onChange={(e) => { setNotes(e.target.value); setNotesCursor(e.target.selectionStart ?? 0); setNotesWikiHighlight(-1); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                      onClick={(e) => setNotesCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
                      onKeyUp={(e) => setNotesCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
                      onKeyDown={buildWikilinkKeyHandler(notesWiki.suggestions, notesWikiHighlight, notes, notesCursor, notesTextareaRef, setNotesWikiHighlight, setNotes, setNotesCursor)}
                      onBlur={() => {
                        handleNotesBlur();
                        setIsEditingNotes(false);
                        setNotesWikiHighlight(-1);
                      }}
                      className="task-input w-full min-h-[3.5rem] text-[14px] text-[#555] dark:text-[#999] bg-transparent focus:outline-none resize-none placeholder-[#AAA] dark:placeholder-[#666] leading-relaxed"
                      placeholder="Notes"
                    />
                    <WikilinkSuggestions
                      suggestions={notesWiki.suggestions}
                      highlightedIndex={notesWikiHighlight}
                      onSelect={(name) => {
                        const { newValue, newCursorPos } = applyWikilink(notes, notesCursor, name);
                        setNotes(newValue);
                        setNotesCursor(newCursorPos);
                        setNotesWikiHighlight(-1);
                        setTimeout(() => { if (notesTextareaRef.current) { notesTextareaRef.current.selectionStart = notesTextareaRef.current.selectionEnd = newCursorPos; notesTextareaRef.current.focus(); } }, 0);
                      }}
                    />
                  </div>
                ) : (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingNotes(true);
                    }}
                    className="cursor-text min-h-[60px] text-[14px] text-[#555] dark:text-[#999]"
                  >
                    {notes ? (
                      <MarkdownNotesRenderer
                        notes={notes}
                        personNames={personNames}
                        projectNames={projectNames}
                        onPersonClick={setSelectedPerson}
                        onProjectClick={setSelectedProject}
                        onRemoveLink={(raw) => {
                          const newNotes = notes.replace(raw, '').replace(/\s+/g, ' ').trim();
                          setNotes(newNotes);
                          updateTask({ id: task.id, notes: newNotes });
                        }}
                        projectColors={projectColors}
                        availableProjects={availableProjects}
                        isObsidianVault={isObsidianVault}
                      />
                    ) : (
                      <span className="text-[#AAA] dark:text-[#666]">Notes</span>
                    )}
                  </div>
                )}
              </div>

              {/* Tags */}
              <TagEditor
                tags={task.tags}
                onTagClick={(tag) => setSelectedTag(tag)}
                onTagsChange={async (newTags) => {
                  await updateTask({ id: task.id, tags: newTags });
                }}
                tagColors={tagColors}
              />

              {/* Checklist + new subtask input share one container for alignment */}
              {(task.checklist.length > 0 || (isAddingSubtask && !task.completed)) && (
                <div className="px-5 pb-4 pl-14 space-y-2">
                  {task.checklist.map((item, index) => (
                    <ChecklistItemRow
                      key={index}
                      item={item}
                      index={index}
                      taskId={task.id}
                      size="md"
                      disabled={task.completed}
                    />
                  ))}
                  {isAddingSubtask && !task.completed && (
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

              {/* Date information display */}
              {!task.completed && (formatWhenDisplay(task.when) || task.deadline) && (
                <div className="px-5 pb-3 pl-14 space-y-1.5">
                  {formatWhenDisplay(task.when) && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" style={{ color: '#e8456a' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span className="text-[13px] text-[#555] dark:text-[#999]">{formatWhenDisplay(task.when)}</span>
                    </div>
                  )}
                  {task.deadline && (() => {
                    const urgency = getDeadlineUrgency(task.deadline);
                    const isOverdueDeadline = urgency === 'overdue';
                    const urgencyColor = isOverdueDeadline ? '#e84545' : undefined;
                    return (
                      <div className="flex items-center gap-2">
                        <svg className={`w-4 h-4 ${isOverdueDeadline ? '' : 'text-[#555] dark:text-[#999]'}`} style={urgencyColor ? { color: urgencyColor } : undefined} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <rect x="3.5" y="15" width="1" height="7" />
                        </svg>
                        <span className="text-[13px] text-[#555] dark:text-[#999]">Deadline: {formatDateForDisplay(task.deadline)}</span>
                        <span className={`text-[12px] font-medium ${isOverdueDeadline ? '' : 'text-[#555] dark:text-[#999]'}`}
                              style={isOverdueDeadline ? { color: urgencyColor } : undefined}>{formatDeadlineCountdown(task.deadline)}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Bottom toolbar with actions */}
              <div className="flex flex-wrap items-center justify-between gap-y-2 px-5 py-3 border-t border-[#F0F0F0] dark:border-[#3A3A3A]">
                {/* Left side - When & Project */}
                <div className="flex flex-wrap items-center gap-3 gap-y-2 min-w-0">
                  {/* When date picker */}
                  <WhenButton
                    value={task.when}
                    onChange={handleWhenChange}
                    forceOpen={whenPickerForceOpen}
                    onClose={() => openWhenPicker(null)}
                  />

                  {/* Deadline picker */}
                  <DeadlineButton
                    value={localDeadline}
                    onChange={handleDeadlineChange}
                    forceOpen={deadlinePickerForceOpen}
                    onClose={() => openDeadlinePicker(null)}
                  />

                  {/* Project dropdown */}
                  <ProjectSelector
                    value={projects[0] || ''}
                    onChange={handleProjectChange}
                    className="px-2 py-1 text-[12px] rounded border border-[#E8E8E8] dark:border-[#3A3A3A] bg-white dark:bg-[#333] text-[#1A1A1A] dark:text-[#E0E0E0] focus:outline-none cursor-pointer max-w-[150px]"
                  />

                  {/* Priority buttons */}
                  <PrioritySelector value={localPriority} onChange={handlePriorityChange} />

                  {/* Duration picker */}
                  <DurationPicker
                    value={task.durationMinutes}
                    onChange={async (dur) => {
                      await updateTask({ id: task.id, durationMinutes: dur });
                    }}
                  />

                  {/* Subtask button */}
                  {!task.completed && (
                    <SubtaskToolbarButton count={task.checklist.length} onClick={openSubtaskInput} />
                  )}

                </div>

                {/* Right side - editor link */}
                <div className="flex items-center gap-3 shrink-0">
                  {vaultPath && (
                    <button
                      onClick={() => openInEditor(vaultPath, task.filePath, task.lineNumber, isObsidianVault, editorType, editorCustomCommand)}
                      className="flex items-center gap-1 text-[11px] text-primary hover:text-[#3F51B5] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {editorLabel(isObsidianVault, editorType)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
