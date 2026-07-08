import { useState, useEffect, useRef, useLayoutEffect, useCallback, ReactNode, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { SortableList, SortableItem } from './Sortable';
import { useTaskStore } from '../stores/taskStore';
import { getTaskDate, limitGroupedTasks, groupTasksByCompletionDate, groupTasksByProject, buildGroupedRows, type TaskRow } from '../utils/taskGrouping';
import { usePanelState, usePanelTaskState } from '../hooks/usePanelState';
import { WikilinkNamesProvider } from '../contexts/WikilinkNamesContext';
import { usePanelId } from '../contexts/PanelContext';
import { TaskItem } from './TaskItem';
import { BulkActions } from './BulkActions';
import { ViewType, Task, ProjectMetadata, PersonMetadata, CalendarEvent, Milestone } from '../types/task';
import { getProjectColor, getTagColor } from '../utils/projectColors';
import { OpenFileButton } from './OpenFileButton';
import { viewIcons, PersonIcon, TagIcon } from '../utils/viewIcons';
import { splitTagPath } from '../utils/tags';
import { formatDateForDisplay, getDateGroup, formatDeadlineShort, getDeadlineUrgency, DEADLINE_URGENCY_COLORS, formatDeadlineCountdown, parseLocalDate, getToday, getDaySections, DaySection, formatDateForStorage } from '../utils/dates';
import { InlineMarkdown } from './MarkdownNotesRenderer';
import { useWikilinkProps } from '../hooks/useWikilinkProps';

const viewConfig: Record<ViewType, { title: string; color: string }> = {
  inbox: { title: 'Inbox', color: '#1E88E5' },
  today: { title: 'Today', color: '#F5C000' },
  upcoming: { title: 'Upcoming', color: '#E53935' },
  anytime: { title: 'Anytime', color: '#43A047' },
  someday: { title: 'Someday', color: '#8E6AC8' },
  logbook: { title: 'Logbook', color: '#78909C' },
  recurring: { title: 'Recurring', color: '#43A047' },
  wrapped: { title: 'Wrapped', color: '#5A9BDB' },
  agenda: { title: 'Agenda', color: '#00ACC1' },
  'added-today': { title: 'Added Today', color: '#FF7043' },
  'smart-list': { title: 'Smart List', color: '#5C6BC0' },
  review: { title: 'Weekly Review', color: '#5C6BC0' },
};

// Project header component
function ProjectHeader({ name, color = '#5C6BC0', path }: { name: string; color?: string; path?: string }) {
  return (
    <div className="group flex items-center gap-3 pl-[52px] pr-8 pt-8 pb-3">
      <svg className="w-4 h-4" style={{ color }} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="6" />
      </svg>
      <span className="text-[14px] font-semibold text-[#1A1A1A] dark:text-[#E0E0E0]">
        {name}
      </span>
      {path && <OpenFileButton path={path} />}
      <div className="flex-1 h-px bg-[#E8E8E8] dark:bg-[#3A3A3A] ml-2" />
    </div>
  );
}

// Evening section header for Today view
function EveningHeader() {
  return (
    <div className="flex items-center gap-2 pl-[52px] pr-8 mt-5 mb-1">
      <svg className="w-3.5 h-3.5 text-[#888] dark:text-[#666] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
      </svg>
      <span className="text-[12px] font-semibold text-[#888] dark:text-[#666] uppercase tracking-wide">
        Evening
      </span>
      <div className="flex-1 h-px bg-[#E8E8E8] dark:bg-[#333]" />
    </div>
  );
}

// Date section header component for Upcoming view
function DateSectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pl-[52px] pr-8 pt-6 pb-2">
      <span className="text-[12px] font-semibold text-[#888] dark:text-[#777] uppercase tracking-wide">
        {label}
      </span>
      <div className="flex-1 h-px bg-[#E8E8E8] dark:bg-[#3A3A3A]" />
    </div>
  );
}

// Day section header for the Upcoming view
// Line starts where day name begins, extends right. Number sticks up above the line.
function DaySectionHeader({ section }: { section: DaySection }) {
  return (
    <div className="flex items-baseline gap-2.5 pl-[36px] pr-8 mt-5 pb-[2px]">
      <span className="text-[22px] font-bold text-[#1A1A1A] dark:text-[#E8E8E8] leading-none tabular-nums">
        {section.dayNumber}
      </span>
      <div className="flex-1 border-t border-[#D8D8D8] dark:border-[#333] mt-[3px] pt-[1px]">
        <span className="text-[14px] font-bold text-[#888] dark:text-[#777]">
          {section.dayName}
        </span>
      </div>
    </div>
  );
}

// Month label shown when month changes
function MonthLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pl-[52px] pr-8 pt-8 pb-1">
      <span className="text-[11px] font-bold text-[#9b9eb0] dark:text-[#666] uppercase tracking-[0.08em]">
        {label}
      </span>
      <div className="flex-1 h-px bg-[#E8E8E8] dark:bg-[#3A3A3A]" />
    </div>
  );
}

// Calendar event row component — compact, muted, secondary to tasks
function CalendarEventRow({ event }: { event: CalendarEvent }) {
  if (event.isAllDay) {
    return (
      <div className="flex items-center gap-1.5 ml-[52px] mr-4 py-[1px] leading-tight">
        <span
          className="w-[3px] h-[13px] rounded-full flex-shrink-0"
          style={{ background: event.calendarColor }}
        />
        <span className="text-[12.5px] text-[#6b6e82] dark:text-[#888] truncate">
          {event.title}
        </span>
      </div>
    );
  }

  const startTime = new Date(event.startDate);
  const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="flex items-center gap-1.5 ml-[52px] mr-4 py-[1px] leading-tight">
      <span
        className="text-[12.5px] font-semibold flex-shrink-0 tabular-nums"
        style={{ color: event.calendarColor }}
      >
        {timeStr}
      </span>
      <span className="text-[12.5px] text-[#6b6e82] dark:text-[#888] truncate">
        {event.title}
      </span>
    </div>
  );
}

