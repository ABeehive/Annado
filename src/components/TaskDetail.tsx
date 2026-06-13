import { useState, useEffect } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { ChecklistItemRow } from './ChecklistItemRow';
import { WhenType, createWhenValue, getWhenType } from '../types/task';
import { openEntityFile, openLabel } from '../utils/pathOpener';

export function TaskDetail() {
  const { getSelectedTask, updateTask, selectTask, availableProjects, selectedTaskIds, vaultPath, pathOpeners } = useTaskStore();
  const task = getSelectedTask();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [whenType, setWhenType] = useState<WhenType>('inbox');
  const [projects, setProjects] = useState<string[]>([]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes);
      setWhenType(getWhenType(task.when));
      setProjects(task.projects);
    }
  }, [task?.id]);

  // Don't show detail panel when multiple tasks are selected
  if (selectedTaskIds.length > 1) {
    return null;
  }

  if (!task) {
    return (
      <div className="w-80 border-l border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#1E1E1E] flex items-center justify-center">
        <p className="text-[#A0A0A0] dark:text-[#555] text-[13px]">
          Select a task to view details
        </p>
      </div>
    );
  }

  const handleSave = async () => {
    if (task) {
      await updateTask({
        id: task.id,
        title,
        notes,
        when: createWhenValue(whenType),
      });
    }
  };

  const handleTitleBlur = () => {
    if (title !== task.title) {
      handleSave();
    }
  };

  const handleNotesBlur = () => {
    if (notes !== task.notes) {
      handleSave();
    }
  };

  const handleWhenChange = async (newWhen: WhenType) => {
    setWhenType(newWhen);
    await updateTask({
      id: task.id,
      when: createWhenValue(newWhen),
    });
  };

  const handleProjectChange = async (newProject: string) => {
    const newProjects = newProject ? [newProject] : [];
    setProjects(newProjects);
    await updateTask({
      id: task.id,
      projects: newProjects,
    });
  };

  return (
    <div className="w-80 border-l border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#1E1E1E] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <h3 className="text-[13px] font-semibold text-[#1A1A1A] dark:text-[#E0E0E0]">Details</h3>
        <button
          onClick={() => selectTask(null)}
          className="text-[#A0A0A0] hover:text-[#666] dark:hover:text-[#888] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {/* Title */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="w-full px-0 py-1 text-[15px] font-medium bg-transparent text-[#1A1A1A] dark:text-[#E8E8E8] focus:outline-none border-b border-transparent focus:border-primary transition-colors"
            placeholder="Task title"
          />
        </div>

        {/* When */}
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-warning" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          <select
            value={whenType}
            onChange={(e) => handleWhenChange(e.target.value as WhenType)}
            className="flex-1 px-2 py-1.5 text-[13px] rounded-md border border-[#E0E0E0] dark:border-[#3A3A3A] bg-white dark:bg-[#2A2A2A] text-[#1A1A1A] dark:text-[#E0E0E0] focus:outline-none focus:border-primary"
          >
            <option value="inbox">Inbox</option>
            <option value="today">Today</option>
            <option value="evening">This Evening</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="anytime">Anytime</option>
            <option value="someday">Someday</option>
          </select>
        </div>

        {/* Project */}
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="6" />
          </svg>
          <select
            value={projects[0] || ''}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="flex-1 px-2 py-1.5 text-[13px] rounded-md border border-[#E0E0E0] dark:border-[#3A3A3A] bg-white dark:bg-[#2A2A2A] text-[#1A1A1A] dark:text-[#E0E0E0] focus:outline-none focus:border-primary"
          >
            <option value="">No Project</option>
            {availableProjects.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          {projects.length > 0 && vaultPath && (() => {
            const projectInfo = availableProjects.find(p => p.name === projects[0]);
            if (!projectInfo) return null;
            return (
              <button
                onClick={() => openEntityFile(projectInfo.path, pathOpeners).catch(console.error)}
                className="p-1 text-primary hover:text-[#3F51B5] transition-colors"
                title={openLabel(pathOpeners, projectInfo.path)}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            );
          })()}
        </div>

        {/* Notes */}
        <div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            rows={5}
            className="w-full px-3 py-2 text-[13px] rounded-md border border-[#E0E0E0] dark:border-[#3A3A3A] bg-white dark:bg-[#2A2A2A] text-[#1A1A1A] dark:text-[#E0E0E0] focus:outline-none focus:border-primary resize-none"
            placeholder="Notes"
          />
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2 py-0.5 rounded-full bg-[#E8E8E8] dark:bg-[#3A3A3A] text-primary dark:text-primary-light"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Checklist */}
        {task.checklist.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-[#888] uppercase tracking-wide font-medium">
              Checklist ({task.checklist.filter((c) => c.completed).length}/{task.checklist.length})
            </p>
            {task.checklist.map((item, index) => (
              <ChecklistItemRow key={index} item={item} index={index} taskId={task.id} size="sm" disabled={task.completed} />
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="pt-3 mt-auto border-t border-[#E8E8E8] dark:border-[#2A2A2A] space-y-2">
          {vaultPath && (
            <button
              onClick={() => openEntityFile(task.filePath, pathOpeners).catch(console.error)}
              className="flex items-center gap-1.5 text-[11px] text-primary hover:text-[#3F51B5] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {openLabel(pathOpeners, task.filePath)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
