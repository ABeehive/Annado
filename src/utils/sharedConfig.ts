import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTaskStore, type RootStore } from '../stores/taskStore';
import type { TaskFormat } from '../types/task';
import { debounce } from './debounce';

export const SHARED_SCHEMA_VERSION = 1;

export interface SharedConfig {
  schemaVersion: number;
  generatedBy: string;
  excludedPaths: string[];
  projectColors: Record<string, string>;
  tagColors: Record<string, string>;
  taskFormat: string;
  taskMarkerTag: string;
  inheritFrontmatterTags: boolean;
}

/**
 * Single source of truth for the six synced fields. Each entry drives both
 * publish (`read` → JSON) and read-back (`apply` ← JSON). Adding a field later
 * is one entry here; the Rust write command stays field-agnostic.
 */
interface FieldDescriptor {
  key: keyof SharedConfig;
  /** MUST be reference-stable (return the store value as-is, no fresh objects):
   *  the change-detecting subscription compares `read(state) !== read(prev)`. */
  read: (s: RootStore) => unknown;
  apply: (s: RootStore, value: unknown) => Promise<void> | void;
  /** Shape guard: bad values (wrong type from an untrusted/older shared.json)
   *  must never reach the store or localStorage. */
  valid: (v: unknown) => boolean;
  /** Optional publish-time normalization (applied in assembleSharedConfig only,
   *  never in the change check — it may build fresh objects). */
  serialize?: (v: unknown) => unknown;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);
const isStringRecord = (v: unknown): v is Record<string, string> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every(isString);

/** The shared.json contract keys tagColors by lowercase name, but localStorage can
 *  still hold legacy mixed-case keys from before lowercase-keying (the desktop
 *  resolves those via resolveTagColor's exact-key fallback). Normalize at this
 *  boundary in both directions so the file always honors the contract. */
const lowercaseKeys = (v: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(v).map(([k, c]) => [k.toLowerCase(), c]));

export const SHARED_FIELDS: FieldDescriptor[] = [
  {
    key: 'excludedPaths',
    read: (s) => s.excludedPaths,
    apply: (s, v) => s.setExcludedPathsList(v as string[]),
    valid: isStringArray,
  },
  {
    key: 'projectColors',
    read: (s) => s.projectColors,
    apply: (s, v) => s.setProjectColors(v as Record<string, string>),
    valid: isStringRecord,
  },
  {
    key: 'tagColors',
    read: (s) => s.tagColors,
    apply: (s, v) => s.setTagColors(lowercaseKeys(v as Record<string, string>)),
    valid: isStringRecord,
    serialize: (v) => lowercaseKeys(v as Record<string, string>),
  },
  {
    key: 'taskFormat',
    read: (s) => s.taskFormat,
    apply: (s, v) => s.setTaskFormat(v as TaskFormat),
    valid: isString,
  },
  {
    key: 'taskMarkerTag',
    read: (s) => s.taskMarkerTag,
    apply: (s, v) => s.setTaskMarker(v as string),
    valid: isString,
  },
  {
    key: 'inheritFrontmatterTags',
    read: (s) => s.inheritFrontmatterTags,
    apply: (s, v) => s.setInheritFrontmatterTags(v as boolean),
    valid: isBoolean,
  },
];

export function assembleSharedConfig(state: RootStore): SharedConfig {
  const out = {
    schemaVersion: SHARED_SCHEMA_VERSION,
    generatedBy: 'annado-desktop',
  } as SharedConfig;
  for (const f of SHARED_FIELDS) {
    const value = f.read(state);
    (out as unknown as Record<string, unknown>)[f.key] = f.serialize ? f.serialize(value) : value;
  }
  return out;
}

/** Parse an incoming shared.json. Malformed/non-object → null (keep current config). */
export function parseSharedConfig(json: string): Partial<SharedConfig> | null {
  try {
    const obj = JSON.parse(json) as unknown;
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
    return obj as Partial<SharedConfig>;
  } catch {
    return null;
  }
}

// Bind the store so downstream helpers (Task 8) don't each re-import it.
export const getStore = () => useTaskStore.getState();

