import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Tauri bridge before importing anything that pulls in the store.
// `invoke` is the only call we assert on; `listen` is mocked because the task
// slice imports it at module load (setupEventListeners).
const invokeMock = vi.fn();
const listenMock = vi.fn().mockResolvedValue(() => {});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

// localStorage is not available by default in jsdom, so provide a minimal mock
if (!globalThis.localStorage) {
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: typeof localStorage }).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    length: 0,
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as unknown as Storage;
}

import { useTaskStore } from '../taskStore';

describe('multi-select is cleared on view switches', () => {
  beforeEach(() => {
    useTaskStore.setState({
      selectedTaskIds: ['a', 'b'],
      sidePanelSelectedTaskIds: ['c', 'd'],
    });
  });

  it.each([
    ['setCurrentView', () => useTaskStore.getState().setCurrentView('today')],
    ['setSelectedProject', () => useTaskStore.getState().setSelectedProject('P')],
    ['setSelectedPerson', () => useTaskStore.getState().setSelectedPerson(null)],
    ['setSelectedTag', () => useTaskStore.getState().setSelectedTag('t')],
    ['navigateToProject', () => useTaskStore.getState().navigateToProject('P')],
  ])('%s clears the main-panel selection', (_name, act) => {
    act();
    expect(useTaskStore.getState().selectedTaskIds).toEqual([]);
  });

  it('setSidePanelView clears the side-panel selection', () => {
    useTaskStore.getState().setSidePanelView('inbox');
    expect(useTaskStore.getState().sidePanelSelectedTaskIds).toEqual([]);
  });
});
