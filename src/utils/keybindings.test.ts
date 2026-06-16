import { describe, expect, it } from 'vitest';
import {
  formatKeybinding,
  getFixedShortcutBindings,
  getKeybindingDefaults,
  matchesPrimaryShortcut,
  matchesKeybinding,
} from './keybindings';

describe('platform keybindings', () => {
  it('uses Ctrl and Ctrl+Alt defaults on Windows', () => {
    const defaults = getKeybindingDefaults('windows');

    expect(defaults.quickFind).toBe('ctrl+f');
    expect(defaults.completeTask).toBe('ctrl+enter');
    expect(defaults.viewReview).toBe('ctrl+r');
    expect(defaults.viewReview).not.toBe(getFixedShortcutBindings('windows').newRecurringTask);
    expect(defaults.globalQuickAdd).toBe('ctrl+alt+space');
    expect(defaults.globalShowApp).toBe('ctrl+alt+a');
  });

  it('formats modifier labels for macOS and Windows', () => {
    expect(formatKeybinding('meta+shift+a', 'macos')).toEqual(['Cmd', 'Shift', 'A']);
    expect(formatKeybinding('meta+shift+a', 'windows')).toEqual(['Win', 'Shift', 'A']);
    expect(formatKeybinding('ctrl+alt+space', 'windows')).toEqual(['Ctrl', 'Alt', 'Space']);
  });

  it('matches space key bindings using normalized key names', () => {
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      ctrlKey: true,
      altKey: true,
    });

    expect(matchesKeybinding(event, 'ctrl+alt+space')).toBe(true);
  });

  it('uses platform primary modifiers for fixed shortcuts', () => {
    expect(getFixedShortcutBindings('macos').newTask).toBe('meta+n');
    expect(getFixedShortcutBindings('windows').newTask).toBe('ctrl+n');
    expect(getFixedShortcutBindings('windows').newRecurringTask).toBe('ctrl+shift+r');

    const windowsEvent = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true });
    const macEvent = new KeyboardEvent('keydown', { key: 'n', metaKey: true });

    expect(matchesPrimaryShortcut(windowsEvent, 'n', 'windows')).toBe(true);
    expect(matchesPrimaryShortcut(macEvent, 'n', 'macos')).toBe(true);
    expect(matchesPrimaryShortcut(macEvent, 'n', 'windows')).toBe(false);
  });
});
