import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { AgendaBlock } from './types';
import { useTaskStore } from '../../stores/taskStore';
import { useAgendaNames } from './useAgendaNames';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import { useDraggable } from '@dnd-kit/core';
import { DAY_START, DAY_END, PIXELS_PER_MINUTE, BLOCK_GAP_PX } from './constants';
import { formatTime, formatDuration } from './utils';
import { WikilinkRenderer } from '../../components/WikilinkRenderer';
import { ContextMenu, type ContextMenuItem } from '../../components/ContextMenu';
import { buildOpenMenuItems } from '../../utils/openMenuItems';
import type { PathOpenerInfo } from '../../utils/pathOpener';
import { getMeetingUrl } from './meetingUrl';

const MIN_BLOCK_HEIGHT = 26;
const MIN_DURATION = 15;

function BlockContextMenu({ block, clickX, clickY, isTask, isPinned, isEvent, hasBlockingOverride, openers, onRemoveTime, onComplete, onToggleBlocking, onResetBlocking, onCreateTask, onEditEvent, onDelete, onClose }: {
  block: AgendaBlock;
  clickX: number;
  clickY: number;
  isTask: boolean;
  isPinned: boolean;
  isEvent: boolean;
  hasBlockingOverride: boolean;
  openers: PathOpenerInfo[];
  onRemoveTime: () => void;
  onComplete: () => void;
  onToggleBlocking: () => void;
  onResetBlocking: () => void;
  onCreateTask: () => void;
  onEditEvent: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isEvent) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 't') { e.preventDefault(); onCreateTask(); }
      else if (e.metaKey && e.key === 'b') { e.preventDefault(); onToggleBlocking(); }
      else if (e.metaKey && e.key === 'e') { e.preventDefault(); onEditEvent(); }
      else if (e.key === 'Backspace') { e.preventDefault(); onDelete(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEvent, onCreateTask, onToggleBlocking, onEditEvent, onDelete]);

  // Header info
  const title = block.event?.title || block.task?.title || block.title;
  const subtitle = isEvent
    ? `${formatTime(block.startMinutes)} – ${formatTime(block.endMinutes)} · ${block.event?.calendarName || ''}`
    : `${formatTime(block.startMinutes)} · ${formatDuration(block.endMinutes - block.startMinutes)}`;

  const items: ContextMenuItem[] = [];
  if (isTask) {
    if (block.task?.filePath) {
      items.push(...buildOpenMenuItems(block.task.filePath, openers), { separator: true });
    }
    if (isPinned) items.push({ label: 'Remove time', dot: '#999', onClick: onRemoveTime });
    items.push({ label: block.task?.completed ? 'Mark incomplete' : 'Complete task', dot: '#999', onClick: onComplete });
  }
  if (isEvent) {
    items.push({ label: 'Create task', dot: '#5C6BC0', shortcut: '⌘T', onClick: onCreateTask });
    items.push({ label: block.isBlocking ? 'Mark non-blocking' : 'Mark blocking', dot: '#999', shortcut: '⌘B', onClick: onToggleBlocking });
    if (hasBlockingOverride) items.push({ label: 'Reset to calendar default', dot: '#999', onClick: onResetBlocking });
    items.push({ separator: true });
    items.push({ label: 'Edit event', dot: '#999', shortcut: '⌘E', onClick: onEditEvent });
    items.push({ label: 'Delete', dot: '#E53935', shortcut: 'Del', destructive: true, onClick: onDelete });
  }

  return <ContextMenu x={clickX} y={clickY} header={title} subheader={subtitle} items={items} onClose={onClose} />;
}

interface TimeBlockProps {
  block: AgendaBlock;
  columnOffset?: number;
  columnWidth?: string;
  overlapIndex?: number;
  overlapTotal?: number;
  maxEndMinutes?: number;
  onBlockClick?: (block: AgendaBlock) => void;
}

