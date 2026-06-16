import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Task, getWhenType } from '../types/task';
import { useTaskStore } from '../stores/taskStore';
import { usePanelState, usePanelTaskState } from '../hooks/usePanelState';
import { useWikilinkNames } from '../contexts/WikilinkNamesContext';
import { PRIORITY_CONFIG } from '../utils/projectColors';
import { formatWhenDisplay, formatDeadlineCountdown, getDeadlineUrgency, formatDateForDisplay, getToday } from '../utils/dates';
import { InlineMarkdown, WikilinkProps } from './MarkdownNotesRenderer';
import { ExpandedTaskCard } from './ExpandedTaskCard';

interface TaskItemProps {
  task: Task;
  showProject?: boolean;
}

interface CollapsedTaskRowProps {
  task: Task;
  showProject: boolean;
  isSelected: boolean;
  isSoleSelection: boolean;
  isLingering: boolean;
}

/**
 * The collapsed task row. Deliberately lightweight: no editing state, no
 * wikilink-suggest/date-hint hooks, no effects beyond keeping the selected row
 * in view. The heavy editing machinery lives in ExpandedTaskCard, which mounts
 * only when the row is expanded.
 */
function CollapsedTaskRow({ task, showProject, isSelected, isSoleSelection, isLingering }: CollapsedTaskRowProps) {
  const { toggleTaskSelection, expandTask, setSelectedPerson, setSelectedProject, setSelectedTag, currentView } = usePanelState();
  const { personNames, projectNames } = useWikilinkNames();
  const { toggleTaskComplete, updateTask, availableProjects, projectColors, tagColors, isObsidianVault } = useTaskStore(useShallow((s) => ({
    toggleTaskComplete: s.toggleTaskComplete,
    updateTask: s.updateTask,
    availableProjects: s.availableProjects,
    projectColors: s.projectColors,
    tagColors: s.tagColors,
    isObsidianVault: s.isObsidianVault,
  })));

  const whenType = getWhenType(task.when);
  const rowRef = useRef<HTMLDivElement>(null);

  // Same wikilink/link context the expanded renderers use, so titles render
  // markdown identically. The name Sets come from context (built once per list).
  const titleWikilinkProps: WikilinkProps = useMemo(() => ({
    personNames,
    projectNames,
    onPersonClick: setSelectedPerson,
    onProjectClick: setSelectedProject,
    onRemoveLink: (raw) => {
      const newTitle = task.title.replace(raw, '').replace(/\s+/g, ' ').trim();
      updateTask({ id: task.id, title: newTitle });
    },
    projectColors,
    availableProjects,
    isObsidianVault,
  }), [personNames, projectNames, setSelectedPerson, setSelectedProject, projectColors, availableProjects, isObsidianVault, task.id, task.title, updateTask]);

  // Check if task is overdue (deadline past takes priority, then when date)
  const isOverdue = useMemo(() => {
    if (task.completed) return false;
    const today = getToday();
    if (task.deadline) {
      const deadlineDate = new Date(task.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      if (deadlineDate.getTime() < today.getTime()) return true;
    }
    if (whenType === 'date' && typeof task.when === 'object' && 'date' in task.when) {
      const taskDate = new Date(task.when.date);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate.getTime() < today.getTime();
    }
    return false;
  }, [task.completed, task.when, task.deadline, whenType]);

  // Keep the selected row visible during keyboard navigation (↑/↓, ctrl+j/k).
  // block:'nearest' makes this a no-op for click-selection (already in view).
  useLayoutEffect(() => {
    if (isSoleSelection && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSoleSelection]);

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
      <span className="text-[11px] font-bold" style={{ color: config.color }} title={`Priority ${task.priority}`}>
        {config.label}
      </span>
    );
  };

  const cardClasses = isSelected
    ? 'bg-[#D6E4FA] dark:bg-[#1E3A5F] ml-[36px] mr-4 rounded-lg px-4 py-1.5'
    : isOverdue
      ? 'ml-[36px] mr-4 px-4 py-1.5 hover:bg-[#F5F5F5] dark:hover:bg-[#252525] rounded-lg'
      : 'ml-[36px] mr-4 px-4 py-1.5 hover:bg-[#F5F5F5] dark:hover:bg-[#252525] rounded-lg';

  return (
    <div
      ref={rowRef}
      className={`task-row-cv group cursor-pointer transition-all ${cardClasses}${isLingering ? ' task-completing' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex items-start gap-3">
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

        {/* When pill */}
        {getWhenPill()}

        {/* Duration indicator */}
        {!task.completed && task.durationMinutes && !task.scheduledTime && (
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {!task.completed && getPriorityIndicator()}
            <InlineMarkdown
              text={task.title}
              wikilinkProps={titleWikilinkProps}
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

        {/* Right side indicators */}
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
      </div>
    </div>
  );
}

/**
 * Per-row wrapper: reads this row's selection/expansion state and drives the
 * collapse animation, then renders either the lightweight collapsed row or the
 * (conditionally mounted) ExpandedTaskCard.
 */
export const TaskItem = memo(function TaskItem({ task, showProject = true }: TaskItemProps) {
  const { isSelected, isSoleSelection, isExpanded } = usePanelTaskState(task.id);
  const isLingeringCompleted = useTaskStore((s) => task.completed && s.completingTaskIds.includes(task.id));

  // Track collapse animation so the expanded card stays mounted while it closes.
  const [isCollapsing, setIsCollapsing] = useState(false);
  const prevExpandedRef = useRef(isExpanded);
  useLayoutEffect(() => {
    if (prevExpandedRef.current && !isExpanded) {
      setIsCollapsing(true);
    }
    prevExpandedRef.current = isExpanded;
  }, [isExpanded]);
  useEffect(() => {
    if (isCollapsing) {
      const timer = setTimeout(() => setIsCollapsing(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isCollapsing]);

  const showExpandedContent = (isExpanded || isCollapsing) && !task.completed;

  if (showExpandedContent) {
    return <ExpandedTaskCard task={task} isCollapsing={isCollapsing} isSoleSelection={isSoleSelection} />;
  }

  return (
    <CollapsedTaskRow
      task={task}
      showProject={showProject}
      isSelected={isSelected}
      isSoleSelection={isSoleSelection}
      isLingering={isLingeringCompleted}
    />
  );
});
