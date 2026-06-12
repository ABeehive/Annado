import { useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore';

export function useAgendaNames() {
  const { availablePeople, availableProjects } = useTaskStore();

  const personNames = useMemo(() => new Set(availablePeople.map(p => p.name)), [availablePeople]);
  const projectNames = useMemo(() => new Set(availableProjects.map(p => p.name)), [availableProjects]);

  return { personNames, projectNames };
}
