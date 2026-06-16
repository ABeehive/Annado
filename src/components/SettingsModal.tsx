import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { getVersion } from '@tauri-apps/api/app';
import { useTaskStore } from '../stores/taskStore';
import { PROJECT_COLORS, DEFAULT_ACCENT } from '../utils/projectColors';
import { ScheduleBreak, DEFAULT_WORK_SCHEDULE } from '../features/agenda/types';
import { Toggle } from './Toggle';
import { KeybindingInput } from './KeybindingInput';
import { NotificationSettings } from '../features/notifications/NotificationSettings';
import { AboutSettings } from './AboutSettings';
import { getPathBaseName } from '../utils/obsidian';
import {
  formatKeybinding,
  getFixedShortcutBindings,
  getPrimaryModifierLabel,
  KEYBINDING_DEFAULTS,
} from '../utils/keybindings';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  group: string;
  items: { keys: string[]; description: string }[];
}

const fixedShortcuts = getFixedShortcutBindings();
const shortcutGroups: ShortcutGroup[] = [
  {
    group: 'Tasks',
    items: [
      { keys: formatKeybinding(fixedShortcuts.newTask), description: 'New task' },
      { keys: formatKeybinding(fixedShortcuts.newRecurringTask), description: 'New recurring task' },
      { keys: ['Enter'], description: 'Expand / collapse task' },
      { keys: [getPrimaryModifierLabel(), 'Click'], description: 'Multi-select tasks' },
    ],
  },
  {
    group: 'Agenda',
    items: [
      { keys: ['Left', 'Right'], description: 'Navigate day / week' },
      { keys: ['Shift', 'Left', 'Right'], description: 'Navigate by week' },
      { keys: ['T'], description: 'Jump to today' },
    ],
  },
  {
    group: 'App',
    items: [
      { keys: formatKeybinding(fixedShortcuts.openSettings), description: 'Open settings' },
      { keys: ['Esc'], description: 'Close panel / Deselect' },
      { keys: ['Type'], description: 'Quick Find (type anywhere)' },
    ],
  },
];

type SettingsTab = 'general' | 'calendar' | 'shortcuts' | 'notifications' | 'about';