// Collapsible calendar events block for a day section
function DayCalendarEvents({ events, dateStr }: { events: CalendarEvent[]; dateStr: string }) {
  const [expanded, setExpanded] = useState(false);
  const MAX_VISIBLE = 6;

  if (events.length === 0) return null;

  const visible = expanded ? events : events.slice(0, MAX_VISIBLE);
  const remaining = events.length - MAX_VISIBLE;

  return (
    <div className="pt-0.5 pb-1">
      {visible.map((event) => (
        <CalendarEventRow key={event.id + dateStr} event={event} />
      ))}
      {!expanded && remaining > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="ml-[52px] text-[12px] text-[#9b9eb0] dark:text-[#666] hover:text-[#6b6e82] dark:hover:text-[#888] py-[1px]"
        >
          {remaining} more
        </button>
      )}
    </div>
  );
}

// Droppable day section wrapper for drag-and-drop
function DroppableDaySection({ dateStr, children }: { dateStr: string; children: ReactNode }) {
  const panelId = usePanelId();
  const { setNodeRef, isOver } = useDroppable({ id: `${panelId}-day-${dateStr}` });
  return (
    <div
      ref={setNodeRef}
      className={`transition-colors duration-150 rounded-lg ${isOver ? 'bg-primary/8 dark:bg-primary/12' : ''}`}
    >
      {children}
    </div>
  );
}

// Droppable view zone wrapper for non-date views (enables cross-panel drag-and-drop)
function DroppableViewZone({ viewType, children }: { viewType: string; children: ReactNode }) {
  const panelId = usePanelId();
  const { setNodeRef, isOver } = useDroppable({ id: `${panelId}-view-${viewType}` });
  return (
    <div ref={setNodeRef} className={`min-h-[200px] transition-colors duration-150 ${isOver ? 'bg-primary/5 dark:bg-primary/8' : ''}`}>
      {children}
    </div>
  );
}

// Draggable task item wrapper
function DraggableTaskItem({ task, showProject }: { task: Task; showProject: boolean }) {
  const panelId = usePanelId();
  const { isExpanded } = usePanelTaskState(task.id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${panelId}-${task.id}`,
    data: { task },
  });

  return (
    <div
      ref={setNodeRef}
      {...(!isExpanded ? listeners : {})}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1, outline: 'none' }}
    >
      <TaskItem task={task} showProject={showProject} />
    </div>
  );
}

// TaskRow (the flattened virtualizer row model) and buildGroupedRows live in
// ../utils/taskGrouping so the grouped-row flattening is pure and unit-testable.

/**
 * Windowed task list: only the rows near the viewport are mounted. Heights are
 * measured dynamically (collapsed rows vs the taller expanded card), and a
 * scroll margin accounts for any content rendered above the list inside the
 * shared scroll container. `footer` (e.g. a "New To-Do" button) renders after.
 */
function VirtualTaskList({
  rows,
  scrollElement,
  footer,
}: {
  rows: TaskRow[];
  // The scroll container, passed as the element (via parent state) rather than a ref: a child's
  // layout effect runs before its parent's ref attaches, so reading an ancestor ref on mount
  // yields null and react-virtual renders zero rows until a later re-render. State is non-null
  // by the time the virtualizer reads it.
  scrollElement: HTMLDivElement | null;
  footer?: ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Offset of the list within the scroll container's content (e.g. the Today
  // calendar block can render above it). Recompute when the row set changes.
  useLayoutEffect(() => {
    const list = listRef.current;
    const scroller = scrollElement;
    if (!list || !scroller) return;
    const offset = list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    setScrollMargin(offset);
  }, [scrollElement, rows.length]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    // Kind-aware first guess so unmeasured rows land close to their real height
    // (project headers are ~68px, tag/2-line tasks taller than a bare 44) — measureElement
    // still corrects to the exact height, but smaller corrections mean less scroll jank.
    estimateSize: (index) => {
      const kind = rows[index].kind;
      return kind === 'projectHeader' ? 68 : kind === 'eveningHeader' ? 44 : 52;
    },
    overscan: 10,
    getItemKey: (index) => rows[index].key,
    scrollMargin,
  });

  // Keyboard navigation selects rows that may be outside the rendered window, so
  // the row can't scroll itself into view. Drive it from the virtualizer instead:
  // when the sole selection changes, scroll that row into view (mounting it).
  const isMain = usePanelId() === 'main';
  const soleSelectedId = useTaskStore((s) => {
    const ids = isMain ? s.selectedTaskIds : s.sidePanelSelectedTaskIds;
    return ids.length === 1 ? ids[0] : null;
  });
  useEffect(() => {
    if (!soleSelectedId) return;
    const index = rows.findIndex((r) => r.kind === 'task' && r.task.id === soleSelectedId);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'auto' });
    // Only react to selection changes, not to every rows/virtualizer identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soleSelectedId]);

  return (
    <div ref={listRef}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const row = rows[vRow.index];
          return (
            <div
              key={vRow.key}
              data-index={vRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vRow.start - scrollMargin}px)`,
              }}
            >
              {row.kind === 'task' ? (
                <DraggableTaskItem task={row.task} showProject={row.showProject} />
              ) : row.kind === 'projectHeader' ? (
                <ProjectHeader name={row.name} color={row.color} path={row.path} />
              ) : (
                <EveningHeader />
              )}
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}

// Helper to get date from task's when field, falling back to deadline
// Unified deadline item for Upcoming view (projects and milestones)
interface DeadlineItem {
  key: string;
  label: string;
  sublabel?: string;
  deadline: string;
  projectName: string;
  parentFolder: string | null;
  type: 'project' | 'milestone';
}