// --- Tauri command wrappers ---
export function writeSharedConfig(json: string): Promise<void> {
  return invoke('write_plugin_shared_config', { json });
}
export function removeSharedConfig(): Promise<void> {
  return invoke('remove_plugin_shared_config');
}
export function readSharedConfig(): Promise<string | null> {
  return invoke<string | null>('read_plugin_shared_config');
}
export function getUsedWithPlugin(): Promise<boolean> {
  return invoke<boolean>('get_used_with_obsidian_plugin');
}
export function setUsedWithPlugin(value: boolean): Promise<void> {
  return invoke('set_used_with_obsidian_plugin', { value });
}
export function ensureSharedConfigWatcher(): Promise<boolean> {
  return invoke<boolean>('ensure_shared_config_watcher');
}

// --- Publish (desktop → file) ---
// Suppress subscription-armed publishes while a vault is loading: load-time store
// churn (task load, per-vault fetches, the previous vault's stale toggle value)
// would otherwise snapshot pre-adopt state into the just-switched vault's
// shared.json, silently reverting plugin-side changes. Direct publish calls
// (seeding on enable/adopt) are made while this flag is up on purpose — they
// bypass the subscription, so they must not be suppressed here beyond re-arming.
let vaultLoading = false;
export function beginVaultLoadPublishSuppression(): void {
  vaultLoading = true;
}
export function endVaultLoadPublishSuppression(): void {
  vaultLoading = false;
}

export async function publishSharedConfig(): Promise<void> {
  if (isApplyingRemote() || vaultLoading) {
    // An external apply or a vault load is in flight; publishing now would
    // snapshot half-applied/pre-adopt state. Re-arm the debounce and publish
    // the settled state instead.
    schedulePublish();
    return;
  }
  const state = getStore();
  if (!state.usedWithObsidianPlugin) return; // integration off → never write
  const json = JSON.stringify(assembleSharedConfig(state), null, 2);
  await writeSharedConfig(json);
}

export const schedulePublish = debounce(() => {
  void publishSharedConfig();
}, 400);

// --- Read-back (file → desktop) ---
let applyingRemote = false;
export function isApplyingRemote(): boolean {
  return applyingRemote;
}

/** Apply an incoming shared.json. Guarded so the resulting store writes do
 *  not bounce back out as a fresh publish. Each field is applied independently:
 *  a rejecting setter (external/less-trusted file, bad shape, backend
 *  validation failure) is logged and skipped rather than aborting the rest.
 *  `shouldContinue`, if given, is re-checked before each field so a caller can
 *  abort mid-loop (e.g. the vault was switched while this apply was running). */
export async function applySharedConfig(json: string, shouldContinue?: () => boolean): Promise<void> {
  const parsed = parseSharedConfig(json);
  if (!parsed) return; // malformed → keep current config
  applyingRemote = true;
  try {
    const state = getStore();
    for (const f of SHARED_FIELDS) {
      if (shouldContinue && !shouldContinue()) return;
      if (Object.prototype.hasOwnProperty.call(parsed, f.key)) {
        const value = (parsed as Record<string, unknown>)[f.key];
        if (!f.valid(value)) {
          console.warn('shared-config: invalid shape for', f.key);
          continue;
        }
        try {
          await f.apply(state, value);
        } catch (err) {
          console.warn('shared-config: failed to apply', f.key, err);
        }
      }
    }
  } finally {
    applyingRemote = false;
  }
}

/** Wire up two-way sync: debounced re-publish on local change, and apply on
 *  external change. Call once at app startup; call the returned fn to tear down. */
export function setupSharedConfigSync(): () => void {
  const unsubStore = useTaskStore.subscribe((state, prev) => {
    if (isApplyingRemote()) return; // don't bounce our own read-back back out
    if (!state.usedWithObsidianPlugin) return;
    const changed = SHARED_FIELDS.some((f) => f.read(state) !== f.read(prev));
    if (changed) schedulePublish();
  });

  const unlistenPromise = listen<string>('shared-config-changed', (event) => {
    if (!useTaskStore.getState().usedWithObsidianPlugin) return; // opted out — never apply
    void applySharedConfig(event.payload);
  });

  return () => {
    unsubStore();
    void unlistenPromise.then((un) => un());
  };
}
