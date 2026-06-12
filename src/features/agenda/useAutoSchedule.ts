import { useMemo } from 'react';
import { Task } from '../../types/task';
import { AgendaBlock } from './types';
import { DEFAULT_DURATION } from './constants';
import { getTaskColor, Gap, findGaps, fitTaskInGaps, getTodayStr, getNowMinutes } from './utils';
import { useTaskStore } from '../../stores/taskStore';

function consumeGap(gaps: Gap[], gapIndex: number, start: number, duration: number): void {
  const gap = gaps[gapIndex];
  const end = start + duration;

  // Remove the consumed gap and add remaining pieces
  gaps.splice(gapIndex, 1);

  // Add remaining gap after the task
  if (end < gap.end) {
    gaps.splice(gapIndex, 0, { start: end, end: gap.end });
  }

  // Add remaining gap before the task (shouldn't happen since we always place at gap start)
  if (start > gap.start) {
    gaps.splice(gapIndex, 0, { start: gap.start, end: start });
  }
}

export function useAutoSchedule(
  dateStr: string,
  blockingBlocks: AgendaBlock[],
  deadlineTasks: Task[],
  whenTasks: Task[],
  anytimeTasks: Task[],
  projectColors: Record<string, string>,
  availableProjects: { name: string; parentFolder: string | null }[]
): { autoBlocks: AgendaBlock[]; doesNotFit: Task[] } {
  const { defaultTaskDuration } = useTaskStore();
  return useMemo(() => {
    // Compute occupied slots from blocking blocks
    const occupiedSlots = blockingBlocks.map(b => ({
      start: b.startMinutes,
      end: b.endMinutes,
    }));

    // Find gaps in the day (skip past slots for today)
    const isToday = dateStr === getTodayStr();
    const gaps = findGaps(occupiedSlots, isToday ? getNowMinutes() : undefined);
    const autoBlocks: AgendaBlock[] = [];
    const doesNotFit: Task[] = [];

    // Process tasks in priority layers: deadline → when → anytime
    const layers = [deadlineTasks, whenTasks, anytimeTasks];

    for (const layer of layers) {
      // Sort by priority ASC (higher priority first), duration DESC as tiebreaker
      const sorted = [...layer].sort((a, b) => {
        const priA = a.priority ?? 4;
        const priB = b.priority ?? 4;
        if (priA !== priB) return priA - priB;
        const durA = a.durationMinutes || defaultTaskDuration || DEFAULT_DURATION;
        const durB = b.durationMinutes || defaultTaskDuration || DEFAULT_DURATION;
        return durB - durA;
      });

      for (const task of sorted) {
        const duration = task.durationMinutes || defaultTaskDuration || DEFAULT_DURATION;
        const fit = fitTaskInGaps(gaps, duration);

        if (fit) {
          autoBlocks.push({
            type: 'task-auto',
            id: `auto-${task.id}`,
            title: task.title,
            startMinutes: fit.startMinutes,
            endMinutes: fit.startMinutes + duration,
            color: getTaskColor(task, availableProjects, projectColors),
            isBlocking: true,
            task,
          });
          consumeGap(gaps, fit.gapIndex, fit.startMinutes, duration);
        } else {
          doesNotFit.push(task);
        }
      }
    }

    return { autoBlocks, doesNotFit };
  }, [dateStr, blockingBlocks, deadlineTasks, whenTasks, anytimeTasks, projectColors, availableProjects]);
}
