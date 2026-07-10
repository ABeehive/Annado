import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn().mockResolvedValue([]);
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));

import { useTaskStore } from '../taskStore';

describe('bulk shared-config setters', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    localStorage.clear();
    useTaskStore.setState({ projectColors: {}, tagColors: {}, excludedPaths: [] });
  });

  it('setProjectColors replaces the map and persists it', () => {
    useTaskStore.getState().setProjectColors({ 'Website Redesign': '#e84545' });
    expect(useTaskStore.getState().projectColors).toEqual({ 'Website Redesign': '#e84545' });
    expect(JSON.parse(localStorage.getItem('projectColors') ?? '{}')).toEqual({
      'Website Redesign': '#e84545',
    });
  });

  it('setTagColors replaces the map and persists it', () => {
    useTaskStore.getState().setTagColors({ design: '#5aa9e6' });
    expect(useTaskStore.getState().tagColors).toEqual({ design: '#5aa9e6' });
    expect(JSON.parse(localStorage.getItem('tagColors') ?? '{}')).toEqual({ design: '#5aa9e6' });
  });

  it('setExcludedPathsList updates state and calls the backend', async () => {
    await useTaskStore.getState().setExcludedPathsList(['Archive/']);
    expect(useTaskStore.getState().excludedPaths).toEqual(['Archive/']);
    expect(invokeMock).toHaveBeenCalledWith('set_excluded_paths', { excludedPaths: ['Archive/'] });
  });

  it('setExcludedPathsList mirrors addExcludedPath/removeExcludedPath: sets annado_exclude '
    + 'frontmatter per added/removed path (the backend itself no-ops for folder paths)', async () => {
    await useTaskStore.getState().setExcludedPathsList(['Archive/', 'Notes/Secret.md']);
    expect(invokeMock).toHaveBeenCalledWith('set_annado_exclude_in_file', {
      relativePath: 'Archive/',
      exclude: true,
    });
    expect(invokeMock).toHaveBeenCalledWith('set_annado_exclude_in_file', {
      relativePath: 'Notes/Secret.md',
      exclude: true,
    });

    invokeMock.mockClear();
    await useTaskStore.getState().setExcludedPathsList(['Notes/Secret.md']);
    expect(invokeMock).toHaveBeenCalledWith('set_annado_exclude_in_file', {
      relativePath: 'Archive/',
      exclude: false,
    });
    expect(invokeMock).not.toHaveBeenCalledWith('set_annado_exclude_in_file', {
      relativePath: 'Notes/Secret.md',
      exclude: false,
    });
  });
});
