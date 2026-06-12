import { useMemo, useRef, useEffect } from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { useAgendaData, useWeekAllDayEvents } from './useAgendaData';
import { TimelineGrid } from './TimelineGrid';
import { AllDayEventPill } from './AllDayEventPill';
import { NavArrowButton } from './NavArrowButton';
import { AgendaBlock } from './types';
import { TOTAL_HEIGHT, ALL_DAY_ROW_HEIGHT, DAY_START, PIXELS_PER_MINUTE } from './constants';
import { getTodayStr, addDays } from './utils';
import { formatDateForStorage } from '../../utils/dates';

function getWeekStart(dateStr: string, weekStartsOn: 'monday' | 'sunday'): Date {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  let diff: number;
  if (weekStartsOn === 'sunday') {
    diff = d.getDate() - day; // Go back to Sunday
  } else {
    diff = d.getDate() - day + (day === 0 ? -6 : 1); // Go back to Monday
  }
  return new Date(d.setDate(diff));
}

function formatWeekRange(startStr: string, endStr: string): string {
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  if (startMonth === endMonth) {
    return `${start.getDate()} – ${end.getDate()} ${startMonth} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth} ${start.getFullYear()}`;
}

function DayColumn({ dateStr, isToday, onDayClick, onBlockClick }: {
  dateStr: string;
  isToday: boolean;
  onDayClick: (dateStr: string) => void;
  onBlockClick?: (block: AgendaBlock) => void;
}) {
  const dayData = useAgendaData(dateStr);
  const d = new Date(dateStr + 'T00:00:00');
  const weekdayShort = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNumber = d.getDate();
  const overflowCount = dayData.doesNotFit.length + dayData.unscheduled.length;

  return (
    <div className="flex-1 min-w-0 border-r border-[#F0F0F0] dark:border-[#2A2A2A] last:border-r-0 flex flex-col">
      {/* Day header */}
      <button
        onClick={() => onDayClick(dateStr)}
        className={`sticky top-0 z-30 w-full flex flex-col items-center py-2.5
                    hover:bg-black/5 dark:hover:bg-white/5 transition-colors
                    border-b border-[#F0F0F0] dark:border-[#2A2A2A]
                    ${isToday
                      ? 'bg-[#F5F6FF] dark:bg-[#1E1F2E]'
                      : 'bg-white dark:bg-[#1A1A1A]'
                    }`}
      >
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${
          isToday ? 'text-primary' : 'text-[#999] dark:text-[#777]'
        }`}>
          {weekdayShort}
        </span>
        <span className={`text-[22px] font-bold leading-tight mt-0.5 ${
          isToday
            ? 'bg-primary text-white w-9 h-9 rounded-full flex items-center justify-center'
            : 'text-[#1A1A1A] dark:text-[#E0E0E0]'
        }`}>
          {dayNumber}
        </span>
      </button>

      {/* Timeline */}
      <div className="relative flex-1" style={{ height: TOTAL_HEIGHT }}>
        <TimelineGrid
          dateStr={dateStr}
          blocks={dayData.blocks}
          isToday={isToday}
          onBlockClick={onBlockClick}
        />
      </div>

      {/* Doesn't fit badge */}
      {overflowCount > 0 && (
        <button
          onClick={() => onDayClick(dateStr)}
          className="sticky bottom-0 z-30 w-full flex items-center gap-1.5 py-1.5 px-3
                     bg-[#FFF8F0] dark:bg-[#2D2418] rounded-t-lg
                     text-[#B8773D] dark:text-[#D4A06A] text-[12px] font-medium
                     hover:bg-[#FFF0E0] dark:hover:bg-[#3A2E1E] transition-colors cursor-pointer"
          style={{ border: '1px solid rgba(232, 148, 58, 0.25)', borderBottom: 'none' }}
        >
          <span className="text-[13px]">⚠</span>
          <span className="flex-1">Doesn't fit</span>
          <span className="bg-[#F0DCC8] dark:bg-[#4A3828] text-[#9A6B3A] dark:text-[#D4A06A]
                           text-[11px] font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
            {overflowCount}
          </span>
        </button>
      )}
    </div>
  );
}

interface AgendaWeekViewProps {
  onBlockClick?: (block: AgendaBlock) => void;
}

export function AgendaWeekView({ onBlockClick }: AgendaWeekViewProps) {
  const { agendaSelectedDate, setAgendaSelectedDate, agendaShowWeekends, setAgendaSubView, weekStartsOn } = useTaskStore();
  const todayStr = getTodayStr();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get the week days
  const weekDays = useMemo(() => {
    const weekStartDate = getWeekStart(agendaSelectedDate, weekStartsOn);
    const weekStartStr = formatDateForStorage(weekStartDate);
    const numDays = agendaShowWeekends ? 7 : 5;
    return Array.from({ length: numDays }, (_, i) => addDays(weekStartStr, i));
  }, [agendaSelectedDate, agendaShowWeekends, weekStartsOn]);

  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];

  // Scroll to 08:30 on mount so pre-work area is off-screen
  useEffect(() => {
    if (scrollRef.current) {
      const offset_08_30 = (8.5 * 60 - DAY_START) * PIXELS_PER_MINUTE;
      scrollRef.current.scrollTop = offset_08_30;
    }
  }, [agendaSelectedDate]);

  const { allDayEvents, rowCount } = useWeekAllDayEvents(weekDays);

  const prevWeek = () => setAgendaSelectedDate(addDays(agendaSelectedDate, -7));
  const nextWeek = () => setAgendaSelectedDate(addDays(agendaSelectedDate, 7));

  const handleDayClick = (dateStr: string) => {
    setAgendaSelectedDate(dateStr);
    setAgendaSubView('day');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Week header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#E8E8E8] dark:border-[#333] flex-shrink-0">
        <NavArrowButton direction="prev" onClick={prevWeek} />

        <h2 className="text-[15px] font-semibold text-[#1A1A1A] dark:text-[#E0E0E0]">
          {formatWeekRange(weekStart, weekEnd)}
        </h2>

        <NavArrowButton direction="next" onClick={nextWeek} />
      </div>

      {/* All-day event banner */}
      {rowCount > 0 && (
        <div className="flex border-b border-[#F0F0F0] dark:border-[#2A2A2A] flex-shrink-0 relative">
          {weekDays.map((_, i) => (
            <div
              key={i}
              className="flex-1 min-w-0 border-r border-[#F0F0F0] dark:border-[#2A2A2A] last:border-r-0"
              style={{ height: rowCount * ALL_DAY_ROW_HEIGHT }}
            />
          ))}
          {/* Render pills as absolute overlays */}
          {allDayEvents.map(item => {
            const numCols = weekDays.length;
            const leftPct = (item.startDayIndex / numCols) * 100;
            const widthPct = ((item.endDayIndex - item.startDayIndex + 1) / numCols) * 100;
            return (
              <AllDayEventPill
                key={item.event.id}
                event={item.event}
                className="absolute px-1.5 truncate leading-[22px]"
                style={{
                  top: item.row * ALL_DAY_ROW_HEIGHT + 1,
                  height: ALL_DAY_ROW_HEIGHT - 2,
                  left: `calc(${leftPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Week grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex min-h-full">
          {weekDays.map(dateStr => (
            <DayColumn
              key={dateStr}
              dateStr={dateStr}
              isToday={dateStr === todayStr}
              onDayClick={handleDayClick}
              onBlockClick={onBlockClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
