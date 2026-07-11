import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));

import { invoke } from '@tauri-apps/api/core';
import { useTaskStore } from '../taskStore';

const invokeMock = vi.mocked(invoke);

describe('excluded-tags settings actions', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    invokeMock.mockResolvedValue([]);
    useTaskStore.setState({ excludedTags: [], tasks: [] });
  });

  it('addExcludedTag normalizes input (trim, strip #) and adopts the fresh task list', async () => {
    const fresh = [{ id: 't1' }];
    invokeMock.mockResolvedValue(fresh);
    await useTaskStore.getState().addExcludedTag(' #Wachten ');
    expect(invokeMock).toHaveBeenCalledWith('set_excluded_tags', { excludedTags: ['Wachten'] });
    expect(useTaskStore.getState().excludedTags).toEqual(['Wachten']);
    expect(useTaskStore.getState().tasks).toEqual(fresh);
  });

  it('addExcludedTag dedupes case-insensitively', async () => {
    useTaskStore.setState({ excludedTags: ['wachten'] });
    await useTaskStore.getState().addExcludedTag('WACHTEN');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('addExcludedTag ignores empty input', async () => {
    await useTaskStore.getState().addExcludedTag('  #  ');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('removeExcludedTag removes case-insensitively', async () => {
    useTaskStore.setState({ excludedTags: ['Wachten', 'template'] });
    await useTaskStore.getState().removeExcludedTag('wachten');
    expect(invokeMock).toHaveBeenCalledWith('set_excluded_tags', { excludedTags: ['template'] });
    expect(useTaskStore.getState().excludedTags).toEqual(['template']);
  });

  it('setExcludedTagsList applies the list as-is (shared-config read-back)', async () => {
    await useTaskStore.getState().setExcludedTagsList(['a', 'b']);
    expect(invokeMock).toHaveBeenCalledWith('set_excluded_tags', { excludedTags: ['a', 'b'] });
    expect(useTaskStore.getState().excludedTags).toEqual(['a', 'b']);
  });
});
