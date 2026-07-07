import { invoke } from '@tauri-apps/api/core';
import type { SliceCreator, RootState } from './types';
import { persist, storeError } from '../storeUtils';
import { KEYBINDING_DEFAULTS } from '../../utils/keybindings';
import { normalizeTagInput } from '../../utils/tags';
import {
  detectOpeners,
  refreshOpeners,
  getOpenerPrefs,
  setOpenerPrefs,
  EMPTY_OPENER_PREFS,
  OBSIDIAN_APP_ID,
  type PathOpenerInfo,
  type OpenerPrefs,
} from '../../utils/pathOpener';
import type { FolderPaths, Task, SmartList, TaskFormat, TaskFormatDetection } from '../../types/task';

export type ThemePreference = 'light' | 'dark' | 'system';


const DEFAULT_FOLDER_PATHS: FolderPaths = {
  projectsPattern: 'Projects',
  areasPattern: 'Areas',
  personsPattern: 'Persons',
  dailyNotesFolder: '00. Daily Notes',
  dailyNotesFormat: 'YYYY/MM-MMMM/YYYY-MM-DD',
};

function loadPersistedSettings() {
  try {
    const rawTheme = localStorage.getItem('theme') as ThemePreference | null;
    const rawKeybindings = localStorage.getItem('keybindings');
    const keybindings = (() => {
      if (!rawKeybindings) return { ...KEYBINDING_DEFAULTS };
      try {
        const parsed = JSON.parse(rawKeybindings);
        if (typeof parsed !== 'object' || parsed === null) return { ...KEYBINDING_DEFAULTS };
        const validated: Record<string, string> = { ...KEYBINDING_DEFAULTS };
        for (const key of Object.keys(KEYBINDING_DEFAULTS)) {
          if (typeof parsed[key] === 'string') validated[key] = parsed[key];
        }
        return validated;
      } catch {
        return { ...KEYBINDING_DEFAULTS };
      }
    })();
    const rawAccent = localStorage.getItem('accentColor');
    return {
      theme: rawTheme && ['light', 'dark', 'system'].includes(rawTheme) ? rawTheme : 'system' as ThemePreference,
      keybindings,
      confirmDelete: JSON.parse(localStorage.getItem('confirmDelete') ?? 'true'),
      accentColor: rawAccent && /^#[0-9a-fA-F]{6}$/.test(rawAccent) ? rawAccent : null,
    };
  } catch {
    return { theme: 'system' as ThemePreference, keybindings: { ...KEYBINDING_DEFAULTS }, confirmDelete: true, accentColor: null };
  }
}

const persisted = loadPersistedSettings();

// Incremented on every vault switch so in-flight fetches from the old vault self-abort
export let _vaultVersion = 0;

/**
 * Run a vault-scoped read and apply it, ignoring the result if the vault changed while the
 * request was in flight (avoids writing stale data after the user switched vaults). On error,
 * sets `error` — unless the vault changed, in which case it's silently dropped. `set` is
 * passed in, mirroring `storeError`.
 */
async function guardedFetch<T>(
  set: (partial: never) => void,
  invokeFn: () => Promise<T>,
  apply: (value: T) => void,
): Promise<void> {
  const v = _vaultVersion;
  try {
    const result = await invokeFn();
    if (_vaultVersion !== v) return;
    apply(result);
  } catch (error) {
    if (_vaultVersion !== v) return;
    (set as (partial: Record<string, unknown>) => void)({ error: String(error) });
  }
}

/**
 * Shared loader for opening (`set_vault_path`) and creating (`create_vault`) a vault. Bumps the
 * vault version so any in-flight fetch from the previous vault self-aborts, invokes the chosen
 * command, then populates tasks and refetches all vault-scoped data. Clears `showWelcome` so the
 * welcome screen closes once a vault is loaded.
 */
async function loadVault(
  set: (partial: Partial<RootState>) => void,
  get: () => RootState,
  command: 'set_vault_path' | 'create_vault',
  path: string,
): Promise<void> {
  _vaultVersion++;
  set({ isLoading: true, error: null });
  try {
    const tasks = await invoke<Task[]>(command, { path });
    const storedLists = localStorage.getItem(`smartLists:${path}`);
    const smartLists: SmartList[] = storedLists ? JSON.parse(storedLists) : [];
    set({ tasks, vaultPath: path, isLoading: false, smartLists, selectedSmartListId: null, showWelcome: false });
    // Fire and forget — each fetch guards against stale vault via _vaultVersion
    get().fetchProjects();
    get().fetchPeople();
    get().fetchTags();
    get().fetchFolderPaths();
    get().fetchExcludedPaths();
    get().fetchIsObsidianVault();
    get().loadPathOpeners();
    get().loadOpenerPrefs();
    get().fetchTaskFormat();
    get().fetchTaskMarker();
    get().fetchInheritFrontmatterTags();
    get().fetchRecurringTemplateCount();
  } catch (error) {
    storeError(set, error, { isLoading: false });
  }
}