// Inline deadline badge for Upcoming view
function DeadlineBadge({
  item,
  color,
  onClick,
}: {
  item: DeadlineItem;
  color: string;
  onClick: () => void;
}) {
  const urgency = getDeadlineUrgency(item.deadline);
  const urgencyColor = DEADLINE_URGENCY_COLORS[urgency];
  const countdown = formatDeadlineCountdown(item.deadline);
  const shortDate = formatDeadlineShort(item.deadline);

  return (
    <div
      onClick={onClick}
      className="flex items-center cursor-pointer transition-all"
      style={{
        padding: '8px 20px',
        background: `${color}14`,
        borderLeft: `3px solid ${color}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${color}24`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = `${color}14`; }}
    >
      {/* Project dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0 mr-2.5"
        style={{ background: color }}
      />
      {/* Label + sublabel */}
      <div className="flex-1 min-w-0 truncate">
        <span className="text-[12.5px] font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
          {item.label}
        </span>
        {item.sublabel && (
          <span className="text-[11px] text-[#999] dark:text-[#777] ml-1.5">
            {item.sublabel}
          </span>
        )}
      </div>
      {/* Short date */}
      <span className="text-[11.5px] font-medium text-[#6b6e82] dark:text-[#999] mr-3 flex-shrink-0">
        {shortDate}
      </span>
      {/* Flag icon + countdown */}
      <span
        className="flex items-center gap-1 text-[11.5px] font-semibold flex-shrink-0"
        style={{ color: urgencyColor }}
      >
        {item.type === 'milestone' ? (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15 9H22L16.5 13.5L18.5 21L12 16.5L5.5 21L7.5 13.5L2 9H9L12 2Z" />
          </svg>
        ) : (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <rect x="3.5" y="15" width="1" height="7" />
          </svg>
        )}
        {countdown}
      </span>
    </div>
  );
}

