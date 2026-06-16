import { useState, useMemo, useRef, useEffect, createContext, useContext } from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { Task, ProjectInfo, EditorType } from '../../types/task';
import { computeReviewData } from './computeReviewData';
import { WhenDatePicker } from '../../components/WhenDatePicker';
import { InlineMarkdown } from '../../components/MarkdownNotesRenderer';
import { useWikilinkProps } from '../../hooks/useWikilinkProps';
import { formatDateForDisplay, formatDateForStorage, getToday } from '../../utils/dates';
import { openInEditor, editorLabel } from '../../utils/openInEditor';
import { hasAnyShortcutModifier, KEYBINDING_DEFAULTS, matchesKeybinding } from '../../utils/keybindings';

const STEPS = [
  { title: 'Process your inbox',   empty: 'Inbox is empty' },
  { title: 'Handle overdue tasks', empty: 'Nothing overdue' },
  { title: 'Review stalled tasks', empty: 'No stalled tasks' },
  { title: 'Quiet projects',       empty: 'All projects active' },
  { title: 'Coming up next week',  empty: 'Nothing planned for next week' },
] as const;

const STEP_PROGRESS_LABELS = [
  'Processing inbox',
  'Overdue tasks',
  'Stalled tasks',
  'Quiet projects',
];

const STEP_ACCENTS = [
  '#5C6BC0', // 0 – Inbox     (indigo)
  '#E05252', // 1 – Overdue   (muted red)
  '#C17D2A', // 2 – Stalled   (amber)
  '#3E9B82', // 3 – Quiet     (teal)
  '#4B89D4', // 4 – Next week (blue)
] as const;

const StepAccentContext = createContext<string>(STEP_ACCENTS[0]);

// ─── Shared visual primitives ─────────────────────────────────────────────────

function CardBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#242424] rounded-xl border border-black/[0.06] dark:border-white/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] p-8">
      {children}
    </div>
  );
}

function CardStack({ fadeKey, hasMore, children }: {
  fadeKey: number;
  hasMore: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative w-full max-w-[520px]">
      {hasMore && (
        <div className="absolute inset-x-0" style={{
          transform: 'translateX(7px) rotate(1.5deg)',
          transformOrigin: 'bottom center',
          opacity: 0.35,
          top: 5,
          zIndex: 0,
        }}>
          <div className="bg-white dark:bg-[#242424] rounded-xl border border-black/[0.06] dark:border-white/[0.07] h-24" />
        </div>
      )}
      <div key={fadeKey} className="relative z-10 animate-fade-in">
        {children}
      </div>
    </div>
  );
}

function StepProgress({ label, done, total }: { label: string; done: number; total: number }) {
  const accent = useContext(StepAccentContext);
  return (
    <div className="px-6 pt-3 pb-4 flex-shrink-0">
      <div className="max-w-[520px] mx-auto">
        <div className="flex justify-between mb-1.5">
          <span className="text-[12px] text-[#8A8A8A] dark:text-[#666]">{label}</span>
          <span className="text-[12px] text-[#8A8A8A] dark:text-[#666]">{done} of {total}</span>
        </div>
        <div className="h-[3px] rounded-full bg-[#EFECE4] dark:bg-[#333]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.max(0, (done / total) * 100)}%`, backgroundColor: accent }}
          />
        </div>
      </div>
    </div>
  );
}

function CardFlowLayout({ children, onSkip, tip = 'Tip: use 1–4 to quickly choose' }: {
  children: React.ReactNode;
  onSkip: () => void;
  tip?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-6">
      {children}
      <div className="flex justify-between items-center mt-4 w-full max-w-[520px]">
        <p className="text-[11px] text-[#C8C8C8] dark:text-[#555]">{tip}</p>
        <button
          onClick={onSkip}
          className="text-[12px] text-[#ADADB8] hover:text-[#666] dark:hover:text-[#999] transition-colors"
        >
          Skip →
        </button>
      </div>
    </div>
  );
}

