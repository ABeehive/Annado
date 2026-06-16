import { useShallow } from 'zustand/react/shallow';
import { usePanelId } from '../contexts/PanelContext';
import { useTaskStore } from '../stores/taskStore';
import { ViewType, Task } from '../types/task';

export interface PanelState {
  currentView: ViewType;
  selectedProject: string | null;
  selectedPerson: string | null;
  selectedTag: string | null;
  getFilteredTasks: () => Task[];
  expandTask: (id: string | null) => void;
  toggleTaskSelection: (id: string, multiSelect?: boolean) => void;
  setSelectedProject: (project: string | null) => void;
  setSelectedPerson: (person: string | null) => void;
  setSelectedTag: (tag: string | null) => void;
  setCurrentView: (view: ViewType) => void;
}

/**
 * Panel-scoped view state and actions.
 *
 * Intentionally excludes the per-row volatile fields (`selectedTaskIds`,
 * `expandedTaskId`): subscribing to those here would re-render every consumer
 * (TaskList and all rows) on each selection/expansion. Per-row selection and
 * expansion state is read via {@link usePanelTaskState}, which returns booleans
 * scoped to a single task so only the affected rows re-render.
 */
export function usePanelState(): PanelState {
  const panelId = usePanelId();

  const mainState = useTaskStore(useShallow((s) => ({
    currentView: s.currentView,
    selectedProject: s.selectedProject,
    selectedPerson: s.selectedPerson,
    selectedTag: s.selectedTag,
    getFilteredTasks: s.getFilteredTasks,
    expandTask: s.expandTask,
    toggleTaskSelection: s.toggleTaskSelection,
    setSelectedProject: s.setSelectedProject,
    setSelectedPerson: s.setSelectedPerson,
    setSelectedTag: s.setSelectedTag,
    setCurrentView: s.setCurrentView,
  })));

  const sidePanelState = useTaskStore(useShallow((s) => ({
    currentView: s.sidePanelView,
    selectedProject: s.sidePanelSelectedProject,
    selectedPerson: s.sidePanelSelectedPerson,
    selectedTag: s.sidePanelSelectedTag,
    getFilteredTasks: s.getSidePanelFilteredTasks,
    expandTask: s.sidePanelExpandTask,
    toggleTaskSelection: s.sidePanelToggleTaskSelection,
    setSelectedProject: s.setSidePanelSelectedProject,
    setSelectedPerson: s.setSidePanelSelectedPerson,
    setSelectedTag: s.setSidePanelSelectedTag,
    setCurrentView: s.setSidePanelView,
  })));

  return panelId === 'main' ? mainState : sidePanelState;
}

export interface PanelTaskState {
  isSelected: boolean;
  isSoleSelection: boolean;
  isExpanded: boolean;
}

/**
 * Per-row selection/expansion state, scoped to a single task and the active
 * panel. Returns primitives so a row only re-renders when *its own* selected /
 * expanded state flips — selecting or expanding one task no longer re-renders
 * the entire list.
 */
export function usePanelTaskState(taskId: string): PanelTaskState {
  const isMain = usePanelId() === 'main';
  return useTaskStore(useShallow((s) => {
    const ids = isMain ? s.selectedTaskIds : s.sidePanelSelectedTaskIds;
    const expandedId = isMain ? s.expandedTaskId : s.sidePanelExpandedTaskId;
    return {
      isSelected: ids.includes(taskId),
      isSoleSelection: ids.length === 1 && ids[0] === taskId,
      isExpanded: expandedId === taskId,
    };
  }));
}
