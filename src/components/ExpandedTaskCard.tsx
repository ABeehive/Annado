import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Task, getWhenType, WhenValue } from '../types/task';
import { useTaskStore } from '../stores/taskStore';
import { usePanelState } from '../hooks/usePanelState';
import { useConfirmableDelete } from '../hooks/useConfirmableDelete';
import { useWikilinkNames } from '../contexts/WikilinkNamesContext';
import { PRIORITY_CONFIG } from '../utils/projectColors';
import { formatWhenDisplay, formatDeadlineCountdown, getDeadlineUrgency, formatDateForDisplay } from '../utils/dates';
import { openInEditor, editorLabel } from '../utils/openInEditor';
import { useSubtaskAdder, SubtaskInputRow, SubtaskToolbarButton } from './SubtaskAdder';
import { WhenButton } from './WhenDatePicker';
import { DeadlineButton } from './DeadlinePicker';
import { ProjectSelector } from './ProjectSelector';
import { PrioritySelector } from './PrioritySelector';
import { DurationPicker } from './DurationPicker';
import { ChecklistItemRow } from './ChecklistItemRow';
import { MarkdownNotesRenderer, InlineMarkdown } from './MarkdownNotesRenderer';
import { TagEditor } from './TagEditor';
import { WikilinkSuggestions } from './WikilinkSuggestions';
import { useWikilinkSuggest, applyWikilink, buildWikilinkKeyHandler } from '../hooks/useWikilinkSuggest';
import { useWikilinkProps } from '../hooks/useWikilinkProps';
import { useFocusWhen } from '../hooks/useFocus';
import { detectDateHint } from '../utils/detectDateHints';
import { DateHintBanner } from './DateHintBanner';

interface ExpandedTaskCardProps {
  task: Task;
  /** True while the card is animating closed (kept mounted by TaskItem for ~200ms). */
  isCollapsing: boolean;
  /** True when this is the only selected row — keep it in view during keyboard nav. */
  isSoleSelection: boolean;
}

/**
 * The full expanded/editing card for a task. Mounted only while a row is
 * expanded (one at a time), so all the editing machinery — title/notes state,
 * wikilink suggestions, date-hint detection, subtask adder, pickers, save and
 * click-outside handling — lives here and never runs for collapsed rows.
 */
