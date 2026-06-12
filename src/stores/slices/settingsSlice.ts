import { invoke } from '@tauri-apps/api/core';
import type { SliceCreator } from './types';
import { persist, storeError } from '../storeUtils';
import { KEYBINDING_DEFAULTS } from '../../utils/keybindings';
import type { FolderPaths, EditorType, Task, SmartList } from '../../types/task';

export type ThemePreference = 'light' | 'dark' | 'system';


const DEFAULT_FOLDER_PATHS: FolderPaths = {
  recurringTemplates: '12. System/recurring-tasks',
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

export interface SettingsSlice {
  vaultPath: string | null;
  isLoading: boolean;
  error: string | null;
  isObsidianVault: boolean;
  editorType: EditorType;
  editorCustomCommand: string;
  folderPaths: FolderPaths;
  excludedPaths: string[];
  theme: ThemePreference;
  /** Custom accent color (#rrggbb); null = default indigo from App.css */
  accentColor: string | null;
  keybindings: Record<string, string>;
  confirmDelete: boolean;

  setVaultPath: (path: string) => Promise<void>;
  loadSavedVaultPath: () => Promise<void>;
  fetchFolderPaths: () => Promise<void>;
  setFolderPaths: (folderPaths: FolderPaths) => Promise<void>;
  fetchIsObsidianVault: () => Promise<void>;
  setIsObsidianVault: (value: boolean) => Promise<void>;
  fetchEditorConfig: () => Promise<void>;
  setEditorConfig: (editorType: EditorType, customCommand: string) => Promise<void>;
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
  editorType: 'system' as EditorType,
  editorCustomCommand: '',
  folderPaths: DEFAULT_FOLDER_PATHS,
  excludedPaths: [],
  theme: persisted.theme,
  accentColor: persisted.accentColor,
  keybindings: persisted.keybindings,
  confirmDelete: persisted.confirmDelete,

  setVaultPath: async (path: string) => {
    _vaultVersion++;
    set({ isLoading: true, error: null });
    try {
      const tasks = await invoke<Task[]>('set_vault_path', { path });
      const storedLists = localStorage.getItem(`smartLists:${path}`);
      const smartLists: SmartList[] = storedLists ? JSON.parse(storedLists) : [];
      set({ tasks, vaultPath: path, isLoading: false, smartLists, selectedSmartListId: null });
      // Fire and forget — each fetch guards against stale vault via _vaultVersion
      get().fetchProjects();
      get().fetchPeople();
      get().fetchTags();
      get().fetchRecurringTemplates();
      get().fetchFolderPaths();
      get().fetchExcludedPaths();
      get().fetchIsObsidianVault();
      get().fetchEditorConfig();
    } catch (error) {
      storeError(set, error, { isLoading: false });
    }
  },

  loadSavedVaultPath: async () => {
    try {
      const path = await invoke<string | null>('get_vault_path');
      if (path) await get().setVaultPath(path);
    } catch (error) {
      console.error('Failed to load saved vault path:', error);
    }
  },

  fetchFolderPaths: async () => {
    const v = _vaultVersion;
    try {
      const folderPaths = await invoke<FolderPaths>('get_folder_paths');
      if (_vaultVersion !== v) return;
      set({ folderPaths });
    } catch (error) {
      if (_vaultVersion !== v) return;
      set({ error: String(error) });
    }
  },

  setFolderPaths: async (folderPaths: FolderPaths) => {
    try {
      const tasks = await invoke<Task[]>('set_folder_paths', { folderPaths });
      set({ tasks, folderPaths });
      get().fetchProjects();
      get().fetchPeople();
      get().fetchRecurringTemplates();
    } catch (error) {
      storeError(set, error);
    }
  },

  fetchIsObsidianVault: async () => {
    const v = _vaultVersion;
    try {
      const isObsidianVault = await invoke<boolean>('get_is_obsidian_vault');
      if (_vaultVersion !== v) return;
      set({ isObsidianVault });
    } catch (error) {
      if (_vaultVersion !== v) return;
      set({ error: String(error) });
    }
  },

  setIsObsidianVault: async (value: boolean) => {
    try {
      await invoke('set_is_obsidian_vault', { value });
      set({ isObsidianVault: value });
    } catch (error) {
      storeError(set, error);
    }
  },

  fetchEditorConfig: async () => {
    const v = _vaultVersion;
    try {
      const config = await invoke<{ editorType: string; editorCustomCommand: string }>('get_editor_config');
      if (_vaultVersion !== v) return;
      set({ editorType: config.editorType as EditorType, editorCustomCommand: config.editorCustomCommand });
    } catch (error) {
      if (_vaultVersion !== v) return;
      set({ error: String(error) });
    }
  },

  setEditorConfig: async (editorType: EditorType, customCommand: string) => {
    try {
      await invoke('set_editor_config', { editorType, editorCustomCommand: customCommand });
      set({ editorType, editorCustomCommand: customCommand });
    } catch (error) {
      storeError(set, error);
    }
  },

  fetchExcludedPaths: async () => {
    const v = _vaultVersion;
    try {
      const excludedPaths = await invoke<string[]>('get_excluded_paths');
      if (_vaultVersion !== v) return;
      set({ excludedPaths });
    } catch (error) {
      if (_vaultVersion !== v) return;
      set({ error: String(error) });
    }
  },

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