export function SettingsModal({ isOpen, onClose }: SettingsProps) {
  const { vaultPath, setVaultPath, keybindings, setKeybinding, folderPaths, setFolderPaths, theme, setTheme, accentColor, setAccentColor, excludedPaths, addExcludedPath, removeExcludedPath, calendarEnabled, calendarSupported, detectCalendarSupport, setCalendarEnabled, availableCalendars, enabledCalendarNames, toggleCalendar, checkCalendarAccess, calendarAccessGranted, calendarError, calendarBlockingDefaults, setCalendarBlocking, workSchedule, setWorkSchedule, sidebarCounts, setSidebarCount, showProjectCounts, setShowProjectCounts, weekStartsOn, setWeekStartsOn, agendaShowWeekends, setAgendaShowWeekends, defaultTaskDuration, setDefaultTaskDuration, confirmDelete, setConfirmDelete, isObsidianVault, setIsObsidianVault, editorType, editorCustomCommand, setEditorConfig } = useTaskStore();
  const [isChangingVault, setIsChangingVault] = useState(false);
  const [localFolderPaths, setLocalFolderPaths] = useState(folderPaths);
  const [isSavingFolderPaths, setIsSavingFolderPaths] = useState(false);
  const [newExcludedPath, setNewExcludedPath] = useState('');
  const [calendarPermissionError, setCalendarPermissionError] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [appVersion, setAppVersion] = useState('0.1.0');

  // Real version from tauri.conf.json; the fallback covers non-Tauri contexts
  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) {
      void detectCalendarSupport();
    }
  }, [isOpen, detectCalendarSupport]);

  // Update local state when store changes
  useEffect(() => {
    setLocalFolderPaths(folderPaths);
  }, [folderPaths]);

  const handleFolderPathChange = (key: keyof typeof folderPaths, value: string) => {
    setLocalFolderPaths(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveFolderPaths = async () => {
    try {
      setIsSavingFolderPaths(true);
      await setFolderPaths(localFolderPaths);
    } catch (err) {
      console.error('Failed to save folder paths:', err);
    } finally {
      setIsSavingFolderPaths(false);
    }
  };

  const folderPathsChanged =
    localFolderPaths.recurringTemplates !== folderPaths.recurringTemplates ||
    localFolderPaths.projectsPattern !== folderPaths.projectsPattern ||
    localFolderPaths.areasPattern !== folderPaths.areasPattern ||
    localFolderPaths.personsPattern !== folderPaths.personsPattern ||
    localFolderPaths.dailyNotesFolder !== folderPaths.dailyNotesFolder ||
    localFolderPaths.dailyNotesFormat !== folderPaths.dailyNotesFormat ||
    localFolderPaths.taskMarkerTag !== folderPaths.taskMarkerTag;

  if (!isOpen) return null;

  const handleChangeVault = async () => {
    try {
      setIsChangingVault(true);
      const selected = await open({
        directory: true,
        title: 'Select your vault folder',
      });

      if (selected && typeof selected === 'string') {
        await setVaultPath(selected);
        onClose();
      }
    } catch (err) {
      console.error('Failed to change vault:', err);
    } finally {
      setIsChangingVault(false);
    }
  };

  const vaultName = vaultPath ? getPathBaseName(vaultPath) : 'Unknown';

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'about', label: 'About' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/8 dark:bg-black/25 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#2A2A2A] rounded-2xl shadow-xl shadow-black/8 dark:shadow-black/30 overflow-hidden">
        {/* Header */}
        <div className="border-b border-[#F0F0F0] dark:border-[#333]">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h2 className="text-[15px] font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              Settings
            </h2>
            <button
              onClick={onClose}
              className="text-[#C0C0C0] hover:text-[#888] dark:text-[#555] dark:hover:text-[#888] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex px-6 gap-5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary border-primary'
                    : 'text-[#AAAAAA] dark:text-[#666] border-transparent hover:text-[#777] dark:hover:text-[#999]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto">
          {/* ===== General Tab ===== */}
          {activeTab === 'general' && (
            <div className="px-7 py-6 space-y-8">
              {/* Vault Section */}
              <div>
                <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
                  Vault
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1A1A1A] dark:text-[#E8E8E8] truncate">
                        {vaultName}
                      </p>
                      <p className="text-[11px] text-[#AAAAAA] dark:text-[#666] truncate">
                        {vaultPath}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleChangeVault}
                    disabled={isChangingVault}
                    className="px-3 py-1.5 text-[12px] font-medium text-primary hover:bg-primary/8 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {isChangingVault ? 'Loading...' : 'Change'}
                  </button>
                </div>
              </div>

              {/* Vault Type Section */}
              <div>
                <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
                  Vault Type
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">This is an Obsidian vault</p>
                    <p className="text-[11px] text-[#B0B0B0] dark:text-[#555] mt-0.5">
                      {isObsidianVault
                        ? 'Auto-detected · .obsidian/ folder found. Enables wiki-links and Obsidian plugin config reading.'
                        : 'Enable to activate wiki-links, "Open in Obsidian" links, and Obsidian plugin config reading.'}
                    </p>
                  </div>
                  <Toggle checked={isObsidianVault} onChange={setIsObsidianVault} />
                </div>
              </div>

              {/* External Editor Section — only shown when not an Obsidian vault */}
              {!isObsidianVault && (
                <div>
                  <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
                    External Editor
                  </h3>
                  <div className="flex items-center bg-[#F5F5F5] dark:bg-[#333] rounded-full p-[3px] mb-3">
                    {(['system', 'vscode', 'sublime', 'custom'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setEditorConfig(type, editorCustomCommand)}
                        className={`flex-1 py-1 text-[12px] font-medium rounded-full transition-all ${
                          editorType === type
                            ? 'bg-white dark:bg-[#4A4A4A] text-[#1A1A1A] dark:text-[#E8E8E8] shadow-sm'
                            : 'text-[#999] dark:text-[#777] hover:text-[#666] dark:hover:text-[#AAA]'
                        }`}
                      >
                        {{ system: 'System', vscode: 'VS Code', sublime: 'Sublime', custom: 'Custom' }[type]}
                      </button>
                    ))}
                  </div>
                  {editorType === 'custom' && (
                    <div>
                      <input
                        type="text"
                        value={editorCustomCommand}
                        onChange={e => setEditorConfig('custom', e.target.value)}
                        placeholder="e.g. code --goto {file}:{line}"
                        className="w-full px-3 py-2 text-[13px] rounded-lg border border-[#E0E0E0] dark:border-[#3A3A3A] bg-white dark:bg-[#2A2A2A] text-[#1A1A1A] dark:text-[#E0E0E0] focus:outline-none focus:border-primary"
                      />
                      <p className="text-[11px] text-[#B0B0B0] dark:text-[#555] mt-1">
                        Use <code className="bg-[#F0F0F0] dark:bg-[#333] px-1 rounded">{'{file}'}</code> for the absolute path and <code className="bg-[#F0F0F0] dark:bg-[#333] px-1 rounded">{'{line}'}</code> for the line number.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Appearance Section */}
              <div>
                <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
                  Appearance
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">
                      Theme
                    </span>
                    <div className="flex items-center bg-[#F5F5F5] dark:bg-[#333] rounded-full p-[3px]">
                      {(['light', 'dark', 'system'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          className={`px-3.5 py-1 text-[12px] font-medium rounded-full transition-all ${
                            theme === t
                              ? 'bg-white dark:bg-[#4A4A4A] text-[#1A1A1A] dark:text-[#E8E8E8] shadow-sm'
                              : 'text-[#999] dark:text-[#777] hover:text-[#666] dark:hover:text-[#AAA]'
                          }`}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">Accent color</span>
                      <p className="text-[11px] text-[#AAAAAA] dark:text-[#666]">Used for checkboxes, links, and highlights</p>
                    </div>
                    <div className="grid grid-cols-10 gap-1.5">
                      {PROJECT_COLORS.map((color) => {
                        const isDefault = color === DEFAULT_ACCENT;
                        const isSelected = isDefault ? accentColor === null : accentColor === color;
                        return (
                          <button
                            key={color}
                            onClick={() => setAccentColor(isDefault ? null : color)}
                            title={isDefault ? 'Default (Indigo)' : color}
                            className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                              isSelected ? 'ring-2 ring-offset-2 ring-[#999] dark:ring-[#888] dark:ring-offset-[#1E1E1E]' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tasks Section */}
              <div>
                <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
                  Tasks
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">Default duration</span>
                      <p className="text-[11px] text-[#AAAAAA] dark:text-[#666]">Used in Agenda when a task has no duration set</p>
                    </div>
                    <div className="flex items-center bg-[#F5F5F5] dark:bg-[#333] rounded-full p-[3px]">
                      {([15, 30, 45, 60, 120] as const).map((min) => (
                        <button
                          key={min}
                          onClick={() => setDefaultTaskDuration(min)}
                          className={`px-3 py-1 text-[12px] font-medium rounded-full transition-all ${
                            defaultTaskDuration === min
                              ? 'bg-white dark:bg-[#4A4A4A] text-[#1A1A1A] dark:text-[#E8E8E8] shadow-sm'
                              : 'text-[#999] dark:text-[#777] hover:text-[#666] dark:hover:text-[#AAA]'
                          }`}
                        >
                          {min < 60 ? `${min}m` : `${min / 60}h`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">Confirm before deleting</span>
                      <p className="text-[11px] text-[#AAAAAA] dark:text-[#666]">Show a confirmation dialog when deleting a task</p>
                    </div>
                    <Toggle checked={confirmDelete} onChange={setConfirmDelete} />
                  </div>
                </div>
              </div>

              {/* Sidebar Counts Section */}
              <div>
                <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
                  Sidebar Counts
                </h3>
                <div className="space-y-1">
                  {([
                    { id: 'inbox', label: 'Inbox' },
                    { id: 'today', label: 'Today' },
                    { id: 'upcoming', label: 'Upcoming' },
                    { id: 'anytime', label: 'Anytime' },
                    { id: 'someday', label: 'Someday' },
                    { id: 'logbook', label: 'Logbook' },
                    { id: 'recurring', label: 'Recurring' },
                  ] as const).map((area) => (
                    <div key={area.id} className="flex items-center justify-between py-1.5">
                      <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">
                        {area.label}
                      </span>
                      <Toggle checked={!!sidebarCounts[area.id]} onChange={(v) => setSidebarCount(area.id, v)} />
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">
                      Projects
                    </span>
                    <Toggle checked={showProjectCounts} onChange={setShowProjectCounts} />
                  </div>
                </div>
              </div>

              {/* Excluded Files & Folders Section */}
              <div>
                <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
                  Excluded Files & Folders
                </h3>
                <div className="space-y-2.5">
                  {excludedPaths.length > 0 && (
                    <div className="space-y-1.5">
                      {excludedPaths.map((path) => (
                        <div key={path} className="flex items-center justify-between py-1.5 px-3 bg-[#FAFAFA] dark:bg-[#2F2F2F] rounded-lg">
                          <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] truncate mr-2">{path}</span>
                          <button
                            onClick={() => removeExcludedPath(path)}
                            className="text-[#C8C8C8] hover:text-danger dark:text-[#555] dark:hover:text-[#EF5350] transition-colors flex-shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newExcludedPath}
                      onChange={(e) => setNewExcludedPath(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newExcludedPath.trim()) {
                          addExcludedPath(newExcludedPath.trim());
                          setNewExcludedPath('');
                        }
                      }}
                      className="flex-1 px-3 py-2 text-[13px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#C0C0C0] dark:placeholder-[#555] focus:outline-none focus:border-primary/40 transition-colors"
                      placeholder="Shopping List.md"
                    />
                    <button
                      onClick={() => {
                        if (newExcludedPath.trim()) {
                          addExcludedPath(newExcludedPath.trim());
                          setNewExcludedPath('');
                        }
                      }}
                      className="text-[12px] font-medium text-primary hover:text-[#4A5AB8] px-2 py-1.5 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <p className="text-[11px] text-[#B0B0B0] dark:text-[#555]">
                    Paths relative to vault root. Files will also get <code className="bg-[#F5F5F5] dark:bg-[#333] px-1 rounded">annado_exclude: true</code> in their frontmatter.
                  </p>
                </div>
              </div>

              {/* Task Parsing Section */}
              <div>
                <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
                  Task Parsing
                </h3>
                <div>
                  <label className="block text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] mb-1.5">
                    Task Marker Tag
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#888] dark:text-[#777]">#</span>
                    <input
                      type="text"
                      value={localFolderPaths.taskMarkerTag}
                      onChange={(e) =>
                        handleFolderPathChange('taskMarkerTag', e.target.value.replace(/^#/, ''))
                      }
                      className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#C0C0C0] dark:placeholder-[#555] focus:outline-none focus:border-primary/40 transition-colors"
                      placeholder="task"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#B0B0B0] dark:text-[#555]">
                    Only top-level checkboxes with this tag are imported. Leave blank to import every top-level checkbox.
                  </p>
                </div>
              </div>

              {/* Folder Paths Section */}
              <div>
                <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
                  Folder Paths
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] mb-1.5">
                      Recurring Templates Folder
                    </label>
                    <input
                      type="text"
                      value={localFolderPaths.recurringTemplates}
                      onChange={(e) => handleFolderPathChange('recurringTemplates', e.target.value)}
                      className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#C0C0C0] dark:placeholder-[#555] focus:outline-none focus:border-primary/40 transition-colors"
                      placeholder="12. System/recurring-tasks"
                    />
                    <p className="mt-1.5 text-[11px] text-[#B0B0B0] dark:text-[#555]">
                      Relative path from vault root where recurring task templates are stored
                    </p>
                  </div>
                  <div>
                    <label className="block text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] mb-1.5">
                      Projects Folder Pattern
                    </label>
                    <input
                      type="text"
                      value={localFolderPaths.projectsPattern}
                      onChange={(e) => handleFolderPathChange('projectsPattern', e.target.value)}
                      className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#C0C0C0] dark:placeholder-[#555] focus:outline-none focus:border-primary/40 transition-colors"
                      placeholder="Projects"
                    />
                    <p className="mt-1.5 text-[11px] text-[#B0B0B0] dark:text-[#555]">
                      Text pattern to match in folder paths for projects (e.g., "Projects" or "02. Projects")
                    </p>
                  </div>
                  <div>
                    <label className="block text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] mb-1.5">
                      Areas Folder Pattern
                    </label>
                    <input
                      type="text"
                      value={localFolderPaths.areasPattern}
                      onChange={(e) => handleFolderPathChange('areasPattern', e.target.value)}
                      className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#C0C0C0] dark:placeholder-[#555] focus:outline-none focus:border-primary/40 transition-colors"
                      placeholder="Areas"
                    />
                    <p className="mt-1.5 text-[11px] text-[#B0B0B0] dark:text-[#555]">
                      Text pattern to match in folder paths for areas (e.g., "Areas" or "01. Areas"). Leave blank to disable.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] mb-1.5">
                      Persons Folder Pattern
                    </label>
                    <input
                      type="text"
                      value={localFolderPaths.personsPattern}
                      onChange={(e) => handleFolderPathChange('personsPattern', e.target.value)}
                      className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#C0C0C0] dark:placeholder-[#555] focus:outline-none focus:border-primary/40 transition-colors"
                      placeholder="Persons"
                    />
                    <p className="mt-1.5 text-[11px] text-[#B0B0B0] dark:text-[#555]">
                      Text pattern to match in folder paths for persons (e.g., "Persons" or "01. Persons")
                    </p>
                  </div>
                  <div>
                    <label className="block text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] mb-1.5">
                      Daily Notes Folder
                    </label>
                    <input
                      type="text"
                      value={localFolderPaths.dailyNotesFolder}
                      onChange={(e) => handleFolderPathChange('dailyNotesFolder', e.target.value)}
                      className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#C0C0C0] dark:placeholder-[#555] focus:outline-none focus:border-primary/40 transition-colors"
                      placeholder="00. Daily Notes"
                    />
                    <p className="mt-1.5 text-[11px] text-[#B0B0B0] dark:text-[#555]">
                      Relative path from vault root where daily notes are stored
                    </p>
                  </div>
                  <div>
                    <label className="block text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] mb-1.5">
                      Daily Notes Format
                    </label>
                    <input
                      type="text"
                      value={localFolderPaths.dailyNotesFormat}
                      onChange={(e) => handleFolderPathChange('dailyNotesFormat', e.target.value)}
                      className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#C0C0C0] dark:placeholder-[#555] focus:outline-none focus:border-primary/40 transition-colors"
                      placeholder="YYYY/MM-MMMM/YYYY-MM-DD"
                    />
                    <p className="mt-1.5 text-[11px] text-[#B0B0B0] dark:text-[#555]">
                      Moment.js date format — can include / for subfolders. Tokens: YYYY, MM, MMMM, DD, etc.
                      {isObsidianVault && ' · Overridden by .obsidian/daily-notes.json if present.'}
                    </p>
                  </div>
                  {folderPathsChanged && (
                    <button
                      onClick={handleSaveFolderPaths}
                      disabled={isSavingFolderPaths}
                      className="w-full px-4 py-2 text-[13px] font-medium text-white bg-primary hover:bg-[#4A5AB8] rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isSavingFolderPaths ? 'Saving...' : 'Save Task & Folder Settings'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== Calendar Tab ===== */}
          {activeTab === 'calendar' && (
            <div className="px-7 py-6 space-y-8">
              {/* Week Section */}
              <div>
                <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
                  Week
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">Week starts on</span>
                    <div className="flex items-center bg-[#F5F5F5] dark:bg-[#333] rounded-full p-[3px]">
                      {(['monday', 'sunday'] as const).map((day) => (
                        <button
                          key={day}
                          onClick={() => setWeekStartsOn(day)}
                          className={`px-3.5 py-1 text-[12px] font-medium rounded-full transition-all ${
                            weekStartsOn === day
                              ? 'bg-white dark:bg-[#4A4A4A] text-[#1A1A1A] dark:text-[#E8E8E8] shadow-sm'
                              : 'text-[#999] dark:text-[#777] hover:text-[#666] dark:hover:text-[#AAA]'
                          }`}
                        >
                          {day.charAt(0).toUpperCase() + day.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <div>
                      <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">Show weekends in Agenda</span>
                      <p className="text-[11px] text-[#AAAAAA] dark:text-[#666]">Show Saturday and Sunday in the week view</p>
                    </div>
                    <Toggle checked={agendaShowWeekends} onChange={setAgendaShowWeekends} />
                  </div>
                </div>
              </div>

              {/* Calendar Section */}
              <div>
              <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
                Calendar
              </h3>
              <div className="space-y-3">
                {!calendarSupported ? (
                  <div className="text-[12px] text-[#777] dark:text-[#999] bg-[#F7F7F7] dark:bg-[#333] px-3 py-2 rounded-lg">
                    Calendar events are only available on macOS. Schedule settings below still control auto-scheduling.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">
                        Show Calendar Events
                      </span>
                      <Toggle
                        checked={calendarEnabled}
                        onClick={async () => {
                          if (!calendarEnabled) {
                            const granted = await checkCalendarAccess();
                            if (granted) { setCalendarPermissionError(false); setCalendarEnabled(true); }
                            else { setCalendarPermissionError(true); }
                          } else {
                            setCalendarEnabled(false);
                            setCalendarPermissionError(false);
                          }
                        }}
                      />
                    </div>

                    {calendarPermissionError && (
                      <div className="text-[12px] text-danger bg-danger/8 px-3 py-2 rounded-lg">
                        {calendarError ?? 'Calendar access denied. Go to System Settings > Privacy & Security > Calendars and enable access for Annado.'}
                      </div>
                    )}

                    {calendarEnabled && calendarAccessGranted && availableCalendars.length > 0 && (
                      <div className="space-y-1 mt-1">
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center justify-between text-[11px] text-[#B0B0B0] dark:text-[#555]">
                            <span>Calendars</span>
                            <span>Blocks</span>
                          </div>
                          <p className="text-[11px] text-[#B0B0B0] dark:text-[#555] leading-relaxed">
                            When <strong className="font-medium">Blocks</strong> is on, events in that calendar are treated as busy time - Annado won't auto-schedule tasks during them.
                          </p>
                        </div>
                        {availableCalendars.map((cal) => {
                          const isEnabled = enabledCalendarNames.includes(cal.name);
                          const isBlocking = calendarBlockingDefaults[cal.name] ?? true;
                          return (
                            <div
                              key={cal.id}
                              className="flex items-center gap-2.5 py-1.5 px-1.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] rounded-lg"
                            >
                              {/* Visibility checkbox */}
                              <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={() => toggleCalendar(cal.name)}
                                  className="sr-only"
                                />
                                <div
                                  className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                                    isEnabled
                                      ? 'border-transparent'
                                      : 'border-[#D8D8D8] dark:border-[#555]'
                                  }`}
                                  style={isEnabled ? { background: cal.color } : {}}
                                >
                                  {isEnabled && (
                                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                <div
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ background: cal.color }}
                                />
                                <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] truncate">
                                  {cal.name}
                                </span>
                              </label>

                              {/* Blocking toggle - only shown when calendar is enabled */}
                              {isEnabled && (
                                <Toggle
                                  checked={isBlocking}
                                  onChange={(v) => setCalendarBlocking(cal.name, v)}
                                  title={isBlocking ? 'Blocks auto-scheduling' : 'Does not block auto-scheduling'}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {calendarEnabled && calendarAccessGranted && availableCalendars.length === 0 && (
                      <div className="text-[12px] text-[#B0B0B0] dark:text-[#555]">
                        No calendars found. Make sure Calendar.app has calendars configured.
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── Schedule Section ── */}
              <div className="mt-7">
                <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
                  Schedule
                </h3>

                {/* Work Days */}
                <div className="space-y-1.5">
                  {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((dayKey) => {
                    const dayLabels: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
                    const day = workSchedule.days[dayKey] ?? DEFAULT_WORK_SCHEDULE.days[dayKey];
                    return (
                      <div key={dayKey} className="flex items-center gap-3 py-1.5 px-1.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] rounded-lg">
                        {/* Toggle */}
                        <Toggle
                          checked={day.enabled}
                          onChange={(v) => {
                            const newDays = { ...workSchedule.days, [dayKey]: { ...day, enabled: v } };
                            setWorkSchedule({ ...workSchedule, days: newDays });
                          }}
                        />
                        {/* Day label */}
                        <span className={`text-[13px] w-8 ${day.enabled ? 'text-[#1A1A1A] dark:text-[#E0E0E0]' : 'text-[#B0B0B0] dark:text-[#555]'}`}>
                          {dayLabels[dayKey]}
                        </span>
                        {/* Time inputs */}
                        {day.enabled && (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <input
                              type="time"
                              value={day.startTime}
                              step={900}
                              onChange={(e) => {
                                const newDays = { ...workSchedule.days, [dayKey]: { ...day, startTime: e.target.value } };
                                setWorkSchedule({ ...workSchedule, days: newDays });
                              }}
                              className="px-1.5 py-0.5 text-[12px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] focus:outline-none focus:border-primary/40 transition-colors"
                            />
                            <span className="text-[11px] text-[#B0B0B0] dark:text-[#555]">to</span>
                            <input
                              type="time"
                              value={day.endTime}
                              step={900}
                              onChange={(e) => {
                                const newDays = { ...workSchedule.days, [dayKey]: { ...day, endTime: e.target.value } };
                                setWorkSchedule({ ...workSchedule, days: newDays });
                              }}
                              className="px-1.5 py-0.5 text-[12px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] focus:outline-none focus:border-primary/40 transition-colors"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Breaks */}
                <div className="mt-4">
                  <div className="text-[11px] text-[#B0B0B0] dark:text-[#555] mb-2">Breaks</div>
                  <div className="space-y-1.5">
                    {workSchedule.breaks.map((brk) => (
                      <div key={brk.id} className="py-1.5 px-1.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] rounded-lg">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={brk.name}
                            onChange={(e) => {
                              const newBreaks = workSchedule.breaks.map(b => b.id === brk.id ? { ...b, name: e.target.value } : b);
                              setWorkSchedule({ ...workSchedule, breaks: newBreaks });
                            }}
                            className="w-24 px-1.5 py-0.5 text-[12px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#C0C0C0] dark:placeholder-[#555] focus:outline-none focus:border-primary/40 transition-colors"
                            placeholder="Break name"
                          />
                          <input
                            type="time"
                            value={brk.startTime}
                            step={900}
                            onChange={(e) => {
                              const newBreaks = workSchedule.breaks.map(b => b.id === brk.id ? { ...b, startTime: e.target.value } : b);
                              setWorkSchedule({ ...workSchedule, breaks: newBreaks });
                            }}
                            className="px-1.5 py-0.5 text-[12px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] focus:outline-none focus:border-primary/40 transition-colors"
                          />
                          <span className="text-[11px] text-[#B0B0B0] dark:text-[#555]">to</span>
                          <input
                            type="time"
                            value={brk.endTime}
                            step={900}
                            onChange={(e) => {
                              const newBreaks = workSchedule.breaks.map(b => b.id === brk.id ? { ...b, endTime: e.target.value } : b);
                              setWorkSchedule({ ...workSchedule, breaks: newBreaks });
                            }}
                            className="px-1.5 py-0.5 text-[12px] bg-transparent border-b border-[#E8E8E8] dark:border-[#3A3A3A] text-[#1A1A1A] dark:text-[#E0E0E0] focus:outline-none focus:border-primary/40 transition-colors"
                          />
                          <button
                            onClick={() => {
                              const newBreaks = workSchedule.breaks.filter(b => b.id !== brk.id);
                              setWorkSchedule({ ...workSchedule, breaks: newBreaks });
                            }}
                            className="text-[#C8C8C8] hover:text-danger dark:text-[#555] dark:hover:text-[#EF5350] transition-colors flex-shrink-0 ml-auto"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex items-center gap-1 mt-1 ml-0.5">
                          {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => {
                            const labels: Record<string, string> = { mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S' };
                            const activeDays = brk.days && brk.days.length > 0 ? brk.days : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
                            const isActive = activeDays.includes(day);
                            return (
                              <button
                                key={day}
                                onClick={() => {
                                  const current = brk.days && brk.days.length > 0 ? [...brk.days] : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
                                  const next = isActive ? current.filter(d => d !== day) : [...current, day];
                                  const newBreaks = workSchedule.breaks.map(b => b.id === brk.id ? { ...b, days: next } : b);
                                  setWorkSchedule({ ...workSchedule, breaks: newBreaks });
                                }}
                                className={`flex items-center justify-center rounded-full transition-colors`}
                                style={{ width: 18, height: 18, fontSize: 9, lineHeight: 1 }}
                              >
                                <span className={isActive ? 'text-white' : 'text-[#B0B0B0] dark:text-[#555]'} style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 18, height: 18, borderRadius: '50%',
                                  backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                                  fontWeight: 500,
                                }}>
                                  {labels[day]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const newBreak: ScheduleBreak = {
                        id: String(Date.now()),
                        name: '',
                        startTime: '12:00',
                        endTime: '13:00',
                      };
                      setWorkSchedule({ ...workSchedule, breaks: [...workSchedule.breaks, newBreak] });
                    }}
                    className="text-[12px] font-medium text-primary hover:text-[#4A5AB8] px-1.5 py-1.5 transition-colors mt-1"
                  >
                    Add break
                  </button>
                </div>
              </div>
              </div>{/* end Calendar section */}
            </div>
          )}

          {/* ===== Shortcuts Tab ===== */}
          {activeTab === 'shortcuts' && (
            <div className="px-7 py-6 space-y-8">
              {/* Fixed Keyboard Shortcuts Section */}
              <div>
                <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-4">
                  Keyboard Shortcuts
                </h3>
                <div className="space-y-5">
                  {shortcutGroups.map((group) => (
                    <div key={group.group}>
                      <p className="text-[10px] font-medium text-[#C8C8C8] dark:text-[#4A4A4A] uppercase tracking-wider mb-1.5">{group.group}</p>
                      <div className="space-y-0.5">
                        {group.items.map((shortcut, index) => (
                          <div key={index} className="flex items-center justify-between py-1.5">
                            <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">{shortcut.description}</span>
                            <div className="flex items-center gap-1">
                              {shortcut.keys.map((key, keyIndex) => (
                                <kbd
                                  key={keyIndex}
                                  className="min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-[10px] font-medium text-[#777] dark:text-[#999] bg-[#F5F5F5] dark:bg-[#333] rounded-[5px] border border-[#E0E0E0] dark:border-[#444]"
                                >
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customizable Shortcuts Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider">
                    Customizable Shortcuts
                  </h3>
                  <button
                    onClick={() => {
                      for (const [action, keys] of Object.entries(KEYBINDING_DEFAULTS)) {
                        setKeybinding(action, keys);
                      }
                    }}
                    className="text-[11px] font-medium text-[#AAAAAA] dark:text-[#555] hover:text-primary dark:hover:text-primary transition-colors"
                  >
                    Reset all to defaults
                  </button>
                </div>
                {(() => {
                  const renderRow = ({ action, label, hint }: { action: string; label: string; hint?: string }) => {
                    const isCustomized = keybindings[action] && keybindings[action] !== KEYBINDING_DEFAULTS[action];
                    return (
                      <div key={action} className="group flex items-center justify-between py-1.5">
                        <div>
                          <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">{label}</span>
                          {hint && <p className="text-[11px] text-[#B0B0B0] dark:text-[#555]">{hint}</p>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isCustomized && (
                            <button
                              onClick={() => setKeybinding(action, KEYBINDING_DEFAULTS[action])}
                              title="Reset to default"
                              className="opacity-0 group-hover:opacity-100 text-[#C0C0C0] hover:text-[#888] dark:text-[#555] dark:hover:text-[#888] transition-all"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                              </svg>
                            </button>
                          )}
                          <KeybindingInput
                            value={keybindings[action] || KEYBINDING_DEFAULTS[action]}
                            onChange={(keys) => setKeybinding(action, keys)}
                          />
                        </div>
                      </div>
                    );
                  };
                  return (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-medium text-[#C8C8C8] dark:text-[#4A4A4A] uppercase tracking-wider mb-1.5">Navigation</p>
                        <div className="space-y-0.5">
                          {([
                            { action: 'viewInbox', label: 'Open Inbox' },
                            { action: 'viewToday', label: 'Open Today' },
                            { action: 'viewAgenda', label: 'Open Agenda' },
                            { action: 'viewUpcoming', label: 'Open Upcoming' },
                            { action: 'viewAnytime', label: 'Open Anytime' },
                            { action: 'viewSomeday', label: 'Open Someday' },
                            { action: 'viewLogbook', label: 'Open Logbook' },
                            { action: 'viewRecurring', label: 'Open Recurring' },
                            { action: 'viewWrapped', label: 'Open Wrapped' },
                            { action: 'viewAddedToday', label: 'Open Added Today' },
                            { action: 'viewReview', label: 'Open Review' },
                          ] as { action: string; label: string }[]).map(renderRow)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-[#C8C8C8] dark:text-[#4A4A4A] uppercase tracking-wider mb-1.5">Actions</p>
                        <div className="space-y-0.5">
                          {([
                            { action: 'quickFind', label: 'Quick Find' },
                            { action: 'navigateDown', label: 'Navigate down' },
                            { action: 'navigateUp', label: 'Navigate up' },
                            { action: 'moveToProject', label: 'Move to project' },
                            { action: 'globalQuickAdd', label: 'Global Quick Add', hint: 'Works system-wide while app is running' },
                            { action: 'globalShowApp', label: 'Show App', hint: 'Works system-wide while app is running' },
                            { action: 'showWhen', label: 'Show When' },
                            { action: 'showDeadline', label: 'Show Deadline' },
                            { action: 'startToday', label: 'Start Today' },
                            { action: 'deleteTask', label: 'Delete Task' },
                            { action: 'completeTask', label: 'Complete Task' },
                            { action: 'undo', label: 'Undo', hint: 'Reverts the last task change' },
                            { action: 'toggleSidePanel', label: 'Toggle Side Panel' },
                          ] as { action: string; label: string; hint?: string }[]).map(renderRow)}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ===== Notifications Tab ===== */}
          {activeTab === 'notifications' && <NotificationSettings />}

          {/* ===== About Tab ===== */}
          {activeTab === 'about' && <AboutSettings version={appVersion} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#F0F0F0] dark:border-[#333]">
          <p className="text-[11px] text-[#C0C0C0] dark:text-[#555] text-center">
            Annado v{appVersion}
          </p>
        </div>
      </div>
    </div>
  );
}
