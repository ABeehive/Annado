import { invoke } from '@tauri-apps/api/core';
import type { SliceCreator } from './types';
import { persist } from '../storeUtils';
import type { CalendarInfo, CalendarEvent } from '../../types/task';

function loadPersistedCalendar() {
  try {
    return {
      calendarEnabled: JSON.parse(localStorage.getItem('calendarEnabled') ?? 'false'),
      enabledCalendarNames: JSON.parse(localStorage.getItem('enabledCalendarNames') ?? '[]') as string[],
      calendarBlockingDefaults: JSON.parse(localStorage.getItem('calendarBlockingDefaults') ?? '{}') as Record<string, boolean>,
      eventBlockingOverrides: JSON.parse(localStorage.getItem('eventBlockingOverrides') ?? '{}') as Record<string, boolean>,
    };
  } catch {
    return {
      calendarEnabled: false,
      enabledCalendarNames: [] as string[],
      calendarBlockingDefaults: {} as Record<string, boolean>,
      eventBlockingOverrides: {} as Record<string, boolean>,
    };
  }
}

const persisted = loadPersistedCalendar();

export interface CalendarSlice {
  calendarEnabled: boolean;
  calendarEvents: CalendarEvent[];
  availableCalendars: CalendarInfo[];
  enabledCalendarNames: string[];
  calendarAccessGranted: boolean;
  calendarBlockingDefaults: Record<string, boolean>;
  eventBlockingOverrides: Record<string, boolean>;

  setCalendarEnabled: (enabled: boolean) => void;
  fetchCalendars: () => Promise<void>;
  fetchCalendarEvents: () => Promise<void>;
  toggleCalendar: (name: string) => void;
  checkCalendarAccess: () => Promise<boolean>;
  setCalendarBlocking: (calendarName: string, blocking: boolean) => void;
  setEventBlockingOverride: (eventId: string, blocking: boolean) => void;
  clearEventBlockingOverride: (eventId: string) => void;
}

export const createCalendarSlice: SliceCreator<CalendarSlice> = (set, get) => ({
  calendarEnabled: persisted.calendarEnabled,
  calendarEvents: [],
  availableCalendars: [],
  enabledCalendarNames: persisted.enabledCalendarNames,
  calendarAccessGranted: false,
  calendarBlockingDefaults: persisted.calendarBlockingDefaults,
  eventBlockingOverrides: persisted.eventBlockingOverrides,

  setCalendarEnabled: (enabled: boolean) => {
    set({ calendarEnabled: enabled });
    persist('calendarEnabled', enabled);
    if (enabled) {
      get().fetchCalendars();
    } else {
      set({ calendarEvents: [], availableCalendars: [] });
    }
  },

  fetchCalendars: async () => {
    try {
      const calendars = await invoke<CalendarInfo[]>('get_calendars');
      set({ availableCalendars: calendars, calendarAccessGranted: true });
      const { enabledCalendarNames } = get();
      if ((enabledCalendarNames as string[]).length === 0 && calendars.length > 0) {
        const allNames = calendars.map((c) => c.name);
        set({ enabledCalendarNames: allNames });
        persist('enabledCalendarNames', allNames);
      }
      get().fetchCalendarEvents();
    } catch (error) {
      console.error('Failed to fetch calendars:', error);
      set({ calendarAccessGranted: false });
    }
  },

  fetchCalendarEvents: async () => {
    const { calendarEnabled, enabledCalendarNames } = get();
    if (!calendarEnabled || (enabledCalendarNames as string[]).length === 0) return;
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 60);
      const events = await invoke<CalendarEvent[]>('get_calendar_events', {
        calendarNames: enabledCalendarNames,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      set({ calendarEvents: events });
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
    }
  },

  toggleCalendar: (name: string) => {
    const { enabledCalendarNames } = get();
    const names = enabledCalendarNames as string[];
    const newNames = names.includes(name)
      ? names.filter((n) => n !== name)
      : [...names, name];
    set({ enabledCalendarNames: newNames });
    persist('enabledCalendarNames', newNames);
    get().fetchCalendarEvents();
  },

  checkCalendarAccess: async () => {
    try {
      const granted = await invoke<boolean>('check_calendar_access');
      set({ calendarAccessGranted: granted });
      return granted;
    } catch (error) {
      console.error('Failed to check calendar access:', error);
      set({ calendarAccessGranted: false });
      return false;
    }
  },

  setCalendarBlocking: (calendarName: string, blocking: boolean) => {
    const newDefaults = { ...(get().calendarBlockingDefaults as Record<string, boolean>), [calendarName]: blocking };
    set({ calendarBlockingDefaults: newDefaults });
    persist('calendarBlockingDefaults', newDefaults);
  },

  setEventBlockingOverride: (eventId: string, blocking: boolean) => {
    const newOverrides = { ...(get().eventBlockingOverrides as Record<string, boolean>), [eventId]: blocking };
    set({ eventBlockingOverrides: newOverrides });
    persist('eventBlockingOverrides', newOverrides);
  },

  clearEventBlockingOverride: (eventId: string) => {
    const newOverrides = { ...(get().eventBlockingOverrides as Record<string, boolean>) };
    delete newOverrides[eventId];
    set({ eventBlockingOverrides: newOverrides });
    persist('eventBlockingOverrides', newOverrides);
  },
});
