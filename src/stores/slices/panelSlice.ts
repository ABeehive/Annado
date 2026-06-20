import type { SliceCreator } from './types';
import { persist } from '../storeUtils';
import type { ViewType, Task } from '../../types/task';
import { filterTasks, withCompletionLinger } from '../filterTasks';
import { flattenToVisibleOrder, rangeBetween } from '../../utils/selection';

export interface QuickAddPrefill {
  title?: string;
  notes?: string;
  when?: string;
  project?: string;
  person?: string;
  deadline?: string;
}

function loadPersistedPanel() {
  try {
    const sidePanelView = localStorage.getItem('sidePanelView') as ViewType | null;
    return {
      sidePanelOpen: JSON.parse(localStorage.getItem('sidePanelOpen') ?? 'false') as boolean,
      sidePanelWidth: parseInt(localStorage.getItem('sidePanelWidth') ?? '380', 10),
      sidePanelView: (sidePanelView || 'today') as ViewType,
    };
  } catch {
    return { sidePanelOpen: false, sidePanelWidth: 380, sidePanelView: 'today' as ViewType };
  }
}

const persisted = loadPersistedPanel();

export interface PanelSlice {
  activePanel: 'main' | 'side';
  sidePanelOpen: boolean;
  sidePanelWidth: number;
  sidePanelView: ViewType;
  sidePanelSelectedProject: string | null;
  sidePanelSelectedPerson: string | null;
  sidePanelSelectedTag: string | null;
  sidePanelExpandedTaskId: string | null;
  sidePanelSelectedTaskIds: string[];
  sidePanelSelectionAnchorId: string | null;
  quickAddOpen: boolean;
  quickAddPrefill: QuickAddPrefill | null;

  setActivePanel: (panel: 'main' | 'side') => void;
  toggleSidePanel: () => void;
  setSidePanelOpen: (open: boolean) => void;
  setSidePanelWidth: (width: number) => void;
  setSidePanelView: (view: ViewType) => void;
  setSidePanelSelectedProject: (project: string | null) => void;
  setSidePanelSelectedPerson: (person: string | null) => void;
  setSidePanelSelectedTag: (tag: string | null) => void;
  sidePanelExpandTask: (id: string | null) => void;
  sidePanelToggleTaskSelection: (id: string, multiSelect?: boolean) => void;
  sidePanelSelectTaskRange: (toId: string) => void;
  sidePanelSelectAllVisible: () => void;
  getSidePanelOrderedVisibleTaskIds: () => string[];
  getSidePanelFilteredTasks: () => Task[];
  openQuickAdd: (prefill?: QuickAddPrefill) => void;
  closeQuickAdd: () => void;
}

export const createPanelSlice: SliceCreator<PanelSlice> = (set, get) => ({
  activePanel: 'main',
  sidePanelOpen: persisted.sidePanelOpen,
  sidePanelWidth: persisted.sidePanelWidth,
  sidePanelView: persisted.sidePanelView,
  sidePanelSelectedProject: null,
  sidePanelSelectedPerson: null,
  sidePanelSelectedTag: null,
  sidePanelExpandedTaskId: null,
  sidePanelSelectedTaskIds: [],
  sidePanelSelectionAnchorId: null,
  quickAddOpen: false,
  quickAddPrefill: null,

  setActivePanel: (panel) => set({ activePanel: panel }),

  toggleSidePanel: () => {
    const open = !(get().sidePanelOpen as boolean);
    set({ sidePanelOpen: open });
    persist('sidePanelOpen', open);
  },

  setSidePanelOpen: (open) => {
    set({ sidePanelOpen: open });
    persist('sidePanelOpen', open);
  },

  setSidePanelWidth: (width) => {
    set({ sidePanelWidth: width });
    localStorage.setItem('sidePanelWidth', String(width));
  },

  setSidePanelView: (view) => {
    set({
      sidePanelView: view,
      sidePanelSelectedProject: null,
      sidePanelSelectedPerson: null,
      sidePanelSelectedTag: null,
      sidePanelExpandedTaskId: null,
    });
    localStorage.setItem('sidePanelView', view);
  },

  setSidePanelSelectedProject: (project) => {
    set({
      sidePanelSelectedProject: project,
      sidePanelSelectedPerson: null,
      sidePanelSelectedTag: null,
      sidePanelExpandedTaskId: null,
    });
  },

  setSidePanelSelectedPerson: (person) => {
    set({
      sidePanelSelectedPerson: person,
      sidePanelSelectedProject: null,
      sidePanelSelectedTag: null,
      sidePanelExpandedTaskId: null,
    });
    if (person) get().fetchPersonMetadata(person);
  },

  setSidePanelSelectedTag: (tag) => {
    set({
      sidePanelSelectedTag: tag,
      sidePanelSelectedProject: null,
      sidePanelSelectedPerson: null,
      sidePanelExpandedTaskId: null,
    });
  },

  sidePanelExpandTask: (id) => {
    // Collapse the other panel when expanding in side panel
    set({ sidePanelExpandedTaskId: id, expandedTaskId: null });
  },

  sidePanelToggleTaskSelection: (id, multiSelect = false) => {
    const currentIds = (get().sidePanelSelectedTaskIds as string[]);
    if (multiSelect) {
      const isSelected = currentIds.includes(id);
      const newIds = isSelected ? currentIds.filter((tid) => tid !== id) : [...currentIds, id];
      set({ sidePanelSelectedTaskIds: newIds, selectedTaskIds: [], activePanel: 'side', sidePanelSelectionAnchorId: id });
    } else {
      const isSelected = currentIds.length === 1 && currentIds[0] === id;
      set({ sidePanelSelectedTaskIds: isSelected ? [] : [id], selectedTaskIds: [], activePanel: 'side', sidePanelSelectionAnchorId: isSelected ? null : id });
    }
  },

  getSidePanelOrderedVisibleTaskIds: () => {
    const s = get();
    const isGrouped = !s.sidePanelSelectedProject && !s.sidePanelSelectedPerson && !s.sidePanelSelectedTag
      && s.sidePanelView !== 'logbook' && s.sidePanelView !== 'upcoming';
    return flattenToVisibleOrder(s.getSidePanelFilteredTasks(), {
      isGrouped,
      isTodayView: s.sidePanelView === 'today',
    }).map((t) => t.id);
  },

  sidePanelSelectTaskRange: (toId) => {
    const s = get();
    const anchorId = (s.sidePanelSelectionAnchorId as string | null) ?? toId;
    const ids = rangeBetween(s.getSidePanelOrderedVisibleTaskIds(), anchorId, toId);
    set({ sidePanelSelectedTaskIds: ids, sidePanelSelectionAnchorId: anchorId, selectedTaskIds: [], activePanel: 'side' });
  },

  sidePanelSelectAllVisible: () => {
    const ids = get().getSidePanelOrderedVisibleTaskIds();
    set({ sidePanelSelectedTaskIds: ids, sidePanelSelectionAnchorId: ids[0] ?? null, selectedTaskIds: [], activePanel: 'side' });
  },

  getSidePanelFilteredTasks: () => {
    const state = get();
    return withCompletionLinger(state.tasks, state.completingTaskIds, (ts) =>
      filterTasks(
        ts,
        state.sidePanelView,
        state.sidePanelSelectedProject,
        state.sidePanelSelectedPerson,
        state.sidePanelSelectedTag,
      ));
  },

  openQuickAdd: (prefill) => set({ quickAddOpen: true, quickAddPrefill: prefill ?? null }),
  closeQuickAdd: () => set({ quickAddOpen: false, quickAddPrefill: null }),
});
