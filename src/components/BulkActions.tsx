import { useTaskStore } from '../stores/taskStore';
import { usePanelId } from '../contexts/PanelContext';
import { WhenType, createWhenValue } from '../types/task';
import { DeadlineButton } from './DeadlinePicker';

export function BulkActions() {
  const panelId = usePanelId();
  const { selectedTaskIds: mainIds, sidePanelSelectedTaskIds: sideIds, availableProjects, updateMultipleTasks, clearSelection } = useTaskStore();
  const selectedTaskIds = panelId === 'sidePanel' ? sideIds : mainIds;

  if (selectedTaskIds.length <= 1) return null;

  const handleWhenChange = async (when: WhenType) => {
    await updateMultipleTasks(selectedTaskIds, { when: createWhenValue(when) });
  };

  const handleProjectChange = async (project: string) => {
    await updateMultipleTasks(selectedTaskIds, { projects: project ? [project] : [] });
  };

  const handleDeadlineChange = async (deadline: string | null) => {
    await updateMultipleTasks(selectedTaskIds, { deadline });
  };

  const handleComplete = async () => {
    await updateMultipleTasks(selectedTaskIds, { completed: true });
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A1A] dark:bg-[#2A2A2A] rounded-xl shadow-2xl border border-[#333] dark:border-[#444]">
        <span className="text-[13px] text-white font-medium mr-2">
          {selectedTaskIds.length} selected
        </span>

        <div className="w-px h-5 bg-[#444]" />

        {/* When dropdown */}
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-warning" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          <select
            onChange={(e) => handleWhenChange(e.target.value as WhenType)}
            className="text-[12px] px-2 py-1 rounded-md bg-[#333] dark:bg-[#3A3A3A] text-white border-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            defaultValue=""
          >
            <option value="" disabled>When</option>
            <option value="inbox">Inbox</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="anytime">Anytime</option>
            <option value="someday">Someday</option>
          </select>
        </div>

        {/* Project dropdown */}
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="6" />
          </svg>
          <select
            onChange={(e) => handleProjectChange(e.target.value)}
            className="text-[12px] px-2 py-1 rounded-md bg-[#333] dark:bg-[#3A3A3A] text-white border-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            defaultValue=""
          >
            <option value="" disabled>Project</option>
            <option value="">No Project</option>
            {availableProjects.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Deadline picker */}
        <DeadlineButton value={null} onChange={handleDeadlineChange} />

        <div className="w-px h-5 bg-[#444]" />

        {/* Complete button */}
        <button
          onClick={handleComplete}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] text-white hover:bg-[#333] dark:hover:bg-[#444] transition-colors"
        >
          <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Complete
        </button>

        <div className="w-px h-5 bg-[#444]" />

        {/* Cancel button */}
        <button
          onClick={clearSelection}
          className="p-1.5 rounded-md text-[#888] hover:text-white hover:bg-[#333] dark:hover:bg-[#444] transition-colors"
          title="Clear selection"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
