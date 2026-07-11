import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTaskStore } from '../stores/taskStore';
import {
  assembleSharedConfig,
  parseSharedConfig,
  SHARED_FIELDS,
  publishSharedConfig,
  applySharedConfig,
  setupSharedConfigSync,
  beginVaultLoadPublishSuppression,
  endVaultLoadPublishSuppression,
} from './sharedConfig';

const invokeMock = vi.mocked(invoke);
const listenMock = vi.mocked(listen);

describe('assembleSharedConfig', () => {
  beforeEach(() => {
    useTaskStore.setState({
      excludedPaths: ['Archive/'],
      excludedTags: ['template'],
      projectColors: { 'Website Redesign': '#e84545' },
      tagColors: { design: '#5aa9e6' },
      taskFormat: 'annado',
      taskMarkerTag: '',
      inheritFrontmatterTags: false,
    });
  });

  it('produces the seven fields plus schema metadata', () => {
    const out = assembleSharedConfig(useTaskStore.getState());
    expect(out).toEqual({
      schemaVersion: 1,
      generatedBy: 'annado-desktop',
      excludedPaths: ['Archive/'],
      excludedTags: ['template'],
      projectColors: { 'Website Redesign': '#e84545' },
      tagColors: { design: '#5aa9e6' },
      taskFormat: 'annado',
      taskMarkerTag: '',
      inheritFrontmatterTags: false,
    });
  });

  it('has exactly seven synced fields in the sync map', () => {
    expect(SHARED_FIELDS.map((f) => f.key).sort()).toEqual(
      ['excludedPaths', 'excludedTags', 'inheritFrontmatterTags', 'projectColors', 'tagColors', 'taskFormat', 'taskMarkerTag'].sort(),
    );
  });

  it('lowercases legacy mixed-case tagColors keys on publish (shared.json contract)', () => {
    useTaskStore.setState({ tagColors: { Admin: '#E53935', design: '#5aa9e6' } });
    const out = assembleSharedConfig(useTaskStore.getState());
    expect(out.tagColors).toEqual({ admin: '#E53935', design: '#5aa9e6' });
  });
});

describe('parseSharedConfig', () => {
  it('returns the object for valid JSON', () => {
    expect(parseSharedConfig('{"taskFormat":"annado"}')).toEqual({ taskFormat: 'annado' });
  });
  it('returns null for malformed JSON', () => {
    expect(parseSharedConfig('{ not json')).toBeNull();
  });
  it('returns null for non-object JSON', () => {
    expect(parseSharedConfig('42')).toBeNull();
  });
});

describe('publishSharedConfig', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    invokeMock.mockResolvedValue(undefined);
    useTaskStore.setState({
      excludedPaths: [],
      excludedTags: [],
      projectColors: {},
      tagColors: {},
      taskFormat: 'annado',
      taskMarkerTag: '',
      inheritFrontmatterTags: false,
      usedWithObsidianPlugin: false,
    });
  });

  it('does nothing when the toggle is off', async () => {
    await publishSharedConfig();
    expect(invokeMock).not.toHaveBeenCalledWith('write_plugin_shared_config', expect.anything());
  });

  it('writes the assembled JSON when the toggle is on', async () => {
    useTaskStore.setState({ usedWithObsidianPlugin: true });
    await publishSharedConfig();
    const call = invokeMock.mock.calls.find((c) => c[0] === 'write_plugin_shared_config');
    expect(call).toBeTruthy();
    const parsed = JSON.parse((call![1] as { json: string }).json);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.generatedBy).toBe('annado-desktop');
  });
});

describe('applySharedConfig', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    invokeMock.mockResolvedValue([]);
    useTaskStore.setState({
      projectColors: {},
      tagColors: {},
      excludedPaths: [],
      excludedTags: [],
      taskFormat: 'annado',
      taskMarkerTag: '',
      inheritFrontmatterTags: false,
    });
  });

  it('applies present fields to the store', async () => {
    await applySharedConfig(
      JSON.stringify({ projectColors: { A: '#111111' }, taskMarkerTag: 'task' }),
    );
    expect(useTaskStore.getState().projectColors).toEqual({ A: '#111111' });
    expect(invokeMock).toHaveBeenCalledWith('set_task_marker', { taskMarker: 'task' });
  });

  it('ignores malformed JSON without throwing', async () => {
    await expect(applySharedConfig('{ broken')).resolves.toBeUndefined();
  });

  it('lowercases incoming tagColors keys on read-back', async () => {
    await applySharedConfig(JSON.stringify({ tagColors: { Admin: '#E53935' } }));
    expect(useTaskStore.getState().tagColors).toEqual({ admin: '#E53935' });
  });

  it('rejects a field with the wrong shape and still applies the rest', async () => {
    await applySharedConfig(
      JSON.stringify({ projectColors: 'red', taskMarkerTag: 'task' }),
    );
    expect(useTaskStore.getState().projectColors).toEqual({});
    expect(invokeMock).toHaveBeenCalledWith('set_task_marker', { taskMarker: 'task' });
  });

  it('applies remaining fields when one field setter rejects', async () => {
    // `setExcludedPathsList` has no internal try/catch (unlike the other setters), so a
    // backend rejection on a malformed/untrusted shared.json propagates straight out of it.
    // applySharedConfig must catch that per-field and keep applying the rest.
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'set_excluded_paths') return Promise.reject(new Error('backend rejected excludedPaths'));
      return Promise.resolve([]);
    });

    await expect(
      applySharedConfig(
        JSON.stringify({ excludedPaths: 'x', projectColors: { A: '#111111' } }),
      ),
    ).resolves.toBeUndefined();

    expect(useTaskStore.getState().projectColors).toEqual({ A: '#111111' });
  });

  it('applies excludedTags via set_excluded_tags', async () => {
    await applySharedConfig(JSON.stringify({ excludedTags: ['wachten'] }));
    expect(invokeMock).toHaveBeenCalledWith('set_excluded_tags', { excludedTags: ['wachten'] });
    expect(useTaskStore.getState().excludedTags).toEqual(['wachten']);
  });

  it('rejects a non-string-array excludedTags shape', async () => {
    useTaskStore.setState({ excludedTags: ['keep'] });
    await applySharedConfig(JSON.stringify({ excludedTags: 'wachten' }));
    expect(useTaskStore.getState().excludedTags).toEqual(['keep']);
  });
});

