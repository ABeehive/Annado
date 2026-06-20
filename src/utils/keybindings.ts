export function matchesKeybinding(e: KeyboardEvent | React.KeyboardEvent, binding: string): boolean {
  const parts = binding.toLowerCase().split('+');
  const key = parts.pop();
  const mods = new Set(parts);

  const modMatch =
    mods.has('meta') === e.metaKey &&
    mods.has('shift') === e.shiftKey &&
    mods.has('ctrl') === e.ctrlKey &&
    mods.has('alt') === e.altKey;

  return modMatch && e.key.toLowerCase() === key;
}

export const KEYBINDING_DEFAULTS: Record<string, string> = {
  moveToProject: 'meta+shift+m', quickFind: 'meta+f', navigateDown: 'ctrl+j',
  navigateUp: 'ctrl+k', globalQuickAdd: 'meta+shift+space', globalShowApp: 'meta+shift+a',
  showWhen: 'meta+s', showDeadline: 'meta+d', startToday: 'meta+t',
  deleteTask: 'meta+backspace', completeTask: 'meta+k', toggleSidePanel: 'meta+\\',
  undo: 'meta+z', selectAll: 'meta+a',
  viewInbox: 'meta+1', viewToday: 'meta+2', viewAgenda: 'meta+3',
  viewUpcoming: 'meta+4', viewAnytime: 'meta+5', viewSomeday: 'meta+6',
  viewLogbook: 'meta+7', viewRecurring: 'meta+8', viewWrapped: 'meta+9',
  viewAddedToday: 'meta+0', viewReview: 'meta+r',
};
