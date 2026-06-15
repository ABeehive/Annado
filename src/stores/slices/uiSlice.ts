import type { SliceCreator } from './types';
import { persist } from '../storeUtils';
import type { SmartList, ViewType } from '../../types/task';

export interface RecentItem {
  type: 'task' | 'project' | 'person' | 'view' | 'tag';
  id: string;
}

function loadPersistedUI() {
  try {
    const defaultCounts = { inbox: true, today: true, upcoming: true, anytime: true, someday: true, logbook: false, recurring: false };
    return {
      sidebarWidth: parseInt(localStorage.getItem('sidebarWidth') ?? '256', 10),
      expandedFolders: new Set<string>(JSON.parse(localStorage.getItem('expandedFolders') ?? '[]')),
      projectColors: JSON.parse(localStorage.getItem('projectColors') ?? '{}') as Record<string, string>,
      tagColors: JSON.parse(localStorage.getItem('tagColors') ?? '{}') as Record<string, string>,
      projectOrder: JSON.parse(localStorage.getItem('projectOrder') ?? '[]') as string[],
      recentItems: JSON.parse(localStorage.getItem('recentItems') ?? '[]') as RecentItem[],
      sidebarCounts: JSON.parse(localStorage.getItem('sidebarCounts') ?? JSON.stringify(defaultCounts)) as Record<string, boolean>,
      showProjectCounts: JSON.parse(localStorage.getItem('showProjectCounts') ?? 'true') as boolean,
    };
  } catch {
    return {
      sidebarWidth: 256,
      expandedFolders: new Set<string>(),
      projectColors: {} as Record<string, string>,
      tagColors: {} as Record<string, string>,
      projectOrder: [] as string[],
      recentItems: [] as RecentItem[],
      sidebarCounts: { inbox: true, today: true, upcoming: true, anytime: true, someday: true, logbook: false, recurring: false } as Record<string, boolean>,
      showProjectCounts: true,
    };
  }
}

const persisted = loadPersistedUI();

export interface UISlice {
  sidebarWidth: number;
  expandedFolders: Set<string>;
  projectColors: Record<string, string>;
  tagColors: Record<string, string>;
  projectOrder: string[];
  sidebarCounts: Record<string, boolean>;
  showProjectCounts: boolean;
  recentItems: RecentItem[];
  smartLists: SmartList[];
  selectedSmartListId: string | null;

  setSidebarWidth: (width: number) => void;
  toggleFolder: (folder: string) => void;
  setProjectColor: (project: string, color: string) => void;
  setTagColor: (tag: string, color: string) => void;
  reorderProjects: (activeId: string, overId: string) => void;
  setSidebarCount: (area: string, visible: boolean) => void;
  setShowProjectCounts: (visible: boolean) => void;
  addRecentItem: (type: RecentItem['type'], id: string) => void;
  addSmartList: (list: SmartList) => void;
  updateSmartList: (id: string, changes: Partial<SmartList>) => void;
  deleteSmartList: (id: string) => void;
  setSelectedSmartList: (id: string | null) => void;
}

const MAX_RECENT = 20;

export const createUISlice: SliceCreator<UISlice> = (set, get) => ({
  sidebarWidth: persisted.sidebarWidth,
  expandedFolders: persisted.expandedFolders,
  projectColors: persisted.projectColors,
  tagColors: persisted.tagColors,
  projectOrder: persisted.projectOrder,
  sidebarCounts: persisted.sidebarCounts,
  showProjectCounts: persisted.showProjectCounts,
  recentItems: persisted.recentItems,
  smartLists: [],
  selectedSmartListId: null,

  setSidebarWidth: (width) => {
    set({ sidebarWidth: width });
    localStorage.setItem('sidebarWidth', String(width));
  },

  toggleFolder: (folder) => {
    const next = new Set(get().expandedFolders);
    if (next.has(folder)) next.delete(folder); else next.add(folder);
    set({ expandedFolders: next });
    persist('expandedFolders', Array.from(next));
  },

  setProjectColor: (project, color) => {
    const projectColors = { ...get().projectColors, [project]: color };
    set({ projectColors });
    persist('projectColors', projectColors);
  },

  setTagColor: (tag, color) => {
    // Key by lowercase name so the color applies to every casing variant.
    const tagColors = { ...get().tagColors, [tag.toLowerCase()]: color };
    set({ tagColors });
    persist('tagColors', tagColors);
  },

  reorderProjects: (activeId, overId) => {
    const { projectOrder } = get();
    // If projectOrder is empty, initialize from availableProjects
    const availableProjects = get().availableProjects ?? [];
    const order = (projectOrder as string[]).length > 0
      ? [...(projectOrder as string[])]
      : availableProjects.map((p: { name: string }) => p.name);
    const oldIndex = order.indexOf(activeId);
    const newIndex = order.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;
    order.splice(oldIndex, 1);
    order.splice(newIndex, 0, activeId);
    set({ projectOrder: order });
    persist('projectOrder', order);
  },

  setSidebarCount: (area, visible) => {
    const sidebarCounts = { ...get().sidebarCounts, [area]: visible };
    set({ sidebarCounts });
    persist('sidebarCounts', sidebarCounts);
  },

  setShowProjectCounts: (visible) => {
    set({ showProjectCounts: visible });
    persist('showProjectCounts', visible);
  },

  addRecentItem: (type, id) => {
    const filtered = (get().recentItems as RecentItem[]).filter((r) => !(r.type === type && r.id === id));
    const recentItems = [{ type, id }, ...filtered].slice(0, MAX_RECENT);
    set({ recentItems });
    persist('recentItems', recentItems);
  },

  addSmartList: (list) => {
    const vaultPath = get().vaultPath as string | null;
    const smartLists = [...(get().smartLists as SmartList[]), list];
    set({ smartLists });
    if (vaultPath) persist(`smartLists:${vaultPath}`, smartLists);
  },

  updateSmartList: (id, changes) => {
    const vaultPath = get().vaultPath as string | null;
    const smartLists = (get().smartLists as SmartList[]).map((l) => (l.id === id ? { ...l, ...changes } : l));
    set({ smartLists });
    if (vaultPath) persist(`smartLists:${vaultPath}`, smartLists);
  },

  deleteSmartList: (id) => {
    const { selectedSmartListId: selId } = get();
    const vaultPath = get().vaultPath as string | null;
    const smartLists = (get().smartLists as SmartList[]).filter((l) => l.id !== id);
    const extra = selId === id ? { selectedSmartListId: null, currentView: 'inbox' as ViewType } : {};
    set({ smartLists, ...extra });
    if (vaultPath) persist(`smartLists:${vaultPath}`, smartLists);
  },

  setSelectedSmartList: (id) => set({ selectedSmartListId: id }),
});
