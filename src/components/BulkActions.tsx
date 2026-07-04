import { useTaskStore } from '../stores/taskStore';
import { usePanelId } from '../contexts/PanelContext';
import { WhenValue } from '../types/task';
import { DeadlineButton } from './DeadlinePicker';
import { WhenButton } from './WhenDatePicker';

export function BulkActions() {
  const panelId = usePanelId();
  const { selectedTaskIds: mainIds, sidePanelSelectedTaskIds: sideIds, availableProjects, updateMultipleTasks, clearSelection } = useTaskStore();
  const selectedTaskIds = panelId === 'sidePanel' ? sideIds : mainIds;

  if (selectedTaskIds.length <= 1) return null;

  const handleWhenChange = async (when: WhenValue) => {
    await updateMultipleTasks(selectedTaskIds, { when });
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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100%-3rem)]">
      <div className="flex items-center min-w-0 gap-2 px-4 py-2.5 bg-[#1A1A1A] dark:bg-[#2A2A2A] rounded-xl shadow-2xl border border-[#333] dark:border-[#444]">
        <span className="text-[13px] text-white font-medium mr-2">
          {selectedTaskIds.length} selected
        </span>

        <div className="w-px h-5 bg-[#444]" />

        {/* When picker (centered: the bar sits at the bottom edge) */}
        <WhenButton value="anytime" onChange={handleWhenChange} placement="center" includeInbox variant="toolbar" />

        {/* Project dropdown. appearance-none keeps the webview from swapping in
            the native (white, content-sized) control; the chevron is ours. */}
        <div className="relative flex items-center gap-1.5">
          <svg className="w-4 h-4 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="6" />
          </svg>
          <select
            onChange={(e) => handleProjectChange(e.target.value)}
            className="appearance-none max-w-[160px] text-[12px] pl-2 pr-6 py-1 rounded-md bg-[#333] dark:bg-[#3A3A3A] text-white border-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            defaultValue=""
          >
            <option value="" disabled>Project</option>
            <option value="">No Project</option>
            {availableProjects.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          <svg className="w-3 h-3 text-[#888] absolute right-1.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Deadline picker */}
        <DeadlineButton value={null} onChange={handleDeadlineChange} placement="center" variant="toolbar" />

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
