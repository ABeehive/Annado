import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { AgendaBlock } from './types';
import { TimeBlock } from './TimeBlock';
import { NowLine } from './NowLine';
import { DAY_START, DAY_END, TOTAL_HEIGHT, HOURS, PIXELS_PER_MINUTE } from './constants';
import { computeOverlapLayout } from './overlapLayout';

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

// Droppable 15-minute slots
function TimeSlot({ dateStr, minutes }: { dateStr: string; minutes: number }) {
  const id = `agenda-timeslot-${dateStr}-${minutes}`;
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`absolute left-12 right-0 ${isOver ? 'bg-primary/10' : ''}`}
      style={{
        top: (minutes - DAY_START) * PIXELS_PER_MINUTE,
        height: 15 * PIXELS_PER_MINUTE,
      }}
    />
  );
}

interface TimelineGridProps {
  dateStr: string;
  blocks: AgendaBlock[];
  isToday: boolean;
  onBlockClick?: (block: AgendaBlock) => void;
}

export function TimelineGrid({ dateStr, blocks, isToday, onBlockClick }: TimelineGridProps) {
  // Generate 15-minute drop slots
  const slots: number[] = [];
  for (let m = DAY_START; m < DAY_START + TOTAL_HEIGHT / PIXELS_PER_MINUTE; m += 15) {
    slots.push(m);
  }

  // Compute max end time for each block (next blocking block's start, or DAY_END)
  const maxEndMap = useMemo(() => {
    const map = new Map<string, number>();
    const blocking = blocks
      .filter(b => b.isBlocking && b.type !== 'schedule')
      .sort((a, b) => a.startMinutes - b.startMinutes);

    for (const block of blocks) {
      if (block.type !== 'task-pinned' && block.type !== 'task-auto') {
        continue;
      }
      const nextBlocking = blocking.find(
        b => b.id !== block.id && b.startMinutes >= block.startMinutes && b.startMinutes > block.startMinutes
      );
      map.set(block.id, nextBlocking ? nextBlocking.startMinutes : DAY_END);
    }
    return map;
  }, [blocks]);

  // Compute side-by-side layout for overlapping blocks
  const overlapMap = useMemo(() => computeOverlapLayout(blocks), [blocks]);

  return (
    <div className="relative" style={{ height: TOTAL_HEIGHT }}>
      {/* Hour lines */}
      {HOURS.map(hour => (
        <div key={hour} className="absolute left-0 right-0 flex items-start" style={{ top: (hour - 7) * 60 * PIXELS_PER_MINUTE }}>
          <span className="w-12 text-[10px] text-[#BBB] dark:text-[#555] text-right pr-2 -mt-[6px] flex-shrink-0">
            {formatHour(hour)}
          </span>
          <div className="flex-1 border-t border-[#F0F0F0] dark:border-[#2A2A2A]" />
        </div>
      ))}

      {/* Half-hour dotted lines */}
      {HOURS.slice(0, -1).map(hour => (
        <div
          key={`half-${hour}`}
          className="absolute left-12 right-0 border-t border-dotted border-[#F5F5F5] dark:border-[#252525]"
          style={{ top: (hour - 7) * 60 * PIXELS_PER_MINUTE + 30 * PIXELS_PER_MINUTE }}
        />
      ))}

      {/* Drop zones */}
      {slots.map(minutes => (
        <TimeSlot key={minutes} dateStr={dateStr} minutes={minutes} />
      ))}

      {/* Blocks — full width, overlapping (events behind tasks via z-index) */}
      <div className="absolute left-12 right-1 top-0 bottom-0">
        {blocks.map((block) => {
          const overlap = overlapMap.get(block.id);
          return (
            <TimeBlock
              key={block.id}
              block={block}
              maxEndMinutes={maxEndMap.get(block.id)}
              overlapIndex={overlap?.overlapIndex}
              overlapTotal={overlap?.overlapTotal}
              onBlockClick={onBlockClick}
            />
          );
        })}

        {/* Now line */}
        {isToday && <NowLine />}
      </div>
    </div>
  );
}
