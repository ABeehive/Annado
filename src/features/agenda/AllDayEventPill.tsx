import { CalendarEvent } from '../../types/task';
import { DEFAULT_TASK_COLOR } from './utils';

interface AllDayEventPillProps {
  event: CalendarEvent;
  className?: string;
  style?: React.CSSProperties;
}

export function AllDayEventPill({ event, className = '', style }: AllDayEventPillProps) {
  const color = event.calendarColor || DEFAULT_TASK_COLOR;
  const isBirthday = event.calendarName === "Birthdays";

  return (
    <div
      className={`text-[11px] font-medium rounded-md ${className}`}
      style={{
        backgroundColor: isBirthday ? 'transparent' : `${color}12`,
        color: `${color}CC`,
        border: isBirthday ? `1px solid ${color}40` : undefined,
        borderLeft: isBirthday ? undefined : `3px solid ${color}`,
        ...style,
      }}
    >
      {isBirthday ? `🎂 ${event.title}` : event.title}
    </div>
  );
}
