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
export const CALENDAR_UNSUPPORTED_MESSAGE = 'Calendar integration is only available on macOS.';

function inferInitialCalendarSupport(): boolean {
  if (typeof navigator === 'undefined') return true;
  return !/windows|linux/i.test(navigator.userAgent);
}

const initialCalendarSupported = inferInitialCalendarSupport();

function getCalendarErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'Calendar access failed.';
}

function isCalendarUnsupported(message: string): boolean {
  return message === CALENDAR_UNSUPPORTED_MESSAGE;
}

function unsupportedCalendarState() {
  return {
    calendarSupported: false,
    calendarEnabled: false,
    calendarEvents: [],
    availableCalendars: [],
    calendarAccessGranted: false,
    calendarError: CALENDAR_UNSUPPORTED_MESSAGE,
  };
}

export interface CalendarSlice {
  calendarEnabled: boolean;
  calendarEvents: CalendarEvent[];
  availableCalendars: CalendarInfo[];
  enabledCalendarNames: string[];
  calendarAccessGranted: boolean;
  calendarSupported: boolean;
  calendarSupportChecked: boolean;
  calendarError: string | null;
  calendarBlockingDefaults: Record<string, boolean>;
  eventBlockingOverrides: Record<string, boolean>;

  setCalendarEnabled: (enabled: boolean) => void;
  detectCalendarSupport: () => Promise<boolean>;
  fetchCalendars: () => Promise<void>;
  fetchCalendarEvents: () => Promise<void>;
  toggleCalendar: (name: string) => void;
  checkCalendarAccess: () => Promise<boolean>;
  setCalendarBlocking: (calendarName: string, blocking: boolean) => void;
  setEventBlockingOverride: (eventId: string, blocking: boolean) => void;
  clearEventBlockingOverride: (eventId: string) => void;
}

export const createCalendarSlice: SliceCreator<CalendarSlice> = (set, get) => ({
  calendarEnabled: initialCalendarSupported ? persisted.calendarEnabled : false,
  calendarEvents: [],
  availableCalendars: [],
  enabledCalendarNames: persisted.enabledCalendarNames,
  calendarAccessGranted: false,
  calendarSupported: initialCalendarSupported,
  calendarSupportChecked: false,
  calendarError: initialCalendarSupported ? null : CALENDAR_UNSUPPORTED_MESSAGE,
  calendarBlockingDefaults: persisted.calendarBlockingDefaults,
  eventBlockingOverrides: persisted.eventBlockingOverrides,

  setCalendarEnabled: (enabled: boolean) => {
    if (enabled && !get().calendarSupported) {
      set({ ...unsupportedCalendarState(), calendarSupportChecked: true });
      persist('calendarEnabled', false);
      return;
    }

    set({ calendarEnabled: enabled, calendarError: null });
    persist('calendarEnabled', enabled);
    if (enabled) {
      get().fetchCalendars();
    } else {
      set({ calendarEvents: [], availableCalendars: [], calendarAccessGranted: false });
    }
  },

  detectCalendarSupport: async () => {
    const { calendarSupportChecked, calendarSupported } = get();
    if (calendarSupportChecked) return calendarSupported;

    try {
      const platform = await invoke<string>('get_platform');
      const supported = platform === 'macos';
      if (!supported) {
        set({ ...unsupportedCalendarState(), calendarSupportChecked: true });
        persist('calendarEnabled', false);
        return false;
      }

      set({ calendarSupported: true, calendarSupportChecked: true, calendarError: null });
      return true;
    } catch (error) {
      console.error('Failed to detect platform:', error);
      set({ calendarSupported: true, calendarSupportChecked: true });
      return true;
    }
  },

  fetchCalendars: async () => {
    if (!(await get().detectCalendarSupport())) return;

    try {
      const calendars = await invoke<CalendarInfo[]>('get_calendars');
      set({ availableCalendars: calendars, calendarAccessGranted: true, calendarError: null });
      const { enabledCalendarNames } = get();
      if ((enabledCalendarNames as string[]).length === 0 && calendars.length > 0) {
        const allNames = calendars.map((c) => c.name);
        set({ enabledCalendarNames: allNames });
        persist('enabledCalendarNames', allNames);
      }
      get().fetchCalendarEvents();
    } catch (error) {
      const message = getCalendarErrorMessage(error);
      if (isCalendarUnsupported(message)) {
        set({ ...unsupportedCalendarState(), calendarSupportChecked: true });
        persist('calendarEnabled', false);
        return;
      }

      console.error('Failed to fetch calendars:', error);
      set({
        availableCalendars: [],
        calendarAccessGranted: false,
        calendarError: message,
        calendarEnabled: get().calendarEnabled,
        calendarEvents: [],
      });
    }
  },

  fetchCalendarEvents: async () => {
    const { calendarEnabled, enabledCalendarNames } = get();
    if (!calendarEnabled || (enabledCalendarNames as string[]).length === 0) return;
    if (!(await get().detectCalendarSupport())) return;

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
      set({ calendarEvents: events, calendarError: null });
    } catch (error) {
      const message = getCalendarErrorMessage(error);
      if (isCalendarUnsupported(message)) {
        set({ ...unsupportedCalendarState(), calendarSupportChecked: true });
        persist('calendarEnabled', false);
        return;
      }

      console.error('Failed to fetch calendar events:', error);
      set({
        calendarError: message,
        calendarEnabled: get().calendarEnabled,
        calendarEvents: [],
      });
    }
  },

  toggleCalendar: (name: string) => {
    if (!get().calendarSupported) return;

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
    if (!(await get().detectCalendarSupport())) return false;

    try {
      const granted = await invoke<boolean>('check_calendar_access');
      set({ calendarAccessGranted: granted, calendarError: granted ? null : get().calendarError });
      return granted;
    } catch (error) {
      const message = getCalendarErrorMessage(error);
      if (isCalendarUnsupported(message)) {
        set({ ...unsupportedCalendarState(), calendarSupportChecked: true });
        persist('calendarEnabled', false);
        return false;
      }

      console.error('Failed to check calendar access:', error);
      set({
        calendarAccessGranted: false,
        calendarEnabled: get().calendarEnabled,
        calendarError: message,
      });
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
