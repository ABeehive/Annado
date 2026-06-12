import { useRef, useEffect } from 'react';
import { useAgendaData } from './useAgendaData';
import { useTaskStore } from '../../stores/taskStore';
import { TimelineGrid } from './TimelineGrid';
import { UnscheduledTasks } from './UnscheduledTasks';
import { AllDayEventPill } from './AllDayEventPill';
import { NavArrowButton } from './NavArrowButton';
import { AgendaBlock } from './types';
import { getTodayStr, addDays, scrollToCurrentTime } from './utils';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
}

interface AgendaDayViewProps {
  onBlockClick?: (block: AgendaBlock) => void;
}

export function AgendaDayView({ onBlockClick }: AgendaDayViewProps) {
  const { agendaSelectedDate, setAgendaSelectedDate } = useTaskStore();
  const todayStr = getTodayStr();
  const isToday = agendaSelectedDate === todayStr;
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayData = useAgendaData(agendaSelectedDate);

  // Scroll to current time on mount if today
  useEffect(() => {
    if (isToday && scrollRef.current) {
      scrollToCurrentTime(scrollRef.current);
    }
  }, [isToday, agendaSelectedDate]);

  const prevDay = () => setAgendaSelectedDate(addDays(agendaSelectedDate, -1));
  const nextDay = () => setAgendaSelectedDate(addDays(agendaSelectedDate, 1));

  return (
    <div className="flex flex-col h-full">
      {/* Date header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#E8E8E8] dark:border-[#333] flex-shrink-0">
        <NavArrowButton direction="prev" onClick={prevDay} />

        <div className="text-center">
          <h2 className={`text-[15px] font-semibold ${isToday ? 'text-primary' : 'text-[#1A1A1A] dark:text-[#E0E0E0]'}`}>
            {isToday ? 'Today' : formatDate(agendaSelectedDate)}
          </h2>
          {isToday && (
            <p className="text-[12px] text-[#888] dark:text-[#666]">{formatDate(agendaSelectedDate)}</p>
          )}
        </div>

        <NavArrowButton direction="next" onClick={nextDay} />
      </div>

      {/* All-day events banner */}
      {dayData.allDayEvents.length > 0 && (
        <div className="px-6 py-2 border-b border-[#E8E8E8] dark:border-[#333] flex-shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {dayData.allDayEvents.map(event => (
              <AllDayEventPill key={event.id} event={event} className="px-2.5 py-1" />
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
        <TimelineGrid
          dateStr={agendaSelectedDate}
          blocks={dayData.blocks}
          isToday={isToday}
          onBlockClick={onBlockClick}
        />

        {/* Unscheduled + doesn't fit */}
        <UnscheduledTasks
          tasks={dayData.unscheduled}
          doesNotFit={dayData.doesNotFit}
          currentDateStr={agendaSelectedDate}
        />
      </div>
    </div>
  );
}
