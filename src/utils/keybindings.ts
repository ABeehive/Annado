export type ShortcutPlatform = 'macos' | 'windows' | 'other';

export function detectShortcutPlatform(): ShortcutPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('windows')) return 'windows';
  if (userAgent.includes('macintosh') || userAgent.includes('mac os')) return 'macos';
  return 'other';
}

export const SHORTCUT_PLATFORM = detectShortcutPlatform();

function normalizeKey(key: string): string {
  const normalized = key.toLowerCase();
  if (normalized === ' ') return 'space';
  if (normalized === 'esc') return 'escape';
  return normalized;
}

export function matchesKeybinding(e: KeyboardEvent | React.KeyboardEvent, binding: string): boolean {
  const parts = binding.toLowerCase().split('+');
  const key = parts.pop();
  const mods = new Set(parts);

  const modMatch =
    mods.has('meta') === e.metaKey &&
    mods.has('shift') === e.shiftKey &&
    mods.has('ctrl') === e.ctrlKey &&
    mods.has('alt') === e.altKey;

  return modMatch && normalizeKey(e.key) === normalizeKey(key ?? '');
}

export const MAC_KEYBINDING_DEFAULTS: Record<string, string> = {
  moveToProject: 'meta+shift+m', quickFind: 'meta+f', navigateDown: 'ctrl+j',
  navigateUp: 'ctrl+k', globalQuickAdd: 'meta+shift+space', globalShowApp: 'meta+shift+a',
  showWhen: 'meta+s', showDeadline: 'meta+d', startToday: 'meta+t',
  deleteTask: 'meta+backspace', completeTask: 'meta+k', toggleSidePanel: 'meta+\\',
  undo: 'meta+z',
  viewInbox: 'meta+1', viewToday: 'meta+2', viewAgenda: 'meta+3',
  viewUpcoming: 'meta+4', viewAnytime: 'meta+5', viewSomeday: 'meta+6',
  viewLogbook: 'meta+7', viewRecurring: 'meta+8', viewWrapped: 'meta+9',
  viewAddedToday: 'meta+0', viewReview: 'meta+r',
};

export const WINDOWS_KEYBINDING_DEFAULTS: Record<string, string> = {
  moveToProject: 'ctrl+shift+m', quickFind: 'ctrl+f', navigateDown: 'ctrl+j',
  navigateUp: 'ctrl+k', globalQuickAdd: 'ctrl+alt+space', globalShowApp: 'ctrl+alt+a',
  showWhen: 'ctrl+shift+s', showDeadline: 'ctrl+shift+d', startToday: 'ctrl+shift+t',
  deleteTask: 'ctrl+shift+backspace', completeTask: 'ctrl+enter', toggleSidePanel: 'ctrl+\\',
  undo: 'ctrl+z',
  viewInbox: 'ctrl+1', viewToday: 'ctrl+2', viewAgenda: 'ctrl+3',
  viewUpcoming: 'ctrl+4', viewAnytime: 'ctrl+5', viewSomeday: 'ctrl+6',
  viewLogbook: 'ctrl+7', viewRecurring: 'ctrl+8', viewWrapped: 'ctrl+9',
  viewAddedToday: 'ctrl+0', viewReview: 'ctrl+r',
};

export function getKeybindingDefaults(platform: ShortcutPlatform = SHORTCUT_PLATFORM): Record<string, string> {
  return platform === 'windows'
    ? { ...WINDOWS_KEYBINDING_DEFAULTS }
    : { ...MAC_KEYBINDING_DEFAULTS };
}

export const KEYBINDING_DEFAULTS: Record<string, string> = getKeybindingDefaults();

export function getPrimaryModifierBinding(platform: ShortcutPlatform = SHORTCUT_PLATFORM): 'meta' | 'ctrl' {
  return platform === 'macos' ? 'meta' : 'ctrl';
}

export function getPrimaryModifierLabel(platform: ShortcutPlatform = SHORTCUT_PLATFORM): string {
  return platform === 'macos' ? 'Cmd' : 'Ctrl';
}

export function matchesPrimaryShortcut(
  e: KeyboardEvent | React.KeyboardEvent,
  key: string,
  platform: ShortcutPlatform = SHORTCUT_PLATFORM,
): boolean {
  return matchesKeybinding(e, `${getPrimaryModifierBinding(platform)}+${key}`);
}

export function hasAnyShortcutModifier(e: KeyboardEvent | React.KeyboardEvent): boolean {
  // Centralized modifier guard for printable-key handlers.
  return e.metaKey || e.ctrlKey || e.altKey;
}

export function isMultiSelectModifier(e: KeyboardEvent | React.KeyboardEvent | React.MouseEvent): boolean {
  // Keep Cmd+Click on macOS and Ctrl+Click on Windows/Linux.
  return e.metaKey || e.ctrlKey;
}

export function formatKeybinding(
  binding: string,
  platform: ShortcutPlatform = SHORTCUT_PLATFORM,
): string[] {
  const macLabels: Record<string, string> = {
    meta: 'Cmd',
    shift: 'Shift',
    ctrl: 'Ctrl',
    alt: 'Option',
    space: 'Space',
    backspace: 'Backspace',
    enter: 'Enter',
    escape: 'Esc',
  };
  const windowsLabels: Record<string, string> = {
    meta: 'Win',
    shift: 'Shift',
    ctrl: 'Ctrl',
    alt: 'Alt',
    space: 'Space',
    backspace: 'Backspace',
    enter: 'Enter',
    escape: 'Esc',
  };
  const labels = platform === 'macos' ? macLabels : windowsLabels;

  return binding
    .toLowerCase()
    .split('+')
    .map(part => labels[part] ?? part.toUpperCase());
}

export function getFixedShortcutBindings(platform: ShortcutPlatform = SHORTCUT_PLATFORM) {
  const primary = getPrimaryModifierBinding(platform);
  return {
    newTask: `${primary}+n`,
    newRecurringTask: `${primary}+shift+r`,
    openSettings: `${primary}+,`,
  };
}
