import { create } from 'zustand';
import type { SettingsSlice } from './slices/settingsSlice';
import type { CalendarSlice } from './slices/calendarSlice';
import type { AgendaSlice } from './slices/agendaSlice';
import type { UISlice } from './slices/uiSlice';
import type { PanelSlice } from './slices/panelSlice';
import type { TaskSlice } from './slices/taskSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createCalendarSlice } from './slices/calendarSlice';
import { createAgendaSlice } from './slices/agendaSlice';
import { createUISlice } from './slices/uiSlice';
import { createPanelSlice } from './slices/panelSlice';
import { createTaskSlice } from './slices/taskSlice';

export type RootStore = SettingsSlice & CalendarSlice & AgendaSlice & UISlice & PanelSlice & TaskSlice;

export const useTaskStore = create<RootStore>()((...args) => ({
  ...createSettingsSlice(...args),
  ...createCalendarSlice(...args),
  ...createAgendaSlice(...args),
  ...createUISlice(...args),
  ...createPanelSlice(...args),
  ...createTaskSlice(...args),
}));

export type { QuickAddPrefill } from './slices/panelSlice';
export type { RecentItem } from './slices/uiSlice';
export type { ThemePreference } from './slices/settingsSlice';
export { filterTasks, filterTasksForSmartList } from './filterTasks';
