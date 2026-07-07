import { describe, it, expect, vi } from 'vitest';

// pathOpener.ts imports the Tauri bridge at module load.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import {
  effectiveOpeners,
  effectiveDefault,
  settingsTargets,
  OBSIDIAN_APP_ID,
  EMPTY_OPENER_PREFS,
  type PathOpenerInfo,
  type OpenerPrefs,
} from './pathOpener';

const obsidian: PathOpenerInfo = {
  appId: OBSIDIAN_APP_ID, name: 'Obsidian', acceptsDirectories: true,
  fileSupport: { kind: 'extensions', extensions: ['md'] },
};
const vscode: PathOpenerInfo = {
  appId: 'vscode', name: 'VS Code', acceptsDirectories: true, fileSupport: { kind: 'any' },
};
const finder: PathOpenerInfo = {
  appId: 'finder', name: 'Finder', acceptsDirectories: true, fileSupport: { kind: 'not_supported' },
};
const detected = [obsidian, vscode, finder];
const MD = '/vault/Note.md';

const prefs = (p: Partial<OpenerPrefs> = {}): OpenerPrefs => ({ ...EMPTY_OPENER_PREFS, ...p });
const ids = (list: { id: string }[]) => list.map((e) => e.id);

describe('effectiveOpeners (AC-2/3/4/6/7)', () => {
  it('returns only path-usable, non-hidden openers; Obsidian present when the vault is an Obsidian vault', () => {
    // finder is not_supported for a file with an extension → excluded.
    expect(ids(effectiveOpeners(detected, prefs(), true, MD))).toEqual(['obsidian', 'vscode']);
  });

  it('drops Obsidian when not an Obsidian vault (AC-6)', () => {
    expect(ids(effectiveOpeners(detected, prefs(), false, MD))).toEqual(['vscode']);
  });

  it('hides ids listed in prefs.hidden (AC-3)', () => {
    expect(ids(effectiveOpeners(detected, prefs({ hidden: ['vscode'] }), true, MD))).toEqual(['obsidian']);
  });

  it('respects prefs.order (AC-4)', () => {
    expect(ids(effectiveOpeners(detected, prefs({ order: ['vscode', 'obsidian'] }), true, MD)))
      .toEqual(['vscode', 'obsidian']);
  });

  it('includes custom openers and honors order across custom + detected (AC-5)', () => {
    const p = prefs({
      custom: [{ id: 'custom-1', name: 'My Script', command: 'sh {file}' }],
      order: ['obsidian', 'custom-1', 'vscode'],
    });
    expect(ids(effectiveOpeners(detected, p, true, MD))).toEqual(['obsidian', 'custom-1', 'vscode']);
  });

  it('promotes Obsidian to the front in an Obsidian vault when the user has not ordered it', () => {
    // Without an explicit order, custom entries normally come first — Obsidian
    // still wins in an Obsidian vault.
    const p = prefs({ custom: [{ id: 'custom-1', name: 'My Script', command: 'sh {file}' }] });
    expect(ids(effectiveOpeners(detected, p, true, MD))).toEqual(['obsidian', 'custom-1', 'vscode']);
  });

  it('does not promote Obsidian once the user positioned it in prefs.order', () => {
    const p = prefs({ order: ['vscode', 'obsidian'] });
    expect(ids(effectiveOpeners(detected, p, true, MD))).toEqual(['vscode', 'obsidian']);
  });
});

describe('Obsidian as automatic default in Obsidian vaults', () => {
  it('effectiveDefault picks Obsidian when no explicit default is set', () => {
    const p = prefs({ custom: [{ id: 'custom-1', name: 'My Script', command: 'sh {file}' }] });
    expect(effectiveDefault(detected, p, true, MD)?.id).toBe(OBSIDIAN_APP_ID);
  });

  it('an explicit defaultId still beats the Obsidian promotion', () => {
    const p = prefs({ defaultId: 'vscode' });
    expect(effectiveDefault(detected, p, true, MD)?.id).toBe('vscode');
  });

  it('settingsTargets lists Obsidian first in an Obsidian vault', () => {
    const p = prefs({ custom: [{ id: 'custom-1', name: 'My Script', command: 'sh {file}' }] });
    expect(ids(settingsTargets(detected, p, true))[0]).toBe(OBSIDIAN_APP_ID);
  });
});

describe('effectiveDefault (AC-4/7)', () => {
  it('is the first effective opener', () => {
    // The settings list writes the full id list on reorder, so a user-chosen
    // order always positions Obsidian too (which disables its promotion).
    expect(effectiveDefault(detected, prefs({ order: ['vscode', 'obsidian'] }), true, MD)?.id).toBe('vscode');
  });

  it('is null when no usable+visible opener exists (caller falls back to OS default)', () => {
    // Only finder, which cannot open a file with an extension.
    expect(effectiveDefault([finder], prefs(), true, MD)).toBeNull();
  });

  it('honors an explicitly chosen default when it is visible + usable', () => {
    const p = prefs({ defaultId: 'vscode', order: ['obsidian', 'vscode'] });
    expect(effectiveDefault(detected, p, true, MD)?.id).toBe('vscode');
  });

  it('falls back to the first opener when the chosen default is hidden or unavailable', () => {
    const hiddenDefault = prefs({ defaultId: 'vscode', hidden: ['vscode'], order: ['obsidian', 'vscode'] });
    expect(effectiveDefault(detected, hiddenDefault, true, MD)?.id).toBe('obsidian');
    expect(effectiveDefault(detected, prefs({ defaultId: 'nope' }), true, MD)?.id).toBe('obsidian');
  });
});

describe('settingsTargets (AC-1/2/6)', () => {
  it('lists markdown-capable detected apps + custom; omits apps that cannot open .md', () => {
    const p = prefs({
      custom: [{ id: 'custom-1', name: 'My Script', command: 'sh {file}' }],
    });
    const onObsidian = settingsTargets(detected, p, true);
    // finder (not_supported for files) can't open .md → omitted from the settings list.
    expect(onObsidian.map((t) => t.id).sort()).toEqual(['custom-1', 'obsidian', 'vscode']);
    expect(onObsidian.find((t) => t.id === 'finder')).toBeUndefined();
    expect(onObsidian.find((t) => t.id === 'custom-1')?.custom).toBe(true);

    // Obsidian disappears from the settings list when the vault is not Obsidian.
    expect(settingsTargets(detected, p, false).some((t) => t.id === OBSIDIAN_APP_ID)).toBe(false);
  });

  it('carries the hidden flag for a visible (markdown-capable) target', () => {
    const p = prefs({ hidden: ['vscode'] });
    expect(settingsTargets(detected, p, true).find((t) => t.id === 'vscode')?.hidden).toBe(true);
  });
});