export function ExpandedTaskCard({ task, isCollapsing, isSoleSelection }: ExpandedTaskCardProps) {
  const { expandTask, setSelectedPerson, setSelectedProject, setSelectedTag } = usePanelState();
  const { personNames, projectNames } = useWikilinkNames();
  const {
    toggleTaskComplete, updateTask, availableProjects, vaultPath, projectColors, tagColors,
    openWhenPicker, openDeadlinePicker, isObsidianVault, editorType, editorCustomCommand,
  } = useTaskStore(useShallow((s) => ({
    toggleTaskComplete: s.toggleTaskComplete,
    updateTask: s.updateTask,
    availableProjects: s.availableProjects,
    vaultPath: s.vaultPath,
    projectColors: s.projectColors,
    tagColors: s.tagColors,
    openWhenPicker: s.openWhenPicker,
    openDeadlinePicker: s.openDeadlinePicker,
    isObsidianVault: s.isObsidianVault,
    editorType: s.editorType,
    editorCustomCommand: s.editorCustomCommand,
  })));
  const whenPickerForceOpen = useTaskStore((s) => s.taskIdWithOpenWhenPicker === task.id);
  const deadlinePickerForceOpen = useTaskStore((s) => s.taskIdWithOpenDeadlinePicker === task.id);
  const { requestDelete, confirmModal } = useConfirmableDelete(task);

  const whenType = getWhenType(task.when);
  const expandedRef = useRef<HTMLDivElement>(null);

  // Animate the detail open on mount: render at 0fr first, then flip to 1fr on
  // the next frame so the grid-rows transition fires (see App.css).
  const [detailOpen, setDetailOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDetailOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // When a date shortcut (Cmd+S / Cmd+D) targets this task, scroll the card to the
  // top so the picker that's about to open is fully in view.
  const isPickerTarget = whenPickerForceOpen || deadlinePickerForceOpen;
  useLayoutEffect(() => {
    if (isPickerTarget && expandedRef.current) {
      expandedRef.current.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  }, [isPickerTarget]);

  // Keep the selected card visible during keyboard navigation (↑/↓, ctrl+j/k).
  useLayoutEffect(() => {
    if (isSoleSelection && expandedRef.current) {
      expandedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSoleSelection]);

  // Local editing state
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [localPriority, setLocalPriority] = useState<number | null>(task.priority);
  const [localDeadline, setLocalDeadline] = useState<string | null>(task.deadline ?? null);
  const [projects, setProjects] = useState(task.projects);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  useFocusWhen(titleInputRef, isEditingTitle);
  const wikilinkProps = useWikilinkProps({ onPersonClick: setSelectedPerson, onProjectClick: setSelectedProject });
  const [titleCursor, setTitleCursor] = useState(0);
  const [notesCursor, setNotesCursor] = useState(0);
  const [titleWikiHighlight, setTitleWikiHighlight] = useState(-1);
  const [notesWikiHighlight, setNotesWikiHighlight] = useState(-1);
  const titleWiki = useWikilinkSuggest(title, titleCursor);
  const notesWiki = useWikilinkSuggest(notes, notesCursor);
  const hint = useMemo(() => detectDateHint(title), [title]);
  const [dismissedPhrase, setDismissedPhrase] = useState<string | null>(null);
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

  // Re-sync local state if the task changes while the card is open
  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes);
    setLocalPriority(task.priority);
    setLocalDeadline(task.deadline ?? null);
    setProjects(task.projects);
    setIsEditingNotes(false);
    setIsEditingTitle(false);
    resetSubtaskAdder();
  }, [task.id, task.title, task.notes, task.when, task.priority, task.deadline, task.projects, resetSubtaskAdder]);

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

  // Click outside the card collapses it (saving first)
  useEffect(() => {
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandTask, task.id, task.title, task.notes, updateTask]);

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

  // Collapse the card (saves pending changes first)
  const handleCollapse = async () => {
    await savePendingChanges();
    expandTask(null);
  };

  const handleExpandedKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleCollapse();
    }
  };

  const getPriorityIndicator = () => {
    if (!task.priority) return null;
    const config = PRIORITY_CONFIG[task.priority];
    if (!config) return null;
    return (
      <span className="text-[11px] font-bold" style={{ color: config.color }} title={`Priority ${task.priority}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div
      ref={expandedRef}
      className="scroll-mt-2 ml-[36px] mr-4 my-1 overflow-x-clip bg-white dark:bg-[#2A2A2A] rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.08),0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_8px_rgba(0,0,0,0.3),0_4px_24px_rgba(0,0,0,0.25)] border border-[#E8E8E8] dark:border-[#3A3A3A]"
    >
      {/* Card header — title input */}
      <div
        className="flex items-start gap-3 px-5 py-4 cursor-pointer"
        onDoubleClick={handleCollapse}
      >
        {/* Checkbox */}
        <button
          onClick={handleCheckboxClick}
          className={`mt-[3px] w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all flex-shrink-0 ${
            task.completed
              ? 'bg-primary border-primary'
              : 'border-black/20 dark:border-white/25 hover:border-primary dark:hover:border-primary'
          }`}
        >
          {task.completed && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Title input */}
        <div className="flex-1 min-w-0 flex items-center gap-2 relative">
          {getPriorityIndicator()}
          <div className="relative flex-1">
            {isEditingTitle ? (
              <>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setTitleCursor(e.target.selectionStart ?? 0); setTitleWikiHighlight(-1); }}
                  onClick={(e) => { e.stopPropagation(); setTitleCursor((e.target as HTMLInputElement).selectionStart ?? 0); }}
                  onKeyUp={(e) => setTitleCursor((e.target as HTMLInputElement).selectionStart ?? 0)}
                  onBlur={() => { handleTitleBlur(); setIsEditingTitle(false); setTitleWikiHighlight(-1); }}
                  onKeyDown={buildWikilinkKeyHandler(titleWiki.suggestions, titleWikiHighlight, title, titleCursor, titleInputRef, setTitleWikiHighlight, setTitle, setTitleCursor, handleExpandedKeyDown)}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="task-input w-full text-[15px] font-normal bg-transparent text-[#1A1A1A] dark:text-[#E8E8E8] focus:outline-none"
                  placeholder="Task title"
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
              </>
            ) : (
              <div
                className="cursor-text min-h-[24px]"
                onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                {title ? (
                  <InlineMarkdown
                    text={title}
                    wikilinkProps={wikilinkProps}
                    className="text-[15px] font-normal text-[#1A1A1A] dark:text-[#E8E8E8]"
                  />
                ) : (
                  <span className="text-[15px] text-[#A0A0A0] dark:text-[#666]">Task title</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable detail section — animates height via CSS grid */}
      <div className="task-expand-detail" data-expanded={detailOpen && !isCollapsing}>
        <div>
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

              {/* Right side - delete + editor link */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Destructive delete action (undoable via ⌘Z) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    requestDelete();
                  }}
                  className="flex items-center gap-1 text-[11px] text-danger hover:text-danger-dark transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                  Delete
                </button>
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
        </div>
      </div>
      {confirmModal}
    </div>
  );
}