function CardLabel({ label, task, projectPath, vaultPath, isObsidianVault, editorType, editorCustomCommand }: {
  label: string;
  task?: Task;
  projectPath?: string;
  vaultPath?: string | null;
  isObsidianVault?: boolean;
  editorType?: EditorType;
  editorCustomCommand?: string;
}) {
  const accent = useContext(StepAccentContext);
  const filePath = task?.filePath ?? projectPath;
  const lineNumber = task?.lineNumber ?? 1;
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
        {label}
      </p>
      {filePath && vaultPath && (
        <button
          onClick={() => openInEditor(vaultPath, filePath, lineNumber, isObsidianVault ?? true, editorType ?? 'system', editorCustomCommand ?? '').catch(console.error)}
          title={editorLabel(isObsidianVault ?? true, editorType ?? 'system')}
          className="flex items-center gap-1 text-[11px] text-[#ADADB8] hover:text-primary dark:hover:text-primary-light transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          {isObsidianVault ? 'Obsidian' : 'Open'}
        </button>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-full py-6">
      <p className="text-[14px] text-[#8A8A8A] dark:text-[#666]">{message}</p>
    </div>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionButton({ num, label, sub, onClick, primary, danger, className = '' }: {
  num: number;
  label: string;
  sub: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  className?: string;
}) {
  const accent = useContext(StepAccentContext);
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-start p-4 rounded-xl text-left transition-colors ${
        primary
          ? 'hover:brightness-90'
          : 'bg-[#F5F4F2] dark:bg-[#2E2E2E] hover:bg-[#EFECE4] dark:hover:bg-[#363636]'
      } ${className}`}
      style={primary ? { backgroundColor: accent } : undefined}
    >
      <span className={`absolute top-2 left-2 w-4 h-4 rounded-sm text-[10px] font-bold flex items-center justify-center ${
        primary
          ? 'bg-white/20 text-white'
          : 'bg-black/[0.07] dark:bg-white/10 text-[#666] dark:text-[#999]'
      }`}>
        {num}
      </span>
      <span className={`mt-3 text-[14px] font-medium ${
        danger ? 'text-danger' : primary ? 'text-white' : 'text-[#1A1A1A] dark:text-[#E0E0E0]'
      }`}>
        {label}
      </span>
      <span className={`text-[11px] mt-0.5 ${
        primary ? 'text-white/70' : 'text-[#8A8A8A] dark:text-[#666]'
      }`}>
        {sub}
      </span>
    </button>
  );
}

// ─── Schedule chip + project picker + inline schedule picker ─────────────────

function ScheduleChip({ label, onClick }: { label: string; onClick: () => void }) {
  const accent = useContext(StepAccentContext);
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-[12px] font-medium hover:brightness-90 transition-colors"
      style={{ backgroundColor: `${accent}18`, color: accent }}
    >
      {label}
    </button>
  );
}

function ProjectPicker({ projects, onSelect, onClose }: {
  projects: ProjectInfo[];
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute z-30 top-full left-0 mt-1 bg-white dark:bg-[#2A2A2A] rounded-xl shadow-xl border border-black/[0.07] dark:border-white/[0.07] py-1 min-w-[200px] max-h-52 overflow-y-auto">
      {projects.map(p => (
        <button key={p.path} onClick={() => { onSelect(p.name); onClose(); }}
          className="w-full text-left px-3 py-2 text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors">
          {p.name}
        </button>
      ))}
    </div>
  );
}

function InlineSchedulePicker({ task, onClose, onAction }: {
  task: Task;
  onClose: () => void;
  onAction: () => void;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const { updateTask, availableProjects } = useTaskStore();

  const todayDate = useMemo(() => formatDateForStorage(getToday()), []);
  const tomorrowDate = useMemo(() => {
    const d = getToday();
    d.setDate(d.getDate() + 1);
    return formatDateForStorage(d);
  }, []);

  // If the task has a deadline that is already in the past, move it to the new
  // date as well — otherwise the task stays overdue despite being rescheduled.
  const hasOverdueDeadline = !!(task.deadline && task.deadline < todayDate);

  const scheduleWith = (when: Task['when'], newDateStr?: string) => {
    const updates: { id: string; when: Task['when']; deadline?: string } = { id: task.id, when };
    if (hasOverdueDeadline && newDateStr) updates.deadline = newDateStr;
    updateTask(updates);
    onAction();
  };

  return (
    <div className="mt-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
      <div className="flex flex-wrap gap-2 items-center">
        <ScheduleChip label="Today" onClick={() => scheduleWith('today', todayDate)} />
        <ScheduleChip label="Tomorrow" onClick={() => scheduleWith({ date: tomorrowDate }, tomorrowDate)} />
        <ScheduleChip label="Specific date…" onClick={() => setShowDatePicker(true)} />
        <div className="relative">
          <ScheduleChip label="To project…" onClick={() => setShowProjectPicker(v => !v)} />
          {showProjectPicker && (
            <ProjectPicker
              projects={availableProjects}
              onSelect={name => { updateTask({ id: task.id, projects: [name] }); onAction(); }}
              onClose={() => setShowProjectPicker(false)}
            />
          )}
        </div>
        <button onClick={onClose} className="text-[12px] text-[#ADADB8] hover:text-[#777] dark:hover:text-[#AAA] transition-colors ml-auto">
          Cancel
        </button>
      </div>
      {showDatePicker && (
        <div
          className="fixed inset-0 z-50 bg-black/20 dark:bg-black/40 flex items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowDatePicker(false); }}
        >
          <div onClick={e => e.stopPropagation()}>
            <WhenDatePicker
              value={task.when}
              onChange={when => {
                const newDateStr = typeof when === 'object' && 'date' in when ? when.date : todayDate;
                scheduleWith(when, newDateStr);
                setShowDatePicker(false);
              }}
              onClose={() => setShowDatePicker(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 0: FlashCard (inbox) ────────────────────────────────────────────────

function FlashCard({ task, isScheduling, onScheduleToggle, onScheduleClose, onAdvance, onDone, onPark, onDelete }: {
  task: Task;
  isScheduling: boolean;
  onScheduleToggle: () => void;
  onScheduleClose: () => void;
  onAdvance: () => void;
  onDone: () => void;
  onPark: () => void;
  onDelete: () => void;
}) {
  const { updateTask, vaultPath, isObsidianVault, editorType, editorCustomCommand } = useTaskStore();
  const wikilinkProps = useWikilinkProps();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(task.notes);

  const saveTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== task.title) updateTask({ id: task.id, title: trimmed });
    else setTitleDraft(task.title);
    setIsEditingTitle(false);
  };

  const saveNotes = () => {
    if (notesDraft !== task.notes) updateTask({ id: task.id, notes: notesDraft });
    setEditingNotes(false);
  };

  const hasNotes = task.notes.trim().length > 0;

  return (
    <CardBody>
      <CardLabel label="From Inbox" task={task} vaultPath={vaultPath} isObsidianVault={isObsidianVault} editorType={editorType} editorCustomCommand={editorCustomCommand} />

      {/* Title */}
      {isEditingTitle ? (
        <textarea
          autoFocus
          value={titleDraft}
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); saveTitle(); }
            if (e.key === 'Escape') { setTitleDraft(task.title); setIsEditingTitle(false); }
            e.stopPropagation();
          }}
          rows={2}
          className="w-full text-[20px] font-medium bg-transparent text-[#1A1A1A] dark:text-[#E8E8E8] leading-snug resize-none focus:outline-none mb-2 -mx-1 px-1"
        />
      ) : (
        <div
          onClick={() => { setTitleDraft(task.title); setIsEditingTitle(true); }}
          className="text-[20px] font-medium text-[#1A1A1A] dark:text-[#E8E8E8] leading-snug mb-2 cursor-text rounded-lg -mx-1 px-1 py-0.5 hover:bg-black/[0.025] dark:hover:bg-white/[0.03] transition-colors"
        >
          <InlineMarkdown text={task.title} wikilinkProps={wikilinkProps} />
        </div>
      )}

      {/* Metadata */}
      <p className="text-[12px] text-[#ADADB8] dark:text-[#666] mb-4">
        {task.createdDate ? `Added ${formatDateForDisplay(task.createdDate)}` : '\u00A0'}
      </p>

      {/* Notes */}
      {editingNotes ? (
        <div className="mb-5">
          <textarea
            autoFocus
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            onBlur={saveNotes}
            onKeyDown={e => { if (e.key === 'Escape') saveNotes(); e.stopPropagation(); }}
            placeholder="Notes…"
            rows={3}
            className="w-full text-[13px] text-[#555] dark:text-[#AAA] bg-[#FAFAFA] dark:bg-[#1A1A1A] rounded-lg px-3 py-2.5 focus:outline-none resize-none placeholder-[#C8C8C8] dark:placeholder-[#555] leading-relaxed border border-black/[0.06] dark:border-white/[0.06]"
          />
        </div>
      ) : hasNotes ? (
        <div
          onClick={() => { setNotesDraft(task.notes); setEditingNotes(true); }}
          className="w-full text-[13px] text-[#777] dark:text-[#888] leading-relaxed mb-5 rounded-lg -mx-1 px-1 py-1 hover:bg-black/[0.025] dark:hover:bg-white/[0.03] transition-colors cursor-text overflow-hidden"
          style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}
        >
          {task.notes.split('\n').map((line, i) => (
            <span key={i}>{i > 0 && <br />}
              <InlineMarkdown text={line} wikilinkProps={wikilinkProps} />
            </span>
          ))}
        </div>
      ) : (
        <button
          onClick={() => { setNotesDraft(''); setEditingNotes(true); }}
          className="text-[12px] text-[#C8C8C8] dark:text-[#555] hover:text-[#999] dark:hover:text-[#888] transition-colors mb-5 block"
        >
          + Note
        </button>
      )}

      {/* 2×2 action grid */}
      <div className="grid grid-cols-2 gap-3">
        <ActionButton num={1} label="Do it now ✓" sub="Mark as complete" onClick={onDone} />
        <ActionButton num={2} label="Schedule it" sub="Date or project" onClick={onScheduleToggle} primary />
        <ActionButton num={3} label="Park it" sub="Someday/maybe" onClick={onPark} />
        <ActionButton num={4} label="Trash it" sub="Not actionable" onClick={onDelete} danger />
      </div>

      {isScheduling && (
        <InlineSchedulePicker task={task} onClose={onScheduleClose}
          onAction={() => { onScheduleClose(); onAdvance(); }} />
      )}
    </CardBody>
  );
}

// ─── Step 1: OverdueTaskCard ──────────────────────────────────────────────────

function OverdueTaskCard({ task, isScheduling, onScheduleToggle, onScheduleClose, onAdvance, onComplete, onDelete }: {
  task: Task;
  isScheduling: boolean;
  onScheduleToggle: () => void;
  onScheduleClose: () => void;
  onAdvance: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const { vaultPath, isObsidianVault, editorType, editorCustomCommand } = useTaskStore();
  const wikilinkProps = useWikilinkProps();

  const dateInfo = task.deadline
    ? { label: `Deadline: ${formatDateForDisplay(task.deadline)}`, red: true }
    : typeof task.when === 'object' && 'date' in task.when
    ? { label: `Scheduled for ${formatDateForDisplay(task.when.date)}`, red: true }
    : null;

  return (
    <CardBody>
      <CardLabel label="Overdue" task={task} vaultPath={vaultPath} isObsidianVault={isObsidianVault} editorType={editorType} editorCustomCommand={editorCustomCommand} />

      <div className="text-[20px] font-medium text-[#1A1A1A] dark:text-[#E8E8E8] leading-snug mb-2">
        <InlineMarkdown text={task.title} wikilinkProps={wikilinkProps} />
      </div>

      <p className={`text-[12px] mb-6 ${dateInfo?.red ? 'text-danger' : 'text-[#ADADB8] dark:text-[#666]'}`}>
        {dateInfo ? dateInfo.label : '\u00A0'}
      </p>

      {/* 1 wide + 2 side-by-side */}
      <div className="grid grid-cols-2 gap-3">
        <ActionButton num={1} label="New date" sub="Schedule" onClick={onScheduleToggle} primary className="col-span-2" />
        <ActionButton num={2} label="Complete ✓" sub="Done!" onClick={onComplete} />
        <ActionButton num={3} label="Delete" sub="No longer needed" onClick={onDelete} danger />
      </div>

      {isScheduling && (
        <InlineSchedulePicker task={task} onClose={onScheduleClose}
          onAction={() => { onScheduleClose(); onAdvance(); }} />
      )}
    </CardBody>
  );
}

// ─── Step 2: StalledTaskCard ──────────────────────────────────────────────────

function StalledTaskCard({ task, isScheduling, onScheduleToggle, onScheduleClose, onAdvance, onSomeday, onKeep, onDelete }: {
  task: Task;
  isScheduling: boolean;
  onScheduleToggle: () => void;
  onScheduleClose: () => void;
  onAdvance: () => void;
  onSomeday: () => void;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const { vaultPath, isObsidianVault, editorType, editorCustomCommand } = useTaskStore();
  const wikilinkProps = useWikilinkProps();

  const daysSinceCreated = task.createdDate
    ? Math.floor((Date.now() - new Date(task.createdDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <CardBody>
      <CardLabel label="Stalled" task={task} vaultPath={vaultPath} isObsidianVault={isObsidianVault} editorType={editorType} editorCustomCommand={editorCustomCommand} />

      <div className="text-[20px] font-medium text-[#1A1A1A] dark:text-[#E8E8E8] leading-snug mb-2">
        <InlineMarkdown text={task.title} wikilinkProps={wikilinkProps} />
      </div>

      <p className="text-[12px] text-[#ADADB8] dark:text-[#666] mb-6">
        {daysSinceCreated !== null ? `Inactive for ${daysSinceCreated} days` : '\u00A0'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <ActionButton num={1} label="Schedule" sub="Give it a date" onClick={onScheduleToggle} primary />
        <ActionButton num={2} label="Someday" sub="Park it" onClick={onSomeday} />
        <ActionButton num={3} label="Keep it" sub="Leave it" onClick={onKeep} />
        <ActionButton num={4} label="Delete" sub="No longer needed" onClick={onDelete} danger />
      </div>

      {isScheduling && (
        <InlineSchedulePicker task={task} onClose={onScheduleClose}
          onAction={() => { onScheduleClose(); onAdvance(); }} />
      )}
    </CardBody>
  );
}

// ─── Step 3: QuietProjectCard ─────────────────────────────────────────────────

function QuietProjectCard({ project, onOpenObsidian, onIgnore }: {
  project: ProjectInfo;
  onOpenObsidian: () => void;
  onIgnore: () => void;
}) {
  return (
    <CardBody>
      <CardLabel label="Quiet project" />

      <p className="text-[20px] font-medium text-[#1A1A1A] dark:text-[#E8E8E8] leading-snug mb-2">
        {project.name}
      </p>

      <p className="text-[12px] text-[#ADADB8] dark:text-[#666] mb-6">
        No open tasks
      </p>

      <div className="grid grid-cols-2 gap-3">
        <ActionButton num={1} label="Open project" sub="View the project" onClick={onOpenObsidian} primary />
        <ActionButton num={2} label="Ignore" sub="Not relevant now" onClick={onIgnore} />
      </div>
    </CardBody>
  );
}

// ─── Main ReviewView ──────────────────────────────────────────────────────────

export function ReviewView() {
  const {
    tasks, availableProjects, vaultPath,
    setCurrentView, updateTask, deleteTask, toggleTaskComplete,
    isObsidianVault, editorType, editorCustomCommand,
  } = useTaskStore();

  // Wikilink rendering — used for step 4 (Next Week) list
  const wikilinkProps = useWikilinkProps();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [schedulingTask, setSchedulingTask] = useState<Task | null>(null);
  const [undoStack, setUndoStack] = useState<{ id: string; title: string } | null>(null);
  const [expandedNextWeekId, setExpandedNextWeekId] = useState<string | null>(null);

  // Per-step flashcard state
  const [skippedByStep, setSkippedByStep] = useState<Record<number, string[]>>({});
  const [fadeKeyByStep, setFadeKeyByStep] = useState<Record<number, number>>({});
  const initialCountByStep = useRef<Record<number, number>>({});

  const getSkipped = (s: number) => skippedByStep[s] ?? [];
  const getFadeKey = (s: number) => fadeKeyByStep[s] ?? 0;
  const advance = (s: number) => setFadeKeyByStep(prev => ({ ...prev, [s]: (prev[s] ?? 0) + 1 }));
  const skipItem = (s: number, id: string) => {
    setSkippedByStep(prev => ({ ...prev, [s]: [...(prev[s] ?? []), id] }));
    advance(s);
  };

  const dismiss = (id: string) => setDismissedIds(s => new Set([...s, id]));

  const reviewData = useMemo(
    () => computeReviewData(tasks, availableProjects),
    [tasks, availableProjects],
  );

  // Ordered items per step (non-skipped first, skipped at end)
  const orderedInbox = useMemo(() => {
    const sk = getSkipped(0);
    return [...reviewData.inboxTasks.filter(t => !sk.includes(t.id)),
            ...reviewData.inboxTasks.filter(t => sk.includes(t.id))];
  }, [reviewData.inboxTasks, skippedByStep[0]]);

  const orderedOverdue = useMemo(() => {
    const sk = getSkipped(1);
    return [...reviewData.overdueTasks.filter(t => !sk.includes(t.id)),
            ...reviewData.overdueTasks.filter(t => sk.includes(t.id))];
  }, [reviewData.overdueTasks, skippedByStep[1]]);

  const orderedStalled = useMemo(() => {
    const base = reviewData.stalledTasks.filter(t => !dismissedIds.has(t.id));
    const sk = getSkipped(2);
    return [...base.filter(t => !sk.includes(t.id)), ...base.filter(t => sk.includes(t.id))];
  }, [reviewData.stalledTasks, dismissedIds, skippedByStep[2]]);

  const orderedQuiet = useMemo(() => {
    const base = reviewData.quietProjects.filter(p => !dismissedIds.has(p.path));
    const sk = getSkipped(3);
    return [...base.filter(p => !sk.includes(p.path)), ...base.filter(p => sk.includes(p.path))];
  }, [reviewData.quietProjects, dismissedIds, skippedByStep[3]]);

  // Capture initial counts once per step (for progress bar denominator)
  if (initialCountByStep.current[0] === undefined) initialCountByStep.current[0] = reviewData.inboxTasks.length;
  if (initialCountByStep.current[1] === undefined) initialCountByStep.current[1] = reviewData.overdueTasks.length;
  if (initialCountByStep.current[2] === undefined) initialCountByStep.current[2] = reviewData.stalledTasks.filter(t => !dismissedIds.has(t.id)).length;
  if (initialCountByStep.current[3] === undefined) initialCountByStep.current[3] = reviewData.quietProjects.filter(p => !dismissedIds.has(p.path)).length;

  const allOrdered = [orderedInbox, orderedOverdue, orderedStalled, orderedQuiet];

  // Current items per step
  const currentInbox   = orderedInbox[0]   ?? null;
  const currentOverdue = orderedOverdue[0] ?? null;
  const currentStalled = orderedStalled[0] ?? null;
  const currentQuiet   = orderedQuiet[0]   ?? null;

  // Auto-advance when a step's items are exhausted
  useEffect(() => {
    if (step >= 4) return;
    const ordered = allOrdered[step];
    const initial = initialCountByStep.current[step] ?? 0;
    if (ordered.length === 0 && initial > 0) {
      const t = setTimeout(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 350);
      return () => clearTimeout(t);
    }
  }, [orderedInbox.length, orderedOverdue.length, orderedStalled.length, orderedQuiet.length, step]);

  // Auto-navigate after completion screen
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setCurrentView('today'), 2200);
    return () => clearTimeout(t);
  }, [done]);

  // Auto-dismiss undo toast after 4s
  useEffect(() => {
    if (!undoStack) return;
    const t = setTimeout(() => setUndoStack(null), 4000);
    return () => clearTimeout(t);
  }, [undoStack]);

  // Unified keyboard handler for steps 0–3
  useEffect(() => {
    if (step > 3) return;

    const currentItem = step === 0 ? currentInbox : step === 1 ? currentOverdue : step === 2 ? currentStalled : currentQuiet;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const { keybindings } = useTaskStore.getState();

      // Complete task uses the active platform default or the user's custom binding.
      if (matchesKeybinding(e, keybindings.completeTask || KEYBINDING_DEFAULTS.completeTask) && step <= 2 && currentItem) {
        e.preventDefault();
        toggleTaskComplete((currentItem as Task).id);
        setSchedulingTask(null);
        advance(step);
        return;
      }

      if (hasAnyShortcutModifier(e)) return;

      if (!currentItem) {
        if (e.key === 'Escape') setCurrentView('today');
        return;
      }

      // Open in editor
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        const fp = (currentItem as Task).filePath ?? (currentItem as ProjectInfo).path;
        const ln = (currentItem as Task).lineNumber ?? 1;
        if (vaultPath && fp) openInEditor(vaultPath, fp, ln, isObsidianVault, editorType, editorCustomCommand).catch(console.error);
        return;
      }

      // Skip
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        const id = (currentItem as Task).id ?? (currentItem as ProjectInfo).path;
        skipItem(step, id);
        setSchedulingTask(null);
        return;
      }

      if (e.key === 'Escape') { setCurrentView('today'); return; }

      // Step-specific number shortcuts
      e.preventDefault();
      if (step === 0 && currentInbox) {
        const task = currentInbox;
        if (e.key === '1') { toggleTaskComplete(task.id); setSchedulingTask(null); advance(0); }
        else if (e.key === '2') setSchedulingTask(prev => (prev?.id === task.id ? null : task));
        else if (e.key === '3') { updateTask({ id: task.id, when: 'someday' }); setSchedulingTask(null); advance(0); }
        else if (e.key === '4') { deleteTask(task.id); setUndoStack({ id: task.id, title: task.title }); setSchedulingTask(null); advance(0); }
      } else if (step === 1 && currentOverdue) {
        const task = currentOverdue;
        if (e.key === '1') setSchedulingTask(prev => (prev?.id === task.id ? null : task));
        else if (e.key === '2') { toggleTaskComplete(task.id); advance(1); }
        else if (e.key === '3') { deleteTask(task.id); setUndoStack({ id: task.id, title: task.title }); advance(1); }
      } else if (step === 2 && currentStalled) {
        const task = currentStalled;
        if (e.key === '1') setSchedulingTask(prev => (prev?.id === task.id ? null : task));
        else if (e.key === '2') { updateTask({ id: task.id, when: 'someday' }); advance(2); }
        else if (e.key === '3') { dismiss(task.id); advance(2); }
        else if (e.key === '4') { deleteTask(task.id); setUndoStack({ id: task.id, title: task.title }); advance(2); }
      } else if (step === 3 && currentQuiet) {
        const proj = currentQuiet;
        if (e.key === '1' && vaultPath) openInEditor(vaultPath, proj.path, 1, isObsidianVault, editorType, editorCustomCommand).catch(console.error);
        else if (e.key === '2') { dismiss(proj.path); advance(3); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, currentInbox, currentOverdue, currentStalled, currentQuiet, toggleTaskComplete, updateTask, deleteTask, setCurrentView, vaultPath, skippedByStep, isObsidianVault, editorType, editorCustomCommand]);

  // Progress bar values for steps 0–3
  const getProgress = (s: number) => {
    const total = initialCountByStep.current[s] ?? 0;
    const done = total - allOrdered[s].length;
    return { total, done };
  };

  // Step labels for footer count
  const stepCounts = [
    orderedInbox.length,
    orderedOverdue.length,
    orderedStalled.length,
    orderedQuiet.length,
    reviewData.nextWeekTasks.length,
  ];

  // Current ordered items + current item for the active step
  const activeOrdered = step <= 3 ? allOrdered[step] : [];
  const activeItem = step === 0 ? currentInbox : step === 1 ? currentOverdue : step === 2 ? currentStalled : currentQuiet;

  const accent = STEP_ACCENTS[step];

  // Completion screen
  if (done) {
    return (
      <StepAccentContext.Provider value={accent}>
      <div className="flex-1 flex flex-col items-center justify-center min-w-0 bg-[#F8F7F6] dark:bg-[#1E1E1E] overflow-hidden animate-fade-in">
        <div className="flex flex-col items-center gap-4 select-none">
          {/* Checkmark circle */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${accent}18` }}
          >
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-[18px] font-semibold text-[#1A1A1A] dark:text-white">Review complete</p>
            <p className="text-[13px] text-[#ADADB8] mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
      </div>
      </StepAccentContext.Provider>
    );
  }

  return (
    <StepAccentContext.Provider value={accent}>
    <div className="flex-1 flex flex-col min-w-0 bg-[#F8F7F6] dark:bg-[#1E1E1E] overflow-hidden">

      {/* Header */}
      <div className="pl-[52px] pr-6 pt-10 pb-2 titlebar-drag titlebar-header flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 12h6M9 16h4" strokeLinecap="round" />
          </svg>
          <div>
            <h1 className="text-[22px] font-semibold text-[#1A1A1A] dark:text-white leading-tight">Weekly Review</h1>
            <p className="text-[12px] text-[#ADADB8]">Step {step + 1} of {STEPS.length}</p>
          </div>
        </div>
        <button onClick={() => setCurrentView('today')} className="p-1.5 text-[#C0C0C0] hover:text-[#888] dark:hover:text-[#AAA] transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Progress bar (steps 0–3) */}
      {step <= 3 && (() => {
        const { total, done } = getProgress(step);
        return total > 0 ? (
          <StepProgress label={STEP_PROGRESS_LABELS[step]} done={done} total={total} />
        ) : null;
      })()}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">

        {/* Steps 0–3: flashcard flow */}
        {step <= 3 && (
          <CardFlowLayout
            onSkip={() => {
              const id = step === 3
                ? currentQuiet?.path
                : (activeItem as Task | null)?.id;
              if (id) { skipItem(step, id); setSchedulingTask(null); }
            }}
            tip={step === 3 ? 'Tip: use 1–2 to quickly choose' : undefined}
          >
            {activeItem ? (
              <CardStack fadeKey={getFadeKey(step)} hasMore={activeOrdered.length > 1}>
                {step === 0 && currentInbox && (
                  <FlashCard
                    task={currentInbox}
                    isScheduling={schedulingTask?.id === currentInbox.id}
                    onScheduleToggle={() => setSchedulingTask(prev => (prev?.id === currentInbox.id ? null : currentInbox))}
                    onScheduleClose={() => setSchedulingTask(null)}
                    onAdvance={() => advance(0)}
                    onDone={() => { toggleTaskComplete(currentInbox.id); setSchedulingTask(null); advance(0); }}
                    onPark={() => { updateTask({ id: currentInbox.id, when: 'someday' }); setSchedulingTask(null); advance(0); }}
                    onDelete={() => { deleteTask(currentInbox.id); setUndoStack({ id: currentInbox.id, title: currentInbox.title }); setSchedulingTask(null); advance(0); }}
                  />
                )}
                {step === 1 && currentOverdue && (
                  <OverdueTaskCard
                    task={currentOverdue}
                    isScheduling={schedulingTask?.id === currentOverdue.id}
                    onScheduleToggle={() => setSchedulingTask(prev => (prev?.id === currentOverdue.id ? null : currentOverdue))}
                    onScheduleClose={() => setSchedulingTask(null)}
                    onAdvance={() => advance(1)}
                    onComplete={() => { toggleTaskComplete(currentOverdue.id); advance(1); }}
                    onDelete={() => { deleteTask(currentOverdue.id); setUndoStack({ id: currentOverdue.id, title: currentOverdue.title }); advance(1); }}
                  />
                )}
                {step === 2 && currentStalled && (
                  <StalledTaskCard
                    task={currentStalled}
                    isScheduling={schedulingTask?.id === currentStalled.id}
                    onScheduleToggle={() => setSchedulingTask(prev => (prev?.id === currentStalled.id ? null : currentStalled))}
                    onScheduleClose={() => setSchedulingTask(null)}
                    onAdvance={() => advance(2)}
                    onSomeday={() => { updateTask({ id: currentStalled.id, when: 'someday' }); advance(2); }}
                    onKeep={() => { dismiss(currentStalled.id); advance(2); }}
                    onDelete={() => { deleteTask(currentStalled.id); setUndoStack({ id: currentStalled.id, title: currentStalled.title }); advance(2); }}
                  />
                )}
                {step === 3 && currentQuiet && (
                  <QuietProjectCard
                    project={currentQuiet}
                    onOpenObsidian={() => { if (vaultPath) openInEditor(vaultPath, currentQuiet.path, 1, isObsidianVault, editorType, editorCustomCommand).catch(console.error); }}
                    onIgnore={() => { dismiss(currentQuiet.path); advance(3); }}
                  />
                )}
              </CardStack>
            ) : (
              <EmptyState message={STEPS[step].empty} />
            )}
          </CardFlowLayout>
        )}

        {/* Step 4: Next week — expand/collapse list */}
        {step === 4 && (
          <div className="max-w-xl mx-auto pt-4">
            <h2 className="text-[18px] font-semibold text-[#1A1A1A] dark:text-white mb-1">{STEPS[4].title}</h2>
            <p className="text-[13px] text-[#8A8A8A] dark:text-[#666] mb-5">
              {stepCounts[4] === 0
                ? STEPS[4].empty
                : `${stepCounts[4]} ${stepCounts[4] === 1 ? 'item' : 'items'}`}
            </p>
            <div className="space-y-2">
              {reviewData.nextWeekTasks.map(task => {
                const date = typeof task.when === 'object' && 'date' in task.when
                  ? formatDateForDisplay(task.when.date) : '';
                const isExpanded = expandedNextWeekId === task.id;
                return (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-[#242424] rounded-xl border border-black/[0.06] dark:border-white/[0.07] px-4 py-3.5 cursor-pointer select-none"
                    onClick={() => setExpandedNextWeekId(isExpanded ? null : task.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0 text-[14px] text-[#1A1A1A] dark:text-[#E0E0E0] leading-snug">
                        <InlineMarkdown text={task.title} wikilinkProps={wikilinkProps} />
                      </div>
                      {date && <span className="text-[12px] text-[#8A8A8A] dark:text-[#666] flex-shrink-0">{date}</span>}
                      <svg
                        className={`w-3.5 h-3.5 text-[#C0C0C0] flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.05] space-y-2">
                        {task.notes.trim() && (
                          <div className="text-[13px] text-[#777] dark:text-[#999] leading-relaxed">
                            {task.notes.split('\n').map((line, i) => (
                              <span key={i}>{i > 0 && <br />}
                                <InlineMarkdown text={line} wikilinkProps={wikilinkProps} />
                              </span>
                            ))}
                          </div>
                        )}
                        {task.deadline && (
                          <p className="text-[12px] text-danger">
                            Deadline: {formatDateForDisplay(task.deadline)}
                          </p>
                        )}
                        {task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {task.tags.map(tag => (
                              <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full border border-[#D0D0D5] dark:border-[#555] text-[#B0B0B5] dark:text-[#777]">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col px-6 pt-3 pb-4 flex-shrink-0 border-t border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] text-[#666] dark:text-[#AAA] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" />
            </svg>
            Previous
          </button>

          <span className="text-[12px] text-[#ADADB8]">{step + 1} / {STEPS.length}</span>

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-[13px] font-medium text-white hover:brightness-90 transition-colors"
              style={{ backgroundColor: accent }}>
              Next
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <button onClick={() => setDone(true)}
              className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-white hover:brightness-90 transition-colors"
              style={{ backgroundColor: accent }}>
              Finish ✓
            </button>
          )}
        </div>

        {/* Step indicator dots */}
        <div className="flex justify-center gap-2 pt-3">
          {STEPS.map((_, i) => (
            <div key={i}
              className={`rounded-full transition-all duration-200 ${
                i === step ? 'w-5 h-[3px]' :
                i < step   ? 'w-[6px] h-[6px] opacity-40' :
                             'w-[6px] h-[6px] bg-[#EFECE4] dark:bg-[#444]'
              }`}
              style={i <= step ? { backgroundColor: accent } : undefined}
            />
          ))}
        </div>
      </div>

      {/* Undo toast */}
      {undoStack && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1A1A1A] dark:bg-[#E8E8E8] text-white dark:text-[#1A1A1A] px-4 py-2.5 rounded-xl shadow-lg text-[13px] whitespace-nowrap">
          <span>"{undoStack.title.length > 30 ? `${undoStack.title.slice(0, 30)}…` : undoStack.title}" deleted</span>
          <button onClick={() => setUndoStack(null)} className="text-[#8B9CF4] font-medium hover:underline">
            Close
          </button>
        </div>
      )}
    </div>
    </StepAccentContext.Provider>
  );
}
