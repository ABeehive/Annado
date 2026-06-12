import { useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { WrappedPeriod, WrappedData } from './types';
import { computeWrappedData, getWrappedDateRange } from './computeWrappedData';

export function useWrappedData(period: WrappedPeriod, offset: number = 0): WrappedData | null {
  const tasks = useTaskStore((s) => s.tasks);
  const projects = useTaskStore((s) => s.availableProjects);
  const projectColors = useTaskStore((s) => s.projectColors);

  return useMemo(() => {
    if (!tasks.length) return null;
    const range = getWrappedDateRange(period, offset);
    return computeWrappedData(tasks, projects, period, range, projectColors);
  }, [tasks, projects, period, offset, projectColors]);
}