// Group of deadline badges with a label
function DeadlineBadgeGroup({
  label,
  items,
  projectColors,
  onProjectClick,
}: {
  label: string;
  items: DeadlineItem[];
  projectColors: Record<string, string>;
  onProjectClick: (name: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <div className="pl-[52px] pr-8 pt-1.5 pb-0.5">
        <span className="text-[10px] font-bold text-[#9b9eb0] dark:text-[#777] tracking-[0.06em] uppercase">
          {label}
        </span>
      </div>
      <div className="mx-[36px] mr-4 my-1 border-t border-b border-[#f0f1f5] dark:border-[#3A3A3A] overflow-hidden rounded-lg">
        {items.map((item, i) => (
          <div key={item.key} className={i < items.length - 1 ? 'border-b border-[#f0f1f5] dark:border-[#3A3A3A]' : ''}>
            <DeadlineBadge
              item={item}
              color={getProjectColor(item.projectName, item.parentFolder, projectColors)}
              onClick={() => onProjectClick(item.projectName)}
            />
          </div>
        ))}
      </div>
    </>
  );
}

// Recurring template item for the Recurring view
function RecurringTaskItem({
  task,
  onClick,
}: {
  task: Task;
  onClick: () => void;
}) {
  const { setSelectedProject, setSelectedPerson } = usePanelState();
  const wikilinkProps = useWikilinkProps({ onPersonClick: setSelectedPerson, onProjectClick: setSelectedProject });

  const rec = task.recurrence;
  const unit = rec ? (rec.interval === 1 ? rec.unit.replace(/s$/, '') : rec.unit) : '';
  const recurrenceLabel = !rec
    ? ''
    : rec.raw
      ? rec.raw
      : rec.mode === 'fixed'
        ? `Every ${rec.interval} ${unit}`
        : `Every ${rec.interval} ${unit} after completion`;

  const nextDate = typeof task.when === 'object' && task.when && 'date' in task.when ? task.when.date : null;
  const formatDate = (dateStr: string | null): string | null => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-4 cursor-pointer ml-[36px] mr-4 px-4 py-3 hover:bg-[#F5F5F5] dark:hover:bg-[#252525] rounded-lg transition-all"
    >
      {/* Recurring icon */}
      <div className="w-5 h-5 rounded-full border-[1.5px] border-success flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-[14px] text-[#1A1A1A] dark:text-[#E8E8E8] font-normal truncate">
          <InlineMarkdown text={task.title} wikilinkProps={wikilinkProps} />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[12px] text-[#888] dark:text-[#777]">
            {recurrenceLabel}
          </span>
          {task.projects.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-[#888] dark:text-[#777]">
              <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="5" />
              </svg>
              {task.projects[0]}
            </span>
          )}
        </div>
      </div>

      {/* Right side info */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {nextDate && (
          <span className="text-[11px] text-[#888] dark:text-[#666]">
            Next: {formatDate(nextDate)}
          </span>
        )}
        <OpenFileButton path={task.filePath} line={task.lineNumber} />
      </div>
    </div>
  );
}

// Editable metadata field component
function EditableField({
  icon,
  iconColor,
  label,
  value,
  placeholder,
  onChange,
}: {
  icon: ReactNode;
  iconColor: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === 'Escape') {
      setLocalValue(value);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 group">
      <span className={iconColor}>{icon}</span>
      {isEditing ? (
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="px-1 py-0.5 text-[13px] bg-white dark:bg-[#2A2A2A] border border-[#E0E0E0] dark:border-[#3A3A3A] rounded focus:outline-none focus:border-primary min-w-[80px]"
          autoFocus
          placeholder={placeholder}
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="text-left hover:text-primary dark:hover:text-primary-light transition-colors"
        >
          {value ? `${label}: ${value}` : <span className="text-[#AAA] dark:text-[#666]">{placeholder}</span>}
        </button>
      )}
    </div>
  );
}

// Editable date field component with date picker
function EditableDateField({
  icon,
  iconColor,
  label,
  value,
  placeholder,
  onChange,
}: {
  icon: ReactNode;
  iconColor: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
    // Don't setIsEditing(false) here — handleBlur handles it
    // when the native date picker closes and focus leaves the input
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setLocalValue(value);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 group">
      <span className={iconColor}>{icon}</span>
      {isEditing ? (
        <input
          type="date"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="px-1 py-0.5 text-[13px] bg-white dark:bg-[#2A2A2A] border border-[#E0E0E0] dark:border-[#3A3A3A] rounded focus:outline-none focus:border-primary"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="text-left hover:text-primary dark:hover:text-primary-light transition-colors"
        >
          {value ? `${label}: ${formatDateForDisplay(value)}` : <span className="text-[#AAA] dark:text-[#666]">{placeholder}</span>}
        </button>
      )}
    </div>
  );
}

// Milestone list for project info panel
function MilestoneList({
  milestones,
  onUpdate,
}: {
  milestones: Milestone[];
  onUpdate: (milestones: Milestone[]) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'start' | 'end' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');

  const startEdit = (index: number, field: 'name' | 'start' | 'end') => {
    setEditingIndex(index);
    setEditingField(field);
    const m = milestones[index];
    setEditValue(field === 'name' ? m.name : (m[field] || ''));
  };

  const commitEdit = () => {
    if (editingIndex === null || editingField === null) return;
    const updated = [...milestones];
    if (editingField === 'name') {
      updated[editingIndex] = { ...updated[editingIndex], name: editValue };
    } else {
      updated[editingIndex] = { ...updated[editingIndex], [editingField]: editValue || null };
    }
    onUpdate(updated);
    setEditingIndex(null);
    setEditingField(null);
  };

  const toggleCompleted = (index: number) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], completed: !updated[index].completed };
    onUpdate(updated);
  };

  const removeMilestone = (index: number) => {
    const updated = milestones.filter((_, i) => i !== index);
    onUpdate(updated);
  };

  const addMilestone = () => {
    if (!newName.trim()) return;
    onUpdate([...milestones, { name: newName.trim(), start: null, end: null, completed: false }]);
    setNewName('');
    setAddingNew(false);
  };

  if (milestones.length === 0 && !addingNew) {
    return (
      <button
        onClick={() => setAddingNew(true)}
        className="text-[12px] text-[#AAA] dark:text-[#666] hover:text-primary dark:hover:text-primary-light transition-colors mt-2"
      >
        + Add milestone
      </button>
    );
  }

  return (
    <div className="mt-3">
      <div className="text-[10px] font-bold text-[#9b9eb0] dark:text-[#777] tracking-[0.06em] uppercase mb-1.5">
        Milestones
      </div>
      <SortableList
        ids={milestones.map((_, i) => String(i))}
        onReorder={(from, to) => onUpdate(arrayMove(milestones, Number(from), Number(to)))}
      >
      <div className="space-y-1">
        {milestones.map((m, i) => {
          const endUrgency = m.end && !m.completed ? getDeadlineUrgency(m.end) : null;
          const endColor = endUrgency ? DEADLINE_URGENCY_COLORS[endUrgency] : undefined;
          return (
            <SortableItem key={i} id={String(i)}>
              {({ handleProps }) => (
            <div className="flex items-center gap-2 group text-[12.5px]">
              {/* Drag handle — only this initiates a drag, so inline editors stay clickable */}
              <button
                {...handleProps}
                className="relative z-20 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-[#CCC] dark:text-[#555] hover:text-[#999] dark:hover:text-[#888] transition-all flex-shrink-0 touch-none"
                aria-label="Drag to reorder milestone"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              {/* Checkbox */}
              <button
                onClick={() => toggleCompleted(i)}
                className="flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors"
                style={{
                  borderColor: m.completed ? '#43A047' : '#ccc',
                  background: m.completed ? '#43A047' : 'transparent',
                }}
              >
                {m.completed && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              {/* Name */}
              {editingIndex === i && editingField === 'name' ? (
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingIndex(null); setEditingField(null); } }}
                  className="flex-1 min-w-0 px-1 py-0.5 text-[12.5px] bg-white dark:bg-[#2A2A2A] border border-[#E0E0E0] dark:border-[#3A3A3A] rounded focus:outline-none focus:border-primary"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => startEdit(i, 'name')}
                  className={`flex-1 min-w-0 truncate text-left transition-colors hover:text-primary dark:hover:text-primary-light ${m.completed ? 'line-through text-[#AAA] dark:text-[#666]' : 'text-[#333] dark:text-[#CCC]'}`}
                >
                  {m.name}
                </button>
              )}
              {/* Start date */}
              {editingIndex === i && editingField === 'start' ? (
                <input
                  type="date"
                  value={editValue}
                  onChange={(e) => { setEditValue(e.target.value); }}
                  onBlur={commitEdit}
                  className="text-[11px] px-1 py-0.5 bg-white dark:bg-[#2A2A2A] border border-[#E0E0E0] dark:border-[#3A3A3A] rounded focus:outline-none focus:border-primary"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => startEdit(i, 'start')}
                  className="text-[11px] text-[#999] dark:text-[#777] hover:text-primary dark:hover:text-primary-light flex-shrink-0"
                >
                  {m.start ? formatDateForDisplay(m.start) : '—'}
                </button>
              )}
              <span className="text-[10px] text-[#CCC] dark:text-[#555]">→</span>
              {/* End date */}
              {editingIndex === i && editingField === 'end' ? (
                <input
                  type="date"
                  value={editValue}
                  onChange={(e) => { setEditValue(e.target.value); }}
                  onBlur={commitEdit}
                  className="text-[11px] px-1 py-0.5 bg-white dark:bg-[#2A2A2A] border border-[#E0E0E0] dark:border-[#3A3A3A] rounded focus:outline-none focus:border-primary"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => startEdit(i, 'end')}
                  className="text-[11px] flex-shrink-0"
                  style={{ color: endColor || undefined }}
                >
                  <span className={endColor ? '' : 'text-[#999] dark:text-[#777] hover:text-primary dark:hover:text-primary-light'}>
                    {m.end ? formatDateForDisplay(m.end) : '—'}
                  </span>
                </button>
              )}
              {/* Remove button */}
              <button
                onClick={() => removeMilestone(i)}
                className="opacity-0 group-hover:opacity-100 text-[#CCC] dark:text-[#555] hover:text-danger transition-all flex-shrink-0"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
              )}
            </SortableItem>
          );
        })}
      </div>
      </SortableList>
      {/* Add milestone */}
      {addingNew ? (
        <div className="flex items-center gap-2 mt-1.5">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addMilestone(); if (e.key === 'Escape') { setAddingNew(false); setNewName(''); } }}
            onBlur={() => { if (newName.trim()) addMilestone(); else { setAddingNew(false); setNewName(''); } }}
            placeholder="Milestone name..."
            className="flex-1 px-1.5 py-0.5 text-[12.5px] bg-white dark:bg-[#2A2A2A] border border-[#E0E0E0] dark:border-[#3A3A3A] rounded focus:outline-none focus:border-primary"
            autoFocus
          />
        </div>
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="text-[12px] text-[#AAA] dark:text-[#666] hover:text-primary dark:hover:text-primary-light transition-colors mt-1.5"
        >
          + Add milestone
        </button>
      )}
    </div>
  );
}

