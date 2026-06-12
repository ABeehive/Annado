import { useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { getWhenType } from '../../types/task';
import { getTodayStr } from './utils';
import { NavArrowButton } from './NavArrowButton';

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number, weekStartsOn: 'monday' | 'sunday'): number {
  const day = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon, ...
  if (weekStartsOn === 'sunday') {
    return day; // Sun=0, Mon=1, ..., Sat=6
  }
  // Monday-first: Mon=0, Tue=1, ..., Sun=6
  return (day + 6) % 7;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function AgendaDaySelector() {
  const {
    agendaSelectedDate, setAgendaSelectedDate,
    tasks, calendarEvents, weekStartsOn,
  } = useTaskStore();

  const selectedDate = new Date(agendaSelectedDate + 'T00:00:00');
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const todayStr = getTodayStr();

  // Calculate busyness per day
  const busynessMap = useMemo(() => {
    const map: Record<string, number> = {};

    // Count tasks per day
    for (const task of tasks) {
      if (task.completed) continue;
      const whenType = getWhenType(task.when);
      if (whenType === 'date' && typeof task.when === 'object' && 'date' in task.when) {
        const d = task.when.date;
        map[d] = (map[d] || 0) + 1;
      }
    }

    // Count events per day
    for (const event of calendarEvents) {
      const d = event.startDate.slice(0, 10);
      map[d] = (map[d] || 0) + 1;
    }

    return map;
  }, [tasks, calendarEvents]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month, weekStartsOn);

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    setAgendaSelectedDate(d.toISOString().slice(0, 10));
  };

  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    setAgendaSelectedDate(d.toISOString().slice(0, 10));
  };

  const goToToday = () => {
    setAgendaSelectedDate(todayStr);
  };

  const selectDay = (day: number) => {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setAgendaSelectedDate(d);
  };

  const dayNames = weekStartsOn === 'sunday'
    ? ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="px-3 py-2">
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <NavArrowButton
          direction="prev"
          onClick={prevMonth}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#888] dark:text-[#666]"
          iconClassName="w-3.5 h-3.5"
        />
        <button
          onClick={goToToday}
          className="text-[11px] font-medium text-[#555] dark:text-[#AAA] hover:text-[#1A1A1A] dark:hover:text-white transition-colors"
        >
          {formatMonthYear(selectedDate)}
        </button>
        <NavArrowButton
          direction="next"
          onClick={nextMonth}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#888] dark:text-[#666]"
          iconClassName="w-3.5 h-3.5"
        />
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-0">
        {dayNames.map((name, i) => (
          <div key={i} className="text-center text-[9px] text-[#999] dark:text-[#666] font-medium pb-1">
            {name}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDayOfWeek }, (_, i) => (
          <div key={`empty-${i}`} className="h-6" />
        ))}

        {/* Days */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = dateStr === agendaSelectedDate;
          const isToday = dateStr === todayStr;
          const busyness = busynessMap[dateStr] || 0;

          return (
            <button
              key={day}
              onClick={() => selectDay(day)}
              className={`h-6 w-6 mx-auto flex flex-col items-center justify-center rounded-full text-[10px] transition-colors relative ${
                isSelected
                  ? 'bg-primary text-white'
                  : isToday
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-[#555] dark:text-[#AAA] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {day}
              {busyness > 0 && !isSelected && (
                <div className="absolute -bottom-0.5 flex gap-[1px]">
                  {Array.from({ length: Math.min(busyness, 3) }, (_, j) => (
                    <div
                      key={j}
                      className={`w-[3px] h-[3px] rounded-full ${
                        isToday ? 'bg-primary' : 'bg-[#C0C0C0] dark:bg-[#555]'
                      }`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
