import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));

import { useTaskStore } from '../taskStore';

describe('setUsedWithObsidianPlugin', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    useTaskStore.setState({
      usedWithObsidianPlugin: false,
      excludedPaths: [], projectColors: {}, tagColors: {},
      taskFormat: 'annado', taskMarkerTag: '', inheritFrontmatterTags: false,
    });
  });

  it('enabling persists the flag, starts the watcher, and seeds shared.json', async () => {
    await useTaskStore.getState().setUsedWithObsidianPlugin(true);
    expect(useTaskStore.getState().usedWithObsidianPlugin).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('set_used_with_obsidian_plugin', { value: true });
    expect(invokeMock).toHaveBeenCalledWith('ensure_shared_config_watcher');
    expect(invokeMock).toHaveBeenCalledWith('write_plugin_shared_config', expect.anything());
  });

  it('disabling persists the flag and removes shared.json', async () => {
    useTaskStore.setState({ usedWithObsidianPlugin: true });
    await useTaskStore.getState().setUsedWithObsidianPlugin(false);
    expect(useTaskStore.getState().usedWithObsidianPlugin).toBe(false);
    expect(invokeMock).toHaveBeenCalledWith('set_used_with_obsidian_plugin', { value: false });
    expect(invokeMock).toHaveBeenCalledWith('remove_plugin_shared_config');
  });
});

describe('adoptOrSeedSharedConfig', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useTaskStore.setState({
      usedWithObsidianPlugin: true,
      excludedPaths: [], projectColors: {}, tagColors: {},
      taskFormat: 'annado', taskMarkerTag: '', inheritFrontmatterTags: false,
    });
  });

  it('adopts an existing shared.json (its colors win)', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'read_plugin_shared_config') {
        return Promise.resolve(JSON.stringify({ projectColors: { B: '#222222' } }));
      }
      return Promise.resolve([]);
    });
    await useTaskStore.getState().adoptOrSeedSharedConfig();
    expect(useTaskStore.getState().projectColors).toEqual({ B: '#222222' });
    expect(invokeMock).not.toHaveBeenCalledWith('write_plugin_shared_config', expect.anything());
  });

  it('seeds when no shared.json exists yet', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'read_plugin_shared_config') return Promise.resolve(null);
      return Promise.resolve(undefined);
    });
    await useTaskStore.getState().adoptOrSeedSharedConfig();
    expect(invokeMock).toHaveBeenCalledWith('write_plugin_shared_config', expect.anything());
  });

  it('does nothing when the toggle is off', async () => {
    useTaskStore.setState({ usedWithObsidianPlugin: false });
    await useTaskStore.getState().adoptOrSeedSharedConfig();
    expect(invokeMock).not.toHaveBeenCalledWith('read_plugin_shared_config');
  });
});
