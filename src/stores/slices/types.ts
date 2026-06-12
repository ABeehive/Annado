import type { StateCreator } from 'zustand';
import type { SettingsSlice } from './settingsSlice';
import type { CalendarSlice } from './calendarSlice';
import type { AgendaSlice } from './agendaSlice';
import type { UISlice } from './uiSlice';
import type { PanelSlice } from './panelSlice';
import type { TaskSlice } from './taskSlice';

// Type-only imports above are erased at compile time, so the module cycle
// (each slice imports SliceCreator from here) has no runtime effect.
// This gives every slice a fully typed set()/get() across the whole store.
export type RootState = SettingsSlice &
  CalendarSlice &
  AgendaSlice &
  UISlice &
  PanelSlice &
  TaskSlice;

export type SliceCreator<T> = StateCreator<RootState, [], [], T>;