describe('setupSharedConfigSync', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    invokeMock.mockResolvedValue(undefined);
    vi.useFakeTimers();
    useTaskStore.setState({
      usedWithObsidianPlugin: true,
      excludedPaths: [], excludedTags: [], projectColors: {}, tagColors: {},
      taskFormat: 'annado', taskMarkerTag: '', inheritFrontmatterTags: false,
    });
  });
  afterEach(() => vi.useRealTimers());

  it('re-publishes (debounced) when a synced field changes and the toggle is on', () => {
    const teardown = setupSharedConfigSync();
    useTaskStore.getState().setProjectColors({ A: '#123456' });
    vi.advanceTimersByTime(400);
    expect(invokeMock).toHaveBeenCalledWith('write_plugin_shared_config', expect.anything());
    teardown();
  });

  it('does NOT publish when only non-shared state changes (reference-stable change check)', () => {
    const teardown = setupSharedConfigSync();
    // A store change that touches no shared field (e.g. a task refresh) must not
    // arm a publish — tagColors' read must not manufacture fresh references.
    useTaskStore.setState({ error: 'something unrelated' });
    vi.advanceTimersByTime(800);
    expect(invokeMock).not.toHaveBeenCalledWith('write_plugin_shared_config', expect.anything());
    teardown();
  });

  it('suppresses subscription publishes during a vault load, then re-arms after', () => {
    const teardown = setupSharedConfigSync();
    beginVaultLoadPublishSuppression();
    // Load-time churn (adopt races, stale-toggle window) must never hit the file…
    useTaskStore.getState().setProjectColors({ Stale: '#000000' });
    vi.advanceTimersByTime(1200);
    expect(invokeMock).not.toHaveBeenCalledWith('write_plugin_shared_config', expect.anything());
    // …but once the load finishes, the (fresh, full) state is published after all.
    endVaultLoadPublishSuppression();
    vi.advanceTimersByTime(400);
    expect(invokeMock).toHaveBeenCalledWith('write_plugin_shared_config', expect.anything());
    teardown();
  });

  it('does not publish when the toggle is off', () => {
    useTaskStore.setState({ usedWithObsidianPlugin: false });
    const teardown = setupSharedConfigSync();
    useTaskStore.getState().setProjectColors({ A: '#123456' });
    vi.advanceTimersByTime(400);
    expect(invokeMock).not.toHaveBeenCalledWith('write_plugin_shared_config', expect.anything());
    teardown();
  });

  describe('external changes are ignored when the toggle is off', () => {
    let captured: ((event: { payload: string }) => void) | undefined;

    beforeEach(() => {
      captured = undefined;
      listenMock.mockImplementation((_name, cb) => {
        captured = cb as (event: { payload: string }) => void;
        return Promise.resolve(() => {});
      });
    });

    it('does not apply an external change while opted out', async () => {
      useTaskStore.setState({ usedWithObsidianPlugin: false });
      const teardown = setupSharedConfigSync();
      await Promise.resolve(); // let the listen() promise resolve so `captured` is set
      expect(captured).toBeDefined();
      captured!({ payload: JSON.stringify({ projectColors: { A: '#123456' } }) });
      await vi.advanceTimersByTimeAsync(0); // flush the microtasks applySharedConfig awaits on
      expect(useTaskStore.getState().projectColors).toEqual({});
      teardown();
    });

    it('applies an external change while opted in', async () => {
      useTaskStore.setState({ usedWithObsidianPlugin: true });
      const teardown = setupSharedConfigSync();
      await Promise.resolve();
      expect(captured).toBeDefined();
      captured!({ payload: JSON.stringify({ projectColors: { A: '#123456' } }) });
      await vi.advanceTimersByTimeAsync(0); // flush the microtasks applySharedConfig awaits on
      expect(useTaskStore.getState().projectColors).toEqual({ A: '#123456' });
      teardown();
    });
  });
});