// Helper to check if person metadata has any displayable content
function hasPersonMetadataContent(metadata: PersonMetadata | null): boolean {
  if (!metadata) return false;
  return !!(metadata.organisation || metadata.relationship || metadata.languages.length > 0 || metadata.projects.length > 0);
}

interface TaskListProps {
  onOpenRecurringModal?: (task?: Task) => void;
}

export function TaskList({ onOpenRecurringModal }: TaskListProps) {
  const panelId = usePanelId();
  const {
    currentView,
    selectedProject,
    selectedPerson,
    selectedTag,
    getFilteredTasks,
    setSelectedProject,
    setSelectedTag,
  } = usePanelState();
  const { selectedPersonMetadata, isLoading, vaultPath, availableProjects, availablePeople, projectColors, tagColors, updateProjectMetadata, sidePanelOpen, toggleSidePanel, calendarEnabled, calendarEvents, smartLists, selectedSmartListId } = useTaskStore(useShallow((s) => ({ selectedPersonMetadata: s.selectedPersonMetadata, isLoading: s.isLoading, vaultPath: s.vaultPath, availableProjects: s.availableProjects, availablePeople: s.availablePeople, projectColors: s.projectColors, tagColors: s.tagColors, updateProjectMetadata: s.updateProjectMetadata, sidePanelOpen: s.sidePanelOpen, toggleSidePanel: s.toggleSidePanel, calendarEnabled: s.calendarEnabled, calendarEvents: s.calendarEvents, smartLists: s.smartLists, selectedSmartListId: s.selectedSmartListId })));
  // getFilteredTasks() reads tasks and completion-linger from the store via
  // getState(), which is not a subscription. usePanelState no longer re-renders
  // this component on selection/expansion (those are per-row now), so subscribe
  // explicitly to the inputs and memoize the filter — it re-runs only when an
  // input actually changes, not on every unrelated re-render.
  const allTasks = useTaskStore((s) => s.tasks);
  const completingTaskIds = useTaskStore((s) => s.completingTaskIds);
  // These deps are getFilteredTasks()'s real inputs (it reads them via getState),
  // so they belong in the array even though the lint rule can't see them used.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = useMemo(() => getFilteredTasks(), [
    getFilteredTasks, allTasks, completingTaskIds,
    currentView, selectedProject, selectedPerson, selectedTag,
    smartLists, selectedSmartListId,
  ]);

  // Logbook renders incrementally (large histories); reset when leaving the view
  const LOGBOOK_PAGE_SIZE = 100;
  const [logbookLimit, setLogbookLimit] = useState(LOGBOOK_PAGE_SIZE);
  useEffect(() => {
    setLogbookLimit(LOGBOOK_PAGE_SIZE);
  }, [currentView]);

  // Generate day sections for Upcoming view
  const daySections = useMemo(() => {
    if (currentView !== 'upcoming' || selectedProject || selectedPerson || selectedTag) return [];
    return getDaySections(60);
  }, [currentView, selectedProject, selectedPerson, selectedTag]);

  // Group tasks by day (YYYY-MM-DD)
  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      const dateStr = getTaskDate(task);
      if (!dateStr) continue;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(task);
    }
    return map;
  }, [tasks]);

  // Group calendar events by day (YYYY-MM-DD), including multi-day events on each relevant day
  const eventsByDay = useMemo(() => {
    if (!calendarEnabled) return {};
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of calendarEvents) {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      // For all-day events, end date is exclusive (next day midnight)
      const endForIteration = event.isAllDay ? new Date(end.getTime() - 1) : end;
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(endForIteration.getFullYear(), endForIteration.getMonth(), endForIteration.getDate());

      const current = new Date(startDay);
      while (current <= endDay) {
        const key = formatDateForStorage(current);
        if (!map[key]) map[key] = [];
        map[key].push(event);
        current.setDate(current.getDate() + 1);
      }
    }
    // Sort timed events by start time within each day
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        return a.startDate.localeCompare(b.startDate);
      });
    }
    return map;
  }, [calendarEnabled, calendarEvents]);

  // Get projects and milestones with upcoming deadlines grouped by time period
  const deadlineGroups = useMemo(() => {
    if (currentView !== 'upcoming' || selectedProject || selectedPerson) {
      return { thisWeek: [] as DeadlineItem[], nextWeeks: [] as DeadlineItem[], later: [] as DeadlineItem[] };
    }
    const today = getToday();
    const items: DeadlineItem[] = [];

    // Project deadlines
    for (const p of availableProjects) {
      if (p.metadata.deadline) {
        const deadline = parseLocalDate(p.metadata.deadline);
        if (deadline >= today) {
          items.push({
            key: `project:${p.path}`,
            label: p.name,
            deadline: p.metadata.deadline,
            projectName: p.name,
            parentFolder: p.parentFolder,
            type: 'project',
          });
        }
      }

      // Milestone deadlines
      for (const m of p.metadata.milestones) {
        if (m.end && !m.completed) {
          const endDate = parseLocalDate(m.end);
          if (endDate >= today) {
            items.push({
              key: `milestone:${p.path}:${m.name}`,
              label: m.name,
              sublabel: p.name,
              deadline: m.end,
              projectName: p.name,
              parentFolder: p.parentFolder,
              type: 'milestone',
            });
          }
        }
      }
    }

    items.sort((a, b) => a.deadline.localeCompare(b.deadline));

    const thisWeek: DeadlineItem[] = [];
    const nextWeeks: DeadlineItem[] = [];
    const later: DeadlineItem[] = [];

    for (const item of items) {
      const deadlineDate = parseLocalDate(item.deadline);
      const diffDays = Math.round((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        thisWeek.push(item);
      } else {
        const group = getDateGroup(item.deadline);
        if (group === 'tomorrow' || group === 'this-week') {
          thisWeek.push(item);
        } else if (group === 'next-week') {
          nextWeeks.push(item);
        } else {
          later.push(item);
        }
      }
    }
    return { thisWeek, nextWeeks, later };
  }, [currentView, selectedProject, selectedPerson, availableProjects]);

  // For Today view: separate evening tasks so they render below a divider.
  const dayTasks = useMemo(
    () => (currentView === 'today' ? tasks.filter((t) => t.when !== 'evening') : tasks),
    [tasks, currentView],
  );
  const eveningTasks = useMemo(
    () => (currentView === 'today' ? tasks.filter((t) => t.when === 'evening') : []),
    [tasks, currentView],
  );

  // Group tasks by project for non-project/person/tag views (except logbook and upcoming).
  const groupedTasks = useMemo(
    () =>
      !selectedProject && !selectedPerson && !selectedTag && currentView !== 'logbook' && currentView !== 'upcoming'
        ? groupTasksByProject(dayTasks)
        : null,
    [dayTasks, selectedProject, selectedPerson, selectedTag, currentView],
  );

  const eveningGrouped = useMemo(
    () => (eveningTasks.length > 0 ? groupTasksByProject(eveningTasks) : null),
    [eveningTasks],
  );

  // Group tasks by completion date for Logbook view; render incrementally so a
  // large history doesn't mount thousands of rows at once.
  const logbookGroups = useMemo(
    () =>
      currentView === 'logbook' && !selectedProject && !selectedPerson && !selectedTag
        ? limitGroupedTasks(groupTasksByCompletionDate(tasks), logbookLimit)
        : null,
    [currentView, selectedProject, selectedPerson, selectedTag, tasks, logbookLimit],
  );
  const logbookHasMore = logbookGroups !== null && tasks.length > logbookLimit;

  // Person/project name Sets for wikilink rendering — built once here and shared
  // with every row via context so each row doesn't rebuild its own Sets.
  const wikilinkNames = useMemo(() => ({
    personNames: new Set(availablePeople.map((p) => p.name)),
    projectNames: new Set(availableProjects.map((p) => p.name)),
  }), [availablePeople, availableProjects]);

  // Scroll container for the virtualized list.
  // The scroll container is tracked as state (set from a callback ref) rather than a plain ref, so
  // VirtualTaskList re-renders once the element attaches — otherwise the virtualizer reads a
  // not-yet-attached ancestor ref on first mount and renders zero rows until the next render.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const setScrollNode = useCallback((node: HTMLDivElement | null) => setScrollEl(node), []);

  // Flatten the grouped-by-project view (headers + tasks + evening section) into a
  // single row array for virtualization. Keys are made unique per section by
  // buildGroupedRows so a multi-project task can't collide in react-virtual's cache.
  const groupedRows = useMemo<TaskRow[]>(
    () =>
      buildGroupedRows(groupedTasks, eveningGrouped, (project) => {
        const projectInfo = availableProjects.find((p) => p.name === project);
        return { color: getProjectColor(project, projectInfo?.parentFolder, projectColors), path: projectInfo?.path };
      }),
    [groupedTasks, eveningGrouped, availableProjects, projectColors],
  );

  // Flat task list (project view, person/tag view). showProject mirrors the
  // original branches: hidden inside a project, shown otherwise.
  const flatRows = useMemo<TaskRow[]>(
    () => tasks.map((task) => ({ kind: 'task', key: task.id, task, showProject: !selectedProject })),
    [tasks, selectedProject],
  );

  // Local state for editing metadata
  const [editingDescription, setEditingDescription] = useState(false);
  const [localDescription, setLocalDescription] = useState('');

  // Find the selected project's info
  const selectedProjectInfo = selectedProject
    ? availableProjects.find(p => p.name === selectedProject)
    : null;

  const metadata = selectedProjectInfo?.metadata;

  // The selected person's backing file, for the open-in button in the info pane.
  const personPath = selectedPerson
    ? availablePeople.find((p) => p.name === selectedPerson)?.path ?? null
    : null;

  // Update local description when project changes
  useEffect(() => {
    setLocalDescription(metadata?.description || '');
    setEditingDescription(false);
  }, [selectedProject, metadata?.description]);

  if (!vaultPath) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FEFEFE] dark:bg-[#1A1A1A] text-[#888]">
        <p>Select an Obsidian vault to get started</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FEFEFE] dark:bg-[#1A1A1A] text-[#888]">
        <p>Loading tasks...</p>
      </div>
    );
  }

  const config = viewConfig[currentView];
  const selectedSmartList = currentView === 'smart-list' ? smartLists.find(l => l.id === selectedSmartListId) : undefined;
  const title = currentView === 'smart-list'
    ? (selectedSmartList?.name ?? 'Smart List')
    : (selectedTag ? `#${selectedTag}` : selectedPerson || selectedProject || config.title);

  // Split a nested tag (Obsidian-style parent/child) into breadcrumb + leaf title.
  const tagParts = selectedTag ? splitTagPath(selectedTag) : null;

  const color = selectedTag
    ? getTagColor(selectedTag, tagColors)
    : selectedProjectInfo
      ? getProjectColor(selectedProjectInfo.name, selectedProjectInfo.parentFolder, projectColors)
      : (selectedProject ? '#5C6BC0' : config.color);

  // Save metadata with partial updates
  const saveProjectMetadata = async (updates: Partial<ProjectMetadata>) => {
    if (!selectedProject || !metadata) return;
    try {
      await updateProjectMetadata({
        projectName: selectedProject,
        ...metadata,
        ...updates,
      });
    } catch (error) {
      console.error('Failed to update metadata:', error);
    }
  };

  const handleDescriptionBlur = async () => {
    setEditingDescription(false);
    if (localDescription !== (metadata?.description || '')) {
      await saveProjectMetadata({ description: localDescription || null });
    }
  };

  // Icons for metadata fields
  const calendarIcon = (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );

  const arrowIcon = (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const starIcon = (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );

  const personIcon = <PersonIcon className="w-4 h-4" />;

  return (
    <WikilinkNamesProvider value={wikilinkNames}>
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#FEFEFE] dark:bg-[#1A1A1A] relative">
      {/* Traffic light padding + Header with icon — hidden in side panel (has its own header) */}
      <div className={panelId === 'main' ? 'pl-[52px] pr-8 pt-12 pb-4 titlebar-drag' : 'hidden'}>
        <div className="flex items-center gap-4 mb-5">
          {/* View icon — oversized next to the title */}
          {!selectedProject && !selectedPerson && !selectedTag && (
            currentView === 'smart-list' && selectedSmartList
              ? <span className="w-8 h-8 flex items-center justify-center text-3xl leading-none">{selectedSmartList.icon}</span>
              : viewIcons[currentView]
          )}
          {selectedTag && <TagIcon className="w-8 h-8" stroke={color} circleFill={color} />}
          {selectedPerson && <PersonIcon className="w-8 h-8" stroke="#5C6BC0" />}
          {selectedProject && !selectedPerson && (
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill={color}>
              <circle cx="12" cy="12" r="9" />
            </svg>
          )}
          {selectedTag && tagParts ? (
            // The focused (sub)tag title stays in the exact same position as a
            // parent-less tag title; the parent breadcrumb floats just above it
            // (absolute) so switching never shifts the title — only the crumb appears.
            <div className="relative min-w-0">
              {tagParts.crumbs.length > 0 && (
                <div className="absolute bottom-full left-0 flex items-center gap-1 leading-none whitespace-nowrap text-[12px] font-medium text-[#888] dark:text-[#777]">
                  {tagParts.crumbs.map((crumb) => (
                    <span key={crumb.path} className="flex items-center gap-0.5">
                      <button
                        onClick={() => setSelectedTag(crumb.path)}
                        className="hover:underline"
                      >
                        {crumb.label}
                      </button>
                      <svg className="w-3 h-3 opacity-60 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ))}
                </div>
              )}
              <h2 className="text-[26px] font-medium text-[#1A1A1A] dark:text-[#E8E8E8] truncate">
                {`#${tagParts.leaf}`}
              </h2>
            </div>
          ) : (
            <h2 className="text-[26px] font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">
              {title}
            </h2>
          )}
          {/* Side panel toggle button - only in main panel */}
          {panelId === 'main' && (
            <button
              onClick={toggleSidePanel}
              className={`ml-auto flex-shrink-0 p-1.5 rounded-md transition-colors ${
                sidePanelOpen
                  ? 'text-primary bg-[#E8EAF6] dark:bg-[#2A2D4A]'
                  : 'text-[#999] dark:text-[#666] hover:text-primary hover:bg-[#F0F0F0] dark:hover:bg-[#2A2A2A]'
              }`}
              title={'Toggle side panel (⌘\\)'}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            </button>
          )}
        </div>

        {/* Project metadata - editable fields in rounded box */}
        {selectedProject && (
          <div className="mt-4 mb-6 mx-0 p-4 bg-[#F8F8F8] dark:bg-[#232323] rounded-xl">
            {/* Description as first row with icon */}
            <div className="flex items-start gap-1.5 mb-3">
              <span className="text-[#888] mt-0.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
              </span>
              {editingDescription ? (
                <textarea
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setLocalDescription(metadata?.description || '');
                      setEditingDescription(false);
                    }
                  }}
                  className="flex-1 px-2 py-1 text-[13px] text-[#555] dark:text-[#AAA] bg-white dark:bg-[#2A2A2A] border border-[#E0E0E0] dark:border-[#3A3A3A] rounded focus:outline-none focus:border-primary resize-none"
                  rows={2}
                  autoFocus
                  placeholder="Add project description..."
                />
              ) : (
                <button
                  onClick={() => setEditingDescription(true)}
                  className="text-left flex-1 text-[13px] hover:text-primary dark:hover:text-primary-light transition-colors"
                >
                  {metadata?.description ? (
                    <span className="text-[#555] dark:text-[#AAA]">{metadata.description}</span>
                  ) : (
                    <span className="text-[#AAA] dark:text-[#666]">Click to add description...</span>
                  )}
                </button>
              )}
              {selectedProjectInfo?.path && (
                <OpenFileButton path={selectedProjectInfo.path} showLabel className="ml-auto flex-shrink-0" />
              )}
            </div>

            {/* Metadata fields row */}
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#666] dark:text-[#999]">
              <EditableDateField
                icon={calendarIcon}
                iconColor="text-danger"
                label="Due"
                value={metadata?.deadline || ''}
                placeholder="Set deadline"
                onChange={(value) => saveProjectMetadata({ deadline: value || null })}
              />
              <EditableDateField
                icon={arrowIcon}
                iconColor="text-success"
                label="Started"
                value={metadata?.startDate || ''}
                placeholder="Set start date"
                onChange={(value) => saveProjectMetadata({ startDate: value || null })}
              />
              <EditableField
                icon={starIcon}
                iconColor="text-warning"
                label="Priority"
                value={metadata?.ranking || ''}
                placeholder="Set priority"
                onChange={(value) => saveProjectMetadata({ ranking: value || null })}
              />
              {metadata && metadata.persons.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-primary">{personIcon}</span>
                  <span>{metadata.persons.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Milestones */}
            {metadata && (
              <MilestoneList
                milestones={metadata.milestones}
                onUpdate={(milestones) => saveProjectMetadata({ milestones })}
              />
            )}
          </div>
        )}

        {/* Person info pane - horizontal layout with colored icons */}
        {selectedPerson && (hasPersonMetadataContent(selectedPersonMetadata) || personPath) && (
          <div className="mt-4 mx-0 p-4 bg-[#F8F8F8] dark:bg-[#232323] rounded-xl">
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#555] dark:text-[#AAA]">
              {/* Organisation - blue icon */}
              {selectedPersonMetadata?.organisation && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[#1E88E5]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9h1M9 13h1M9 17h1" />
                    </svg>
                  </span>
                  <span>{selectedPersonMetadata.organisation}</span>
                </div>
              )}

              {/* Relationship - purple icon */}
              {selectedPersonMetadata?.relationship && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[#8E6AC8]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="capitalize">{selectedPersonMetadata.relationship}</span>
                </div>
              )}

              {/* Languages - green icon */}
              {selectedPersonMetadata && selectedPersonMetadata.languages.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-success">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                    </svg>
                  </span>
                  <span>{selectedPersonMetadata.languages.join(', ')}</span>
                </div>
              )}

              {/* Projects - indigo circle icon */}
              {selectedPersonMetadata && selectedPersonMetadata.projects.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-primary">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="6" />
                    </svg>
                  </span>
                  <span>{selectedPersonMetadata.projects.join(', ')}</span>
                </div>
              )}
              {personPath && <OpenFileButton path={personPath} showLabel className="ml-auto flex-shrink-0" />}
            </div>
          </div>
        )}
      </div>

      {/* Task list */}
      <div ref={setScrollNode} className="flex-1 overflow-y-auto pb-20 pt-1">
        {/* Recurring tasks view */}
        {currentView === 'recurring' ? (
          (() => {
          const recurringTasks = allTasks.filter((t) => t.recurrence && !t.completed);
          return (
          <div>
            {recurringTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#B0B0B0] dark:text-[#555]">
                <svg
                  className="w-12 h-12 mb-3 opacity-40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-[14px] font-medium">No recurring tasks</p>
                <p className="text-[12px] mt-1 opacity-70">Press ⌘R to create one</p>
              </div>
            ) : (
              recurringTasks.map((task) => (
                <RecurringTaskItem
                  key={task.id}
                  task={task}
                  onClick={() => onOpenRecurringModal?.(task)}
                />
              ))
            )}
          </div>
          );
          })()
        ) : (
        <>
        {currentView === 'today' && !selectedPerson && !selectedProject && !selectedTag && calendarEnabled && (() => {
          const todayStr = formatDateForStorage(getToday());
          const todayEvents = eventsByDay[todayStr] || [];
          if (todayEvents.length === 0) return null;
          return (
            <div className="mb-2">
              <DayCalendarEvents events={todayEvents} dateStr={todayStr} />
            </div>
          );
        })()}
        {tasks.length === 0 && deadlineGroups.thisWeek.length === 0 && deadlineGroups.nextWeeks.length === 0 && deadlineGroups.later.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#B0B0B0] dark:text-[#555]">
            <svg
              className="w-12 h-12 mb-3 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <p className="text-[14px] font-medium">No tasks</p>
            <p className="text-[12px] mt-1 opacity-70">Press ⌘N to add a task</p>
          </div>
        ) : daySections.length > 0 ? (
          // Render Upcoming view with individual days, calendar events, and drag-and-drop
          <div>
            {/* Deadline badges at top */}
            {deadlineGroups.thisWeek.length > 0 && (
              <DeadlineBadgeGroup
                label="Deadlines this week"
                items={deadlineGroups.thisWeek}
                projectColors={projectColors}
                onProjectClick={setSelectedProject}
              />
            )}
            {daySections.map((section) => {
              const dayTasks = tasksByDay[section.dateStr] || [];
              const dayEvents = calendarEnabled ? (eventsByDay[section.dateStr] || []) : [];

              return (
                <div key={section.dateStr}>
                  {section.monthLabel && <MonthLabel label={section.monthLabel} />}
                  <DroppableDaySection dateStr={section.dateStr}>
                    <DaySectionHeader section={section} />
                    <DayCalendarEvents events={dayEvents} dateStr={section.dateStr} />
                    {dayTasks.map((task) => (
                      <DraggableTaskItem key={task.id} task={task} showProject={true} />
                    ))}
                  </DroppableDaySection>
                </div>
              );
            })}
            {/* Deadline badges for later periods */}
            {deadlineGroups.nextWeeks.length > 0 && (
              <DeadlineBadgeGroup
                label="Upcoming deadlines"
                items={deadlineGroups.nextWeeks}
                projectColors={projectColors}
                onProjectClick={setSelectedProject}
              />
            )}
            {deadlineGroups.later.length > 0 && (
              <DeadlineBadgeGroup
                label="Future deadlines"
                items={deadlineGroups.later}
                projectColors={projectColors}
                onProjectClick={setSelectedProject}
              />
            )}
          </div>
        ) : groupedTasks ? (
          // Render grouped by project
          <DroppableViewZone viewType={currentView}>
            <VirtualTaskList rows={groupedRows} scrollElement={scrollEl} />
          </DroppableViewZone>
        ) : selectedProject ? (
          // Render project view — virtualized flat list
          <VirtualTaskList
            rows={flatRows}
            scrollElement={scrollEl}
            footer={
              <button
                onClick={() => useTaskStore.getState().openQuickAdd({
                  project: selectedProject || undefined,
                })}
                className="flex items-center gap-3 py-1.5 ml-[36px] mr-4 px-4 opacity-50 hover:opacity-100 transition-opacity duration-150 outline-none"
              >
                <div className="mt-[3px] w-5 h-5 rounded-full border-[1.5px] border-black/20 dark:border-white/25 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-black/20 dark:text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <span className="text-[14px] text-black/40 dark:text-white/40">New To-Do</span>
              </button>
            }
          />
        ) : logbookGroups ? (
          // Render Logbook grouped by completion date
          <div>
            {logbookGroups.map(({ label, tasks: groupTasks }) => (
              <div key={label}>
                <DateSectionHeader label={label} />
                {groupTasks.map((task) => (
                  <TaskItem key={task.id} task={task} showProject={true} />
                ))}
              </div>
            ))}
            {logbookHasMore && (
              <button
                onClick={() => setLogbookLimit((l) => l + LOGBOOK_PAGE_SIZE)}
                className="flex items-center gap-2 py-2 ml-[36px] mr-4 px-4 text-[13px] text-black/40 dark:text-white/40 hover:text-primary dark:hover:text-primary transition-colors outline-none"
              >
                Show more ({tasks.length - logbookLimit} older)
              </button>
            )}
          </div>
        ) : (
          // Render flat list (person/tag view) — virtualized
          <VirtualTaskList
            rows={flatRows}
            scrollElement={scrollEl}
            footer={selectedPerson ? (
              <button
                onClick={() => useTaskStore.getState().openQuickAdd({
                  person: selectedPerson || undefined,
                })}
                className="flex items-center gap-3 py-1.5 ml-[36px] mr-4 px-4 opacity-50 hover:opacity-100 transition-opacity duration-150 outline-none"
              >
                {/* Open circle with + matching task checkbox style */}
                <div className="mt-[3px] w-5 h-5 rounded-full border-[1.5px] border-black/20 dark:border-white/25 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-black/20 dark:text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <span className="text-[14px] text-black/40 dark:text-white/40">New To-Do</span>
              </button>
            ) : undefined}
          />
        )}
        </>
        )}
      </div>

      {/* Bulk actions toolbar (multi-selection) */}
      <BulkActions />
    </div>
    </WikilinkNamesProvider>
  );
}
