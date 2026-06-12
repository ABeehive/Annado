import { useState, useEffect, useRef } from 'react';
import { useFocusWhen } from '../hooks/useFocus';
import { useTaskStore } from '../stores/taskStore';
import { getProjectColor } from '../utils/projectColors';

interface MoveToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MoveToProjectModal({ isOpen, onClose }: MoveToProjectModalProps) {
  const {
    availableProjects,
    projectColors,
    activePanel,
    selectedTaskIds: mainSelectedTaskIds,
    expandedTaskId: mainExpandedTaskId,
    sidePanelSelectedTaskIds,
    sidePanelExpandedTaskId,
    tasks,
    updateTask,
    updateMultipleTasks
  } = useTaskStore();

  const selectedTaskIds = activePanel === 'side' ? sidePanelSelectedTaskIds : mainSelectedTaskIds;
  const expandedTaskId = activePanel === 'side' ? sidePanelExpandedTaskId : mainExpandedTaskId;

  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useFocusWhen(searchInputRef, isOpen);

  // Get the tasks to be moved
  const getTasksToMove = () => {
    if (selectedTaskIds.length > 1) {
      return tasks.filter(t => selectedTaskIds.includes(t.id));
    } else if (expandedTaskId) {
      const task = tasks.find(t => t.id === expandedTaskId);
      return task ? [task] : [];
    } else if (selectedTaskIds.length === 1) {
      const task = tasks.find(t => t.id === selectedTaskIds[0]);
      return task ? [task] : [];
    }
    return [];
  };

  const tasksToMove = getTasksToMove();
  // Get the current projects - if multiple tasks, find common projects
  const currentProjects = tasksToMove.length === 1
    ? tasksToMove[0].projects
    : tasksToMove.reduce<string[]>((common, task) =>
        common.filter(p => task.projects.includes(p)),
        tasksToMove[0]?.projects || []
      );

  // Build project list: "No Project" + filtered projects
  const filteredProjects = availableProjects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Include "No Project" option if search matches or empty
  const showNoProject = searchQuery === '' || 'no project'.includes(searchQuery.toLowerCase());
  const projectOptions = showNoProject
    ? [{ name: null as string | null, path: '', parentFolder: null }, ...filteredProjects.map(p => ({ name: p.name as string | null, path: p.path, parentFolder: p.parentFolder }))]
    : filteredProjects.map(p => ({ name: p.name as string | null, path: p.path, parentFolder: p.parentFolder }));

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  // Keep highlighted index in bounds
  useEffect(() => {
    if (highlightedIndex >= projectOptions.length) {
      setHighlightedIndex(Math.max(0, projectOptions.length - 1));
    }
  }, [projectOptions.length, highlightedIndex]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current) {
      const highlightedEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      highlightedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleMove = async (projectName: string | null) => {
    const taskIds = tasksToMove.map(t => t.id);

    if (projectName === null) {
      // "No Project" - remove all projects
      if (taskIds.length === 1) {
        await updateTask({ id: taskIds[0], projects: [] });
      } else if (taskIds.length > 1) {
        await updateMultipleTasks(taskIds, { projects: [] });
      }
    } else {
      // Toggle the project - if already assigned, remove it; otherwise, add it
      for (const taskToMove of tasksToMove) {
        const hasProject = taskToMove.projects.includes(projectName);
        const newProjects = hasProject
          ? taskToMove.projects.filter(p => p !== projectName)
          : [...taskToMove.projects, projectName];
        await updateTask({ id: taskToMove.id, projects: newProjects });
      }
    }

    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(i => (i + 1) % projectOptions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(i => (i - 1 + projectOptions.length) % projectOptions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (projectOptions[highlightedIndex]) {
          handleMove(projectOptions[highlightedIndex].name);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  if (!isOpen) return null;

  const taskCount = tasksToMove.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/10 dark:bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm bg-white dark:bg-[#2A2A2A] rounded-xl shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E8] dark:border-[#3A3A3A]">
          <h2 className="text-[14px] font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
            Move to Project
            {taskCount > 1 && (
              <span className="ml-2 text-[12px] font-normal text-[#888]">
                ({taskCount} tasks)
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-[#A0A0A0] hover:text-[#666] dark:hover:text-[#888] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="px-4 py-3 border-b border-[#E8E8E8] dark:border-[#3A3A3A]">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#F5F5F5] dark:bg-[#1E1E1E] rounded-lg">
            <svg className="w-4 h-4 text-[#8A8A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder="Search projects..."
              className="flex-1 bg-transparent text-[13px] text-[#1A1A1A] dark:text-[#E8E8E8] placeholder-[#8A8A8A]"
            />
          </div>
        </div>

        {/* Project List */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto py-2">
          {projectOptions.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-[#8A8A8A]">
              No projects found
            </div>
          ) : (
            projectOptions.map((project, index) => {
              const isHighlighted = index === highlightedIndex;
              const isCurrent = project.name !== null && currentProjects.includes(project.name);
              const color = project.name ? getProjectColor(project.name, project.parentFolder, projectColors) : '#8A8A8A';

              return (
                <button
                  key={project.name ?? 'no-project'}
                  data-index={index}
                  onClick={() => handleMove(project.name)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                    isHighlighted
                      ? 'bg-[#D4E4FA] dark:bg-[#2D4A6F]'
                      : 'hover:bg-[#F5F5F5] dark:hover:bg-[#333]'
                  }`}
                >
                  {/* Project Icon */}
                  {project.name === null ? (
                    <svg className="w-5 h-5 text-[#8A8A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={color} stroke="none">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}

                  {/* Project Name */}
                  <span className={`flex-1 text-[13px] truncate ${
                    isHighlighted
                      ? 'text-[#1A1A1A] dark:text-white'
                      : 'text-[#1A1A1A] dark:text-[#E0E0E0]'
                  }`}>
                    {project.name ?? 'No Project'}
                  </span>

                  {/* Current Project Indicator */}
                  {isCurrent && (
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#F5F5F5] dark:bg-[#252525] border-t border-[#E8E8E8] dark:border-[#3A3A3A]">
          <div className="flex items-center justify-center gap-4 text-[11px] text-[#888]">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-[#3A3A3A] rounded border border-[#D0D0D0] dark:border-[#4A4A4A] text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-[#3A3A3A] rounded border border-[#D0D0D0] dark:border-[#4A4A4A] text-[10px]">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-[#3A3A3A] rounded border border-[#D0D0D0] dark:border-[#4A4A4A] text-[10px]">esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
