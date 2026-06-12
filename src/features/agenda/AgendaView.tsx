import { useTaskStore } from '../../stores/taskStore';
import { AgendaDayView } from './AgendaDayView';
import { AgendaWeekView } from './AgendaWeekView';
import { AgendaTaskModal } from './AgendaTaskModal';
import { AgendaBlock } from './types';
import { viewIcons } from '../../utils/viewIcons';
import { getTodayStr } from './utils';
import './agenda.css';

export function AgendaView() {
  const {
    agendaSubView, setAgendaSubView,
    agendaSelectedDate, setAgendaSelectedDate,
    agendaShowWeekends, setAgendaShowWeekends,
    agendaEditingTaskId, setAgendaEditingTaskId,
  } = useTaskStore();

  const todayStr = getTodayStr();

  const handleBlockClick = (block: AgendaBlock) => {
    if (block.task) {
      setAgendaEditingTaskId(block.task.id);
    }
  };

  const handleGoToToday = () => {
    setAgendaSelectedDate(todayStr);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FEFEFE] dark:bg-[#1A1A1A]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-12 pb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          {viewIcons.agenda}
          <h1 className="text-[22px] font-bold text-[#1A1A1A] dark:text-[#E0E0E0]">
            Agenda
          </h1>
        </div>

        <div className="flex items-center gap-2 agenda-top-bar-controls">
          {/* Today button */}
          <button
            onClick={handleGoToToday}
            className={`px-3 py-1 text-[12px] font-medium rounded-lg transition-colors ${
              agendaSelectedDate === todayStr
                ? 'bg-primary text-white'
                : 'bg-[#F0F0F0] dark:bg-[#333] text-[#555] dark:text-[#AAA] hover:bg-[#E0E0E0] dark:hover:bg-[#444]'
            }`}
          >
            Today
          </button>

          {/* Day / Week toggle */}
          <div className="flex bg-[#F0F0F0] dark:bg-[#333] rounded-lg p-0.5">
            <button
              onClick={() => setAgendaSubView('day')}
              className={`px-3 py-1 text-[12px] font-medium rounded-md transition-colors ${
                agendaSubView === 'day'
                  ? 'bg-white dark:bg-[#555] text-[#1A1A1A] dark:text-white shadow-sm'
                  : 'text-[#888] dark:text-[#888] hover:text-[#555] dark:hover:text-[#AAA]'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setAgendaSubView('week')}
              className={`px-3 py-1 text-[12px] font-medium rounded-md transition-colors ${
                agendaSubView === 'week'
                  ? 'bg-white dark:bg-[#555] text-[#1A1A1A] dark:text-white shadow-sm'
                  : 'text-[#888] dark:text-[#888] hover:text-[#555] dark:hover:text-[#AAA]'
              }`}
            >
              Week
            </button>
          </div>

          {/* Weekends toggle (only in week view) */}
          {agendaSubView === 'week' && (
            <button
              onClick={() => setAgendaShowWeekends(!agendaShowWeekends)}
              className={`px-3 py-1 text-[12px] font-medium rounded-lg transition-colors ${
                agendaShowWeekends
                  ? 'bg-primary/10 text-primary'
                  : 'bg-[#F0F0F0] dark:bg-[#333] text-[#888] dark:text-[#888]'
              }`}
              title={agendaShowWeekends ? 'Hide weekends' : 'Show weekends'}
            >
              {agendaShowWeekends ? '7 days' : '5 days'}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden agenda-timeline-container">
        {agendaSubView === 'day' ? (
          <AgendaDayView onBlockClick={handleBlockClick} />
        ) : (
          <AgendaWeekView onBlockClick={handleBlockClick} />
        )}
      </div>

      {/* Task editing modal */}
      {agendaEditingTaskId && (
        <AgendaTaskModal
          taskId={agendaEditingTaskId}
          onClose={() => setAgendaEditingTaskId(null)}
        />
      )}
    </div>
  );
}
