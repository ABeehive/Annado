import { useShallow } from 'zustand/react/shallow';
import { usePanelId } from '../contexts/PanelContext';
import { useTaskStore } from '../stores/taskStore';
import { ViewType, Task } from '../types/task';

export interface PanelState {
  currentView: ViewType;
  selectedProject: string | null;
  selectedPerson: string | null;
  selectedTag: string | null;
  expandedTaskId: string | null;
  selectedTaskIds: string[];
  getFilteredTasks: () => Task[];
  expandTask: (id: string | null) => void;
  toggleTaskSelection: (id: string, multiSelect?: boolean) => void;
  setSelectedProject: (project: string | null) => void;
  setSelectedPerson: (person: string | null) => void;
  setSelectedTag: (tag: string | null) => void;
  setCurrentView: (view: ViewType) => void;
}

export function usePanelState(): PanelState {
  const panelId = usePanelId();

  const mainState = useTaskStore(useShallow((s) => ({
    currentView: s.currentView,
    selectedProject: s.selectedProject,
    selectedPerson: s.selectedPerson,
    selectedTag: s.selectedTag,
    expandedTaskId: s.expandedTaskId,
    selectedTaskIds: s.selectedTaskIds,
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
    expandedTaskId: s.sidePanelExpandedTaskId,
    selectedTaskIds: s.sidePanelSelectedTaskIds,
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