export interface SettingsSlice {
  vaultPath: string | null;
  isLoading: boolean;
  error: string | null;
  isObsidianVault: boolean;
  /** Apps detected on this machine that can open files/dirs (for "Open with…" menus). */
  pathOpeners: PathOpenerInfo[];
  /** "Open In" preferences: per-target order/visibility + custom openers (backend config). */
  openerPrefs: OpenerPrefs;
  taskFormat: string; // '' = unset (show first-run picker)
  needsFormatPicker: boolean; // true once we've loaded an unset task_format → open first-run picker
  taskMarkerTag: string; // '' = import every checkbox; e.g. 'task' = only #task checkboxes
  inheritFrontmatterTags: boolean; // show a note's frontmatter tags on its tasks (never written to the task line)
  recurringTemplateCount: number; // legacy templates detected in the vault (gates the migration UI)
  folderPaths: FolderPaths;
  excludedPaths: string[];
  theme: ThemePreference;
  /** Custom accent color (#rrggbb); null = default indigo from App.css */
  accentColor: string | null;
  keybindings: Record<string, string>;
  confirmDelete: boolean;
  /** Transient (not persisted): force the welcome screen even when a vault is set, so it can be
   *  revisited via Settings → Switch vault. */
  showWelcome: boolean;
  /** False until the initial saved-vault lookup completes. Gates the UI so we don't flash the
   *  welcome screen before we know whether a vault is saved. */
  vaultPathLoaded: boolean;

  setVaultPath: (path: string) => Promise<void>;
  createVault: (path: string) => Promise<void>;
  setShowWelcome: (value: boolean) => void;
  loadSavedVaultPath: () => Promise<void>;
  fetchFolderPaths: () => Promise<void>;
  setFolderPaths: (folderPaths: FolderPaths) => Promise<void>;
  fetchIsObsidianVault: () => Promise<void>;
  setIsObsidianVault: (value: boolean) => Promise<void>;
  loadPathOpeners: () => Promise<void>;
  refreshPathOpeners: () => Promise<void>;
  loadOpenerPrefs: () => Promise<void>;
  reorderOpeners: (ids: string[]) => Promise<void>;
  setOpenerHidden: (id: string, hidden: boolean) => Promise<void>;
  setDefaultOpener: (id: string | null) => Promise<void>;
  addCustomOpener: (opener: { name: string; command: string }) => Promise<void>;
  removeCustomOpener: (id: string) => Promise<void>;
  fetchTaskFormat: () => Promise<void>;
  setTaskFormat: (taskFormat: TaskFormat) => Promise<void>;
  detectTaskFormat: () => Promise<TaskFormatDetection>;
  dismissFormatPicker: () => void;
  fetchTaskMarker: () => Promise<void>;
  setTaskMarker: (marker: string) => Promise<void>;
  fetchInheritFrontmatterTags: () => Promise<void>;
  setInheritFrontmatterTags: (enabled: boolean) => Promise<void>;
  fetchRecurringTemplateCount: () => Promise<void>;
  fetchExcludedPaths: () => Promise<void>;
  addExcludedPath: (path: string) => Promise<void>;
  removeExcludedPath: (path: string) => Promise<void>;
  setTheme: (theme: ThemePreference) => void;
  setAccentColor: (color: string | null) => void;
  setKeybinding: (action: string, keys: string) => void;
  setConfirmDelete: (confirm: boolean) => void;
  clearError: () => void;
}

