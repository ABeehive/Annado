import { useTaskStore } from '../stores/taskStore';
import { useShallow } from 'zustand/react/shallow';

export function BottomToolbar() {
  const { selectedTaskIds, selectedTaskId, availableProjects, updateTask } = useTaskStore(useShallow((s) => ({ selectedTaskIds: s.selectedTaskIds, selectedTaskId: s.selectedTaskId, availableProjects: s.availableProjects, updateTask: s.updateTask, })));

  // Only show when exactly one task is selected (not in bulk mode)
  if (selectedTaskIds.length !== 1 || !selectedTaskId) return null;

  const handleMoveToProject = async (project: string) => {
    if (selectedTaskId) {
      await updateTask({ id: selectedTaskId, projects: project ? [project] : [] });
    }
  };

  const handleMarkComplete = async () => {
    if (selectedTaskId) {
      await updateTask({ id: selectedTaskId, completed: true });
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30">
      <div className="flex items-center justify-center gap-1 px-4 py-2.5 bg-[#FAFAFA] dark:bg-[#222] border-t border-[#E8E8E8] dark:border-[#333]">
        {/* Move to project */}
        <div className="relative group">
          <button
            className="p-2 rounded-lg text-[#666] dark:text-[#888] hover:text-primary hover:bg-[#E8E8E8] dark:hover:bg-[#333] transition-colors"
            title="Move to project"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M3 12h18m0 0l-6-6m6 6l-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {/* Dropdown */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block">
            <div className="bg-white dark:bg-[#2A2A2A] rounded-lg shadow-lg border border-[#E8E8E8] dark:border-[#3A3A3A] py-1 min-w-[140px]">
              <button
                onClick={() => handleMoveToProject('')}
                className="w-full px-3 py-1.5 text-left text-[12px] text-[#666] dark:text-[#AAA] hover:bg-[#F0F0F0] dark:hover:bg-[#333] transition-colors"
              >
                No Project
              </button>
              {availableProjects.map((project) => (
                <button
                  key={project.name}
                  onClick={() => handleMoveToProject(project.name)}
                  className="w-full px-3 py-1.5 text-left text-[12px] text-[#1A1A1A] dark:text-[#E0E0E0] hover:bg-[#F0F0F0] dark:hover:bg-[#333] transition-colors flex items-center gap-2"
                >
                  <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="5" />
                  </svg>
                  {project.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Complete */}
        <button
          onClick={handleMarkComplete}
          className="p-2 rounded-lg text-[#666] dark:text-[#888] hover:text-success hover:bg-[#E8E8E8] dark:hover:bg-[#333] transition-colors"
          title="Mark complete"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* More options */}
        <button
          className="p-2 rounded-lg text-[#666] dark:text-[#888] hover:text-primary hover:bg-[#E8E8E8] dark:hover:bg-[#333] transition-colors"
          title="More options"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