export function TimeBlock({ block, columnOffset = 0, columnWidth = '100%', overlapIndex = 0, overlapTotal = 1, maxEndMinutes, onBlockClick }: TimeBlockProps) {
  const {
    toggleTaskComplete, updateTask,
    availableProjects, projectColors,
    navigateToPerson, navigateToProject,
    setEventBlockingOverride, clearEventBlockingOverride, eventBlockingOverrides,
    pathOpeners,
  } = useTaskStore();
  const { personNames, projectNames } = useAgendaNames();
  const [showMenu, setShowMenu] = useState<{ x: number; y: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingDuration, setResizingDuration] = useState<number | null>(null);
  const resizeStartRef = useRef<{ startY: number; startDuration: number } | null>(null);

  const isDraggableTask = block.type === 'task-pinned' || block.type === 'task-auto';
  const isTask = isDraggableTask;

  const baseDuration = block.endMinutes - block.startMinutes;
  const effectiveDuration = isResizing && resizingDuration !== null ? resizingDuration : baseDuration;
  const top = Math.max(0, (block.startMinutes - DAY_START) * PIXELS_PER_MINUTE);
  const rawHeight = effectiveDuration * PIXELS_PER_MINUTE;
  const height = Math.max(MIN_BLOCK_HEIGHT, rawHeight - BLOCK_GAP_PX);
  const duration = effectiveDuration;

  // Resize handlers using native pointer events
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isTask || !block.task) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    resizeStartRef.current = {
      startY: e.clientY,
      startDuration: baseDuration,
    };
    setIsResizing(true);
    setResizingDuration(baseDuration);
  }, [isTask, block.task, baseDuration]);

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!resizeStartRef.current || !isResizing) return;
    e.stopPropagation();

    const deltaY = e.clientY - resizeStartRef.current.startY;
    const deltaMinutes = deltaY / PIXELS_PER_MINUTE;
    const rawDuration = resizeStartRef.current.startDuration + deltaMinutes;

    // Snap to 15-min increments
    const snapped = Math.round(rawDuration / 15) * 15;

    // Clamp: min 15 min, max until next block or DAY_END
    const maxEnd = maxEndMinutes ?? DAY_END;
    const maxDuration = maxEnd - block.startMinutes;
    const clamped = Math.max(MIN_DURATION, Math.min(snapped, maxDuration));

    setResizingDuration(clamped);
  }, [isResizing, block.startMinutes, maxEndMinutes]);

  const handleResizePointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!resizeStartRef.current || !block.task) return;
    e.stopPropagation();
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    const newDuration = resizingDuration;
    resizeStartRef.current = null;
    setIsResizing(false);
    setResizingDuration(null);

    if (newDuration && newDuration !== baseDuration) {
      await updateTask({ id: block.task.id, durationMinutes: newDuration });
    }
  }, [block.task, resizingDuration, baseDuration, updateTask]);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: isDraggableTask && block.task ? `agenda-${block.task.id}` : `nondrag-${block.id}`,
    data: { task: block.task },
    disabled: !isDraggableTask,
  });

  const isEvent = block.type === 'event';
  const isAuto = block.type === 'task-auto';
  const isPinned = block.type === 'task-pinned';
  const isSchedule = block.type === 'schedule';
  const isNonBlocking = isEvent && !block.isBlocking;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRemoveTime = async () => {
    if (block.task) {
      await updateTask({ id: block.task.id, scheduledTime: '' });
    }
    setShowMenu(null);
  };

  const handleComplete = async () => {
    if (block.task) {
      await toggleTaskComplete(block.task.id);
    }
    setShowMenu(null);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (block.task) {
      toggleTaskComplete(block.task.id);
    }
  };

  const handleToggleBlocking = () => {
    if (block.event) {
      setEventBlockingOverride(block.event.id, !block.isBlocking);
    }
    setShowMenu(null);
  };

  const handleResetBlocking = () => {
    if (block.event) {
      clearEventBlockingOverride(block.event.id);
    }
    setShowMenu(null);
  };

  const hasBlockingOverride = block.event ? block.event.id in eventBlockingOverrides : false;

  const meetingUrl = useMemo(
    () => (block.event ? getMeetingUrl(block.event) : null),
    [block.event]
  );

  const handleCreateTask = () => {
    if (block.event) {
      useTaskStore.getState().openQuickAdd({
        title: block.event.title,
        notes: block.event.notes || undefined,
        deadline: block.event.startDate.slice(0, 10),
      });
    }
    setShowMenu(null);
  };

  const handleEditEvent = async () => {
    if (block.event) {
      await invoke('open_calendar_at_date', { date: block.event.startDate });
    }
    setShowMenu(null);
  };

  const handleDeleteEvent = async () => {
    if (block.event) {
      try {
        await invoke('delete_calendar_event', { eventId: block.event.id });
        useTaskStore.getState().fetchCalendarEvents();
      } catch (e) {
        console.error('Failed to delete event:', e);
      }
    }
    setShowMenu(null);
  };

  const handlePersonClick = (name: string) => {
    navigateToPerson(name);
  };

  const handleProjectClick = (name: string) => {
    navigateToProject(name);
  };

  // Schedule blocks: filled background block with grey tones
  if (isSchedule) {
    return (
      <div
        className="absolute left-0 right-0 select-none pointer-events-none"
        style={{
          top,
          height,
          backgroundColor: 'rgba(0, 0, 0, 0.025)',
          zIndex: 1,
        }}
      >
        {block.title && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider pl-2 pt-1.5 block"
            style={{ color: 'rgba(0, 0, 0, 0.15)' }}
          >
            {block.title}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        ref={setNodeRef}
        {...(isDraggableTask ? { ...attributes, ...listeners } : {})}
        className={`agenda-block absolute rounded-lg px-2.5 py-1.5 overflow-hidden cursor-pointer select-none
          ${isDragging ? 'opacity-50 no-transition' : ''}
          ${isResizing ? 'no-transition' : ''}
          ${isNonBlocking ? 'opacity-50' : ''}
          ${isTask ? 'bg-white/[0.97] dark:bg-[rgba(44,44,48,0.97)] shadow-sm' : ''}
        `}
        style={{
          top,
          height,
          left: overlapTotal > 1
            ? `${(overlapIndex / overlapTotal) * 100}%`
            : (columnOffset > 0 ? `calc(${columnOffset} * ${columnWidth})` : 0),
          width: overlapTotal > 1
            ? `calc(${(1 / overlapTotal) * 100}% - 3px)`
            : columnWidth,
          ...(isEvent && { backgroundColor: `${block.color}14` }),
          borderLeft: `3px solid ${block.color}${isAuto ? '70' : ''}`,
          zIndex: isEvent ? 10 : 20,
        }}
        onClick={() => onBlockClick?.(block)}
        onContextMenu={handleContextMenu}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isTask && (
            <TaskCheckbox
              completed={!!block.task?.completed}
              onClick={handleCheckboxClick}
              size="sm"
              color={block.color}
            />
          )}
          {isTask ? (
            <WikilinkRenderer
              title={block.title}
              personNames={personNames}
              projectNames={projectNames}
              onPersonClick={handlePersonClick}
              onProjectClick={handleProjectClick}
              projectColors={projectColors}
              availableProjects={availableProjects}
              className="text-[12px] leading-tight font-medium truncate text-[#2A2A2A] dark:text-[#E0E0E0]"
            />
          ) : (
            <span
              className="text-[12px] leading-tight font-semibold truncate"
              style={{ color: `${block.color}CC` }}
            >
              {block.title}
            </span>
          )}
          {isEvent && meetingUrl && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); openUrl(meetingUrl); }}
              className="flex-shrink-0 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title="Join meeting"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={`${block.color}AA`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </button>
          )}
          {isPinned && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); handleRemoveTime(); }}
              className="flex-shrink-0 text-[#BBB] hover:text-[#888] dark:text-[#666] dark:hover:text-[#AAA] transition-colors"
              title="Unpin (remove scheduled time)"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
              </svg>
            </button>
          )}
        </div>
        {height >= 30 && (
          <div
            className="text-[10px] mt-0.5"
            style={{ color: isTask ? '#AAA' : `${block.color}88` }}
          >
            {isEvent
              ? `${formatTime(block.startMinutes)} – ${formatTime(block.endMinutes)}`
              : `${formatTime(block.startMinutes)} · ${formatDuration(duration)}`}
          </div>
        )}
        {block.event?.location && height >= 50 && (
          <div className="text-[10px] truncate mt-0.5" style={{ color: `${block.color}66` }}>
            {block.event.location}
          </div>
        )}
        {block.task?.priority && height >= 44 && (
          <div className="text-[10px] font-semibold mt-0.5" style={{ color: `${block.color}AA` }}>
            {block.task.priority === 1 ? '!!!' : block.task.priority === 2 ? '!!' : '!'}
          </div>
        )}
        {/* Resize handle for task blocks */}
        {isTask && (
          <div
            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onClick={(e) => e.stopPropagation()}
            style={{ touchAction: 'none' }}
          />
        )}
      </div>

      {/* Context menu */}
      {showMenu && (
        <BlockContextMenu
          block={block}
          clickX={showMenu.x}
          clickY={showMenu.y}
          isTask={isTask}
          isPinned={isPinned}
          isEvent={isEvent}
          hasBlockingOverride={hasBlockingOverride}
          openers={pathOpeners}
          onRemoveTime={handleRemoveTime}
          onComplete={handleComplete}
          onToggleBlocking={handleToggleBlocking}
          onResetBlocking={handleResetBlocking}
          onCreateTask={handleCreateTask}
          onEditEvent={handleEditEvent}
          onDelete={handleDeleteEvent}
          onClose={() => setShowMenu(null)}
        />
      )}
    </>
  );
}