export const createSettingsSlice: SliceCreator<SettingsSlice> = (set, get) => ({
  vaultPath: null,
  isLoading: false,
  error: null,
  isObsidianVault: false,
  pathOpeners: [],
  openerPrefs: EMPTY_OPENER_PREFS,
  taskFormat: '',
  needsFormatPicker: false,
  taskMarkerTag: '',
  inheritFrontmatterTags: false,
  recurringTemplateCount: 0,
  folderPaths: DEFAULT_FOLDER_PATHS,
  excludedPaths: [],
  theme: persisted.theme,
  accentColor: persisted.accentColor,
  keybindings: persisted.keybindings,
  confirmDelete: persisted.confirmDelete,
  showWelcome: false,
  vaultPathLoaded: false,

  setVaultPath: (path: string) => loadVault(set, get, 'set_vault_path', path),
  createVault: (path: string) => loadVault(set, get, 'create_vault', path),
  setShowWelcome: (value: boolean) => set({ showWelcome: value }),

  loadSavedVaultPath: async () => {
    try {
      const path = await invoke<string | null>('get_vault_path');
      if (path) await get().setVaultPath(path);
    } catch (error) {
      console.error('Failed to load saved vault path:', error);
    } finally {
      // Mark the initial lookup done so the UI can stop holding the splash and decide between
      // the main app (vault found) and the welcome screen (genuine first run).
      set({ vaultPathLoaded: true });
    }
  },

  fetchFolderPaths: async () =>
    guardedFetch(set, () => invoke<FolderPaths>('get_folder_paths'), (folderPaths) => set({ folderPaths })),

  setFolderPaths: async (folderPaths: FolderPaths) => {
    try {
      const tasks = await invoke<Task[]>('set_folder_paths', { folderPaths });
      set({ tasks, folderPaths });
      get().fetchProjects();
      get().fetchPeople();
    } catch (error) {
      storeError(set, error);
    }
  },

  fetchIsObsidianVault: async () =>
    guardedFetch(set, () => invoke<boolean>('get_is_obsidian_vault'), (isObsidianVault) => set({ isObsidianVault })),

  setIsObsidianVault: async (value: boolean) => {
    try {
      await invoke('set_is_obsidian_vault', { value });
      set({ isObsidianVault: value });
      // Toggling Obsidian on makes Obsidian the default opener; toggling it off
      // clears that default (Obsidian is no longer a valid target).
      const prefs = get().openerPrefs;
      if (value && prefs.defaultId !== OBSIDIAN_APP_ID) {
        const openerPrefs = { ...prefs, defaultId: OBSIDIAN_APP_ID };
        set({ openerPrefs });
        await setOpenerPrefs(openerPrefs);
      } else if (!value && prefs.defaultId === OBSIDIAN_APP_ID) {
        const openerPrefs = { ...prefs, defaultId: null };
        set({ openerPrefs });
        await setOpenerPrefs(openerPrefs);
      }
    } catch (error) {
      storeError(set, error);
    }
  },

  loadPathOpeners: async () => {
    try {
      const pathOpeners = await detectOpeners();
      set({ pathOpeners });
    } catch (error) {
      console.error('Failed to detect path openers:', error);
    }
  },

  refreshPathOpeners: async () => {
    try {
      const pathOpeners = await refreshOpeners();
      set({ pathOpeners });
    } catch (error) {
      storeError(set, error);
    }
  },

  loadOpenerPrefs: async () => {
    try {
      const openerPrefs = await getOpenerPrefs();
      set({ openerPrefs });
    } catch (error) {
      console.error('Failed to load opener prefs:', error);
    }
  },

  // All "Open In" setters mutate local state optimistically, then persist to the
  // backend config. On a persist failure we surface the error but keep the
  // optimistic state (next load reconciles).
  reorderOpeners: async (ids: string[]) => {
    const openerPrefs = { ...get().openerPrefs, order: ids };
    set({ openerPrefs });
    try {
      await setOpenerPrefs(openerPrefs);
    } catch (error) {
      storeError(set, error);
    }
  },

  setOpenerHidden: async (id: string, hidden: boolean) => {
    const current = get().openerPrefs;
    const nextHidden = hidden
      ? (current.hidden.includes(id) ? current.hidden : [...current.hidden, id])
      : current.hidden.filter((h) => h !== id);
    const openerPrefs = { ...current, hidden: nextHidden };
    set({ openerPrefs });
    try {
      await setOpenerPrefs(openerPrefs);
    } catch (error) {
      storeError(set, error);
    }
  },

  setDefaultOpener: async (id: string | null) => {
    const openerPrefs = { ...get().openerPrefs, defaultId: id };
    set({ openerPrefs });
    try {
      await setOpenerPrefs(openerPrefs);
    } catch (error) {
      storeError(set, error);
    }
  },

  addCustomOpener: async ({ name, command }: { name: string; command: string }) => {
    const current = get().openerPrefs;
    const id = `custom-${crypto.randomUUID()}`;
    const openerPrefs = {
      ...current,
      custom: [...current.custom, { id, name, command }],
      // New custom openers lead the list so they're easy to find / immediately default.
      order: [id, ...current.order],
    };
    set({ openerPrefs });
    try {
      await setOpenerPrefs(openerPrefs);
    } catch (error) {
      storeError(set, error);
    }
  },

  removeCustomOpener: async (id: string) => {
    const current = get().openerPrefs;
    const openerPrefs = {
      ...current,
      custom: current.custom.filter((c) => c.id !== id),
      order: current.order.filter((o) => o !== id),
      hidden: current.hidden.filter((h) => h !== id),
    };
    set({ openerPrefs });
    try {
      await setOpenerPrefs(openerPrefs);
    } catch (error) {
      storeError(set, error);
    }
  },

  fetchTaskFormat: async () =>
    guardedFetch(set, () => invoke<string>('get_task_format'), (taskFormat) => set({ taskFormat, needsFormatPicker: taskFormat === '' })),

  setTaskFormat: async (taskFormat: TaskFormat) => {
    try {
      await invoke('set_task_format', { taskFormat });
      set({ taskFormat, needsFormatPicker: false });
    } catch (error) {
      storeError(set, error);
    }
  },

  detectTaskFormat: async () => {
    return await invoke<TaskFormatDetection>('detect_task_format');
  },

  dismissFormatPicker: () => set({ needsFormatPicker: false }),

  fetchTaskMarker: async () =>
    guardedFetch(set, () => invoke<string>('get_task_marker'), (taskMarkerTag) => set({ taskMarkerTag })),

  setTaskMarker: async (marker: string) => {
    try {
      // Changing the marker rescans (changes which checkboxes import).
      const tasks = await invoke<Task[]>('set_task_marker', { taskMarker: marker });
      set({ taskMarkerTag: normalizeTagInput(marker), tasks });
      // The imported set changed → refresh derived lists. In particular the marker tag
      // (e.g. #task) is stripped from imported tasks, so the sidebar tag list must be
      // refetched or it keeps showing a now-empty #task entry.
      get().fetchTags();
      get().fetchProjects();
      get().fetchPeople();
    } catch (error) {
      storeError(set, error);
    }
  },

  fetchInheritFrontmatterTags: async () =>
    guardedFetch(set, () => invoke<boolean>('get_inherit_frontmatter_tags'), (inheritFrontmatterTags) => set({ inheritFrontmatterTags })),

  setInheritFrontmatterTags: async (enabled: boolean) => {
    try {
      const tasks = await invoke<Task[]>('set_inherit_frontmatter_tags', { enabled });
      set({ inheritFrontmatterTags: enabled, tasks });
      get().fetchTags(); // inherited tags join the sidebar tag list/counts
    } catch (error) {
      storeError(set, error);
    }
  },

  fetchRecurringTemplateCount: async () => {
    const v = _vaultVersion;
    try {
      const count = await invoke<number>('get_recurring_template_count');
      if (_vaultVersion !== v) return;
      set({ recurringTemplateCount: count });
    } catch {
      // Non-fatal: just leave the count as-is (migration UI stays hidden).
    }
  },

  fetchExcludedPaths: async () =>
    guardedFetch(set, () => invoke<string[]>('get_excluded_paths'), (excludedPaths) => set({ excludedPaths })),

  addExcludedPath: async (path: string) => {
    try {
      const { excludedPaths } = get();
      if (excludedPaths.includes(path)) return;
      const newPaths = [...excludedPaths, path];
      const tasks = await invoke<Task[]>('set_excluded_paths', { excludedPaths: newPaths });
      await invoke('set_annado_exclude_in_file', { relativePath: path, exclude: true });
      set({ tasks, excludedPaths: newPaths });
    } catch (error) {
      storeError(set, error);
    }
  },

  removeExcludedPath: async (path: string) => {
    try {
      const { excludedPaths } = get();
      const newPaths = (excludedPaths as string[]).filter((p) => p !== path);
      const tasks = await invoke<Task[]>('set_excluded_paths', { excludedPaths: newPaths });
      set({ tasks, excludedPaths: newPaths });
      invoke('set_annado_exclude_in_file', { relativePath: path, exclude: false }).catch(() => {});
    } catch (error) {
      storeError(set, error);
    }
  },

  setTheme: (theme: ThemePreference) => {
    set({ theme });
    localStorage.setItem('theme', theme);
  },

  setAccentColor: (color: string | null) => {
    set({ accentColor: color });
    if (color) {
      localStorage.setItem('accentColor', color);
    } else {
      localStorage.removeItem('accentColor');
    }
  },

  setKeybinding: (action: string, keys: string) => {
    const keybindings = { ...get().keybindings, [action]: keys };
    set({ keybindings });
    persist('keybindings', keybindings);
  },

  setConfirmDelete: (confirm: boolean) => {
    set({ confirmDelete: confirm });
    persist('confirmDelete', confirm);
  },

  clearError: () => set({ error: null }),
});
