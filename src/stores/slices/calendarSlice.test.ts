import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { createStore } from 'zustand/vanilla';
import {
  CALENDAR_UNSUPPORTED_MESSAGE,
  createCalendarSlice,
  type CalendarSlice,
} from './calendarSlice';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

function createCalendarStore() {
  return createStore<CalendarSlice>()((set, get, store) =>
    createCalendarSlice(set as never, get as never, store as never)
  );
}

function installLocalStorage() {
  const items = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key),
      clear: () => items.clear(),
    },
  });
}

describe('calendarSlice platform support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorage();
  });

  it('disables Calendar integration on Windows before event commands run', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('windows');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createCalendarStore();

    await expect(store.getState().detectCalendarSupport()).resolves.toBe(false);

    expect(invoke).toHaveBeenCalledWith('get_platform');
    expect(store.getState().calendarSupported).toBe(false);
    expect(store.getState().calendarEnabled).toBe(false);
    expect(store.getState().calendarError).toBe(CALENDAR_UNSUPPORTED_MESSAGE);
    expect(localStorage.getItem('calendarEnabled')).toBe('false');
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('handles unsupported Calendar command errors without repeated failure logs', async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'get_platform') return 'macos';
      throw CALENDAR_UNSUPPORTED_MESSAGE;
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createCalendarStore();

    await expect(store.getState().checkCalendarAccess()).resolves.toBe(false);

    expect(invoke).toHaveBeenCalledWith('check_calendar_access');
    expect(store.getState().calendarSupported).toBe(false);
    expect(store.getState().calendarEnabled).toBe(false);
    expect(store.getState().calendarEvents).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
