import { useMemo } from 'react';
import { Task } from '../../types/task';
import { useTaskStore } from '../../stores/taskStore';
import { DEFAULT_DURATION } from './constants';
import { SlotSuggestion, findNextAvailableSlots } from './utils';

export function useRescheduleSuggestions(
  doesNotFit: Task[],
  currentDateStr: string,
): Map<string, SlotSuggestion[]> {
  const {
    workSchedule,
    calendarEvents,
    tasks,
    calendarBlockingDefaults,
    eventBlockingOverrides,
    defaultTaskDuration,
  } = useTaskStore();

  return useMemo(() => {
    const map = new Map<string, SlotSuggestion[]>();

    for (const task of doesNotFit) {
      const duration = task.durationMinutes || defaultTaskDuration || DEFAULT_DURATION;
      const slots = findNextAvailableSlots(
        duration,
        currentDateStr,
        workSchedule,
        calendarEvents,
        tasks,
        calendarBlockingDefaults,
        eventBlockingOverrides,
      );
      if (slots.length > 0) {
        map.set(task.id, slots);
      }
    }

    return map;
  }, [doesNotFit, currentDateStr, workSchedule, calendarEvents, tasks, calendarBlockingDefaults, eventBlockingOverrides]);
}
