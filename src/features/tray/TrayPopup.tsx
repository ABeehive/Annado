import { useState, useLayoutEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Task, WhenValue, ProjectInfo } from '../../types/task';
import { TaskCheckbox } from '../../components/TaskCheckbox';
import {
  formatDeadlineCountdown,
  getDeadlineUrgency,
  DEADLINE_URGENCY_COLORS,
} from '../../utils/dates';
import { RenderTitleWithLinks } from '../../utils/RenderTitleWithLinks';
import { useTrayData } from './useTrayData';

const WHEN_OPTIONS: { value: WhenValue; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'evening', label: 'Evening' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'anytime', label: 'Anytime' },
  { value: 'someday', label: 'Someday' },
];

interface TrayTaskRowProps {
  task: Task;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onOpenTask: (id: string) => void;
  personNames: Set<string>;
  projectNames: Set<string>;
  projectColors: Record<string, string>;
  availableProjects: ProjectInfo[];
  onOpenMain: () => void;
}

function TrayTaskRow({
  task,
  isExpanded,
  onToggleExpand,
  onToggleComplete,
  onOpenTask,
  personNames,
  projectNames,
  projectColors,
  availableProjects,
  onOpenMain,
}: TrayTaskRowProps) {
  const deadlineColor = task.deadline
    ? DEADLINE_URGENCY_COLORS[getDeadlineUrgency(task.deadline)]
    : undefined;

  const [notes, setNotes] = useState(task.notes);
  const notesRef = useRef(task.notes);
  notesRef.current = notes;

  const saveNotes = async () => {
    if (notesRef.current !== task.notes) {
      await invoke('update_task', { payload: { id: task.id, notes: notesRef.current } }).catch(console.error);
    }
  };

  const saveWhen = async (when: WhenValue) => {
    await invoke('update_task', { payload: { id: task.id, when } }).catch(console.error);
  };

  const saveDeadline = async (deadline: string) => {
    await invoke('update_task', { payload: { id: task.id, deadline: deadline || null } }).catch(console.error);
  };

  const currentWhen = typeof task.when === 'string' ? task.when : null;

  return (
    <div className="rounded-lg overflow-hidden">
      {/* Main row */}
      <div className="flex items-start gap-2.5 px-4 py-2 hover:bg-[#F5F5F5] dark:hover:bg-[#333]">
        <TaskCheckbox
          completed={task.completed}
          onChange={() => onToggleComplete(task.id)}
          size="md"
          className="mt-0.5 flex-shrink-0"
        />
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onToggleExpand(task.id)}
        >
          <div className={`text-[13px] leading-snug ${task.completed ? 'line-through text-[#AAA] dark:text-[#555]' : 'text-[#1A1A1A] dark:text-[#E8E8E8]'}`}>
            <RenderTitleWithLinks
              title={task.title}
              personNames={personNames}
              projectNames={projectNames}
              onPersonClick={onOpenMain}
              onProjectClick={onOpenMain}
              projectColors={projectColors}
              availableProjects={availableProjects}
              isObsidianVault={false}
            />
          </div>
          {task.deadline && !isExpanded && (
            <p className="text-[11px] mt-0.5" style={{ color: deadlineColor }}>
              {formatDeadlineCountdown(task.deadline)}
            </p>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-3 pl-11 space-y-2.5 bg-[#F8F8F8] dark:bg-[#2F2F2F]">
          {/* Notes */}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Notes…"
            rows={2}
            className="w-full text-[12px] text-[#555] dark:text-[#999] bg-transparent resize-none placeholder-[#CCC] dark:placeholder-[#555] focus:outline-none leading-relaxed"
          />

          {/* When selector */}
          <div className="flex flex-wrap gap-1">
            {WHEN_OPTIONS.map(({ value, label }) => (
              <button
                key={label}
                onClick={() => saveWhen(value)}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  currentWhen === value
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'text-[#999] dark:text-[#666] border-[#E8E8E8] dark:border-[#3A3A3A] hover:border-[#CCC] dark:hover:border-[#555]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Deadline */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#B0B0B0] dark:text-[#555]">Due</span>
            <input
              type="date"
              defaultValue={task.deadline ?? ''}
              onChange={e => saveDeadline(e.target.value)}
              className="text-[11px] bg-transparent text-[#555] dark:text-[#999] focus:outline-none border-b border-[#E8E8E8] dark:border-[#3A3A3A]"
            />
            {task.deadline && (
              <span className="text-[11px]" style={{ color: deadlineColor }}>
                {formatDeadlineCountdown(task.deadline)}
              </span>
            )}
          </div>

          {/* Open in Annado */}
          <button
            onClick={() => onOpenTask(task.id)}
            className="self-start text-[11px] font-medium px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/15 dark:hover:bg-primary/25 transition-colors"
          >
            Open in Annado
          </button>
        </div>
      )}
    </div>
  );
}

export function TrayPopup() {
  const {
    todayTasks, deadlineTasks, isVaultReady, isLoading,
    personNames, projectNames, projectColors, availableProjects,
  } = useTrayData();
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [localCompleted, setLocalCompleted] = useState<Map<string, boolean>>(new Map());
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Apply dark mode and body styles for frameless window
  useLayoutEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
  }, []);

  const handleToggleComplete = async (id: string) => {
    setLocalCompleted(prev => new Map(prev).set(id, !(prev.get(id) ?? false)));
    try {
      await invoke('toggle_task_complete', { id });
    } catch (e) {
      console.error('[tray] toggle failed', e);
      setLocalCompleted(prev => { const next = new Map(prev); next.delete(id); return next; });
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedTaskId(prev => prev === id ? null : id);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddTitle.trim()) return;
    try {
      await invoke('create_task', { payload: { title: quickAddTitle.trim(), when: 'today' } });
      setQuickAddTitle('');
    } catch (err) {
      console.error('[tray] quick-add failed', err);
    }
  };

  const handleOpenAnnado = async () => {
    await invoke('show_main_window');
    await getCurrentWindow().hide();
  };

  const handleOpenTask = async (taskId: string) => {
    await invoke('open_task_in_main', { id: taskId });
    await getCurrentWindow().hide();
  };

  const applyLocal = (tasks: Task[]) =>
    tasks.map(t => localCompleted.has(t.id) ? { ...t, completed: localCompleted.get(t.id)! } : t);

  const resolvedToday = applyLocal(todayTasks);
  const resolvedDeadlines = applyLocal(deadlineTasks);

  const sharedRowProps = { personNames, projectNames, projectColors, availableProjects, onOpenMain: handleOpenAnnado, onOpenTask: handleOpenTask };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#2A2A2A] text-[#1A1A1A] dark:text-[#E8E8E8] select-none">
      <div className="flex-1 overflow-y-auto">

        {/* Quick-add — always at top */}
        <div className="px-4 pt-3 pb-2 border-b border-[#F0F0F0] dark:border-[#333]">
          <form onSubmit={handleQuickAdd}>
            <input
              type="text"
              value={quickAddTitle}
              onChange={e => setQuickAddTitle(e.target.value)}
              placeholder="Add task for today…"
              className="w-full text-[13px] bg-transparent text-[#1A1A1A] dark:text-[#E8E8E8] placeholder-[#CCC] dark:placeholder-[#555] focus:outline-none py-1"
            />
          </form>
        </div>

        {isLoading && (
          <p className="px-4 py-6 text-[13px] text-[#999] dark:text-[#666] text-center">Loading…</p>
        )}

        {!isLoading && !isVaultReady && (
          <div className="px-4 py-6 text-center">
            <p className="text-[13px] text-[#999] dark:text-[#666]">Vault not ready</p>
            <p className="text-[11px] text-[#BBB] dark:text-[#555] mt-1">Open Annado to set up your vault</p>
          </div>
        )}

        {!isLoading && isVaultReady && (
          <>
            {/* Deadlines section — shown first */}
            {resolvedDeadlines.length > 0 && (
              <div className="py-1">
                <p className="px-4 py-1 text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider">
                  Deadlines
                </p>
                {resolvedDeadlines.map(task => (
                  <TrayTaskRow
                    key={task.id}
                    task={task}
                    isExpanded={expandedTaskId === task.id}
                    onToggleExpand={handleToggleExpand}
                    onToggleComplete={handleToggleComplete}
                    {...sharedRowProps}
                  />
                ))}
              </div>
            )}

            {/* Today section */}
            <div className={`py-1 ${resolvedDeadlines.length > 0 ? 'border-t border-[#F0F0F0] dark:border-[#333]' : ''}`}>
              <p className="px-4 py-1 text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider">
                Today
              </p>
              {resolvedToday.length === 0 ? (
                <p className="px-4 py-2 text-[13px] text-[#CCC] dark:text-[#555]">No tasks for today</p>
              ) : (
                resolvedToday.map(task => (
                  <TrayTaskRow
                    key={task.id}
                    task={task}
                    isExpanded={expandedTaskId === task.id}
                    onToggleExpand={handleToggleExpand}
                    onToggleComplete={handleToggleComplete}
                    {...sharedRowProps}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#F0F0F0] dark:border-[#333] px-4 py-2.5 flex-shrink-0">
        <button
          onClick={handleOpenAnnado}
          className="w-full text-[12px] font-medium text-primary hover:text-[#4A5AAF] transition-colors text-center"
        >
          Open Annado
        </button>
      </div>
    </div>
  );
}
