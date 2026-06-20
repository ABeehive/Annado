import { invoke } from '@tauri-apps/api/core';

/**
 * Mirrors `path_opener::FileSupport` (serde tag = "kind", content = "extensions").
 * Tells us which paths an opener can handle.
 */
export type FileSupport =
  | { kind: 'any' }
  | { kind: 'not_supported' }
  | { kind: 'extensions'; extensions: string[] };

/** Mirrors the `OpenerInfo` DTO returned by the Rust `detect_path_openers` command. */
export interface PathOpenerInfo {
  appId: string;
  name: string;
  acceptsDirectories: boolean;
  fileSupport: FileSupport;
}

export const OBSIDIAN_APP_ID = 'obsidian';

/**
 * A user-defined opener that runs an arbitrary command template against a path.
 * Mirrors the Rust `CustomOpener`. `id` is generated client-side
 * (`custom-${uuid}`); `command` supports `{file}` / `{dir}` / `{line}`.
 */
export interface CustomOpener {
  id: string;
  name: string;
  command: string;
}

/**
 * Persisted "Open In" preferences. Mirrors the Rust `OpenerPrefs`.
 * - `order`: opener ids (detected app ids + custom ids) in display order.
 * - `hidden`: ids the user has hidden from the open-in affordance.
 * - `custom`: user-defined openers.
 */
export interface OpenerPrefs {
  order: string[];
  hidden: string[];
  custom: CustomOpener[];
  /** Explicitly-chosen default opener id; `null` falls back to the first visible+usable opener in `order`. */
  defaultId: string | null;
}

export const EMPTY_OPENER_PREFS: OpenerPrefs = { order: [], hidden: [], custom: [], defaultId: null };

/**
 * One entry the open-in affordance can act on, after applying preferences. A
 * `detected` opener runs via `openWith`/`openTargetFor`; a `custom` opener runs
 * its command via `runCustomOpener`.
 */
export type EffectiveOpener =
  | { kind: 'detected'; id: string; name: string; info: PathOpenerInfo }
  | { kind: 'custom'; id: string; name: string; command: string };

/** A row for the settings list: a target plus whether it's currently hidden. */
export interface OpenerTarget {
  id: string;
  name: string;
  hidden: boolean;
  custom: boolean;
}

/** Read the opener prefs invoke endpoint (backend `AppConfig.opener_prefs`). */
export function getOpenerPrefs(): Promise<OpenerPrefs> {
  return invoke<OpenerPrefs>('get_opener_prefs');
}

/** Persist the opener prefs to the backend `AppConfig`. */
export function setOpenerPrefs(openerPrefs: OpenerPrefs): Promise<void> {
  return invoke('set_opener_prefs', { openerPrefs });
}

/** Run a custom opener's command template (`{file}`/`{dir}`/`{line}`) against `path`. */
export function runCustomOpener(path: string, command: string): Promise<void> {
  return invoke('run_custom_opener', { path, command });
}

/** Available openers on this machine (detection is cached on the Rust side). */
export function detectOpeners(): Promise<PathOpenerInfo[]> {
  return invoke<PathOpenerInfo[]>('detect_path_openers');
}

/** Force a re-scan (e.g. after the user installs or removes an app). */
export function refreshOpeners(): Promise<PathOpenerInfo[]> {
  return invoke<PathOpenerInfo[]>('refresh_path_openers');
}

/** Open `path` with a specific detected app (handles Obsidian's URI scheme internally). */
export function openWith(path: string, appId: string): Promise<void> {
  return invoke('open_path_with', { path, appId });
}

/** Open `path` with the OS default handler (the "double-click" behavior). */
export function openDefault(path: string): Promise<void> {
  return invoke('open_path_default', { path });
}

function extensionOf(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

function accepts(support: FileSupport, ext: string): boolean {
  switch (support.kind) {
    case 'any':
      return true;
    case 'not_supported':
      return false;
    case 'extensions':
      return support.extensions.some((e) => e.toLowerCase() === ext);
  }
}

/**
 * The openers that can open `path`. A path with no extension is treated as a
 * directory (so terminals/Finder qualify); otherwise extension support decides.
 */
export function openersForPath(openers: PathOpenerInfo[], path: string): PathOpenerInfo[] {
  const ext = extensionOf(path);
  if (ext === '') return openers.filter((o) => o.acceptsDirectories);
  return openers.filter((o) => accepts(o.fileSupport, ext));
}

/** Order a list of ids by `order` (listed ids first, in `order`; the rest appended
 * in their existing relative order). Pure helper for the effective-list sort. */
function sortByOrder<T>(items: T[], idOf: (item: T) => string, order: string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i] as const));
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const ra = rank.get(idOf(a.item));
      const rb = rank.get(idOf(b.item));
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1; // listed before unlisted
      if (rb !== undefined) return 1;
      return a.i - b.i; // both unlisted: keep existing order (stable)
    })
    .map(({ item }) => item);
}

/**
 * The configured, ordered, visible openers that can act on `path` — the single
 * source the open-in icon and "Open with" menu consume. Custom openers are
 * treated as usable for ANY path (their command decides); detected apps are
 * filtered by `openersForPath`. Obsidian is dropped unless `isObsidianVault`.
 * Hidden ids are dropped. The result is sorted by `prefs.order` (ids not listed
 * are appended in their existing order: custom first, then detected).
 */
export function effectiveOpeners(
  detected: PathOpenerInfo[],
  prefs: OpenerPrefs,
  isObsidianVault: boolean,
  path: string,
): EffectiveOpener[] {
  const hidden = new Set(prefs.hidden);

  const customEntries: EffectiveOpener[] = prefs.custom
    .filter((c) => !hidden.has(c.id))
    .map((c) => ({ kind: 'custom', id: c.id, name: c.name, command: c.command }));

  const usable = openersForPath(detected, path);
  const detectedEntries: EffectiveOpener[] = usable
    .filter((o) => isObsidianVault || o.appId !== OBSIDIAN_APP_ID)
    .filter((o) => !hidden.has(o.appId))
    .map((o) => ({ kind: 'detected', id: o.appId, name: o.name, info: o }));

  // Custom first, then detected, before applying the user-defined order.
  const all = [...customEntries, ...detectedEntries];
  return sortByOrder(all, (e) => e.id, prefs.order);
}

/**
 * The default opener for `path`: the first of the effective list, or `null` when
 * none is visible+usable (caller falls back to the OS default).
 */
export function effectiveDefault(
  detected: PathOpenerInfo[],
  prefs: OpenerPrefs,
  isObsidianVault: boolean,
  path: string,
): EffectiveOpener | null {
  const list = effectiveOpeners(detected, prefs, isObsidianVault, path);
  // The explicitly-chosen default wins when it's visible + usable for this path;
  // otherwise fall back to the first opener in the configured order.
  if (prefs.defaultId) {
    const chosen = list.find((e) => e.id === prefs.defaultId);
    if (chosen) return chosen;
  }
  return list[0] ?? null;
}

/**
 * A representative app entity path. Annado entities are markdown files, so the
 * settings list only offers detected apps that can open `.md` — matching what
 * the runtime "Open with" menu would actually present for a task's file.
 */
const MARKDOWN_PROBE_PATH = 'entity.md';

/**
 * Valid Open In targets for the **settings** list. Custom openers (always) plus
 * the detected apps that can open the app's markdown files (Obsidian only when
 * `isObsidianVault`), sorted by `prefs.order`, each carrying its hidden flag.
 * Detected apps that can't open `.md` are omitted — they'd never be offered at
 * open time, so listing them in settings is just noise.
 */
export function settingsTargets(
  detected: PathOpenerInfo[],
  prefs: OpenerPrefs,
  isObsidianVault: boolean,
): OpenerTarget[] {
  const hidden = new Set(prefs.hidden);

  const customTargets: OpenerTarget[] = prefs.custom.map((c) => ({
    id: c.id,
    name: c.name,
    hidden: hidden.has(c.id),
    custom: true,
  }));

  const mdUsable = new Set(openersForPath(detected, MARKDOWN_PROBE_PATH).map((o) => o.appId));
  const detectedTargets: OpenerTarget[] = detected
    .filter((o) => isObsidianVault || o.appId !== OBSIDIAN_APP_ID)
    .filter((o) => mdUsable.has(o.appId))
    .map((o) => ({ id: o.appId, name: o.name, hidden: hidden.has(o.appId), custom: false }));

  const all = [...customTargets, ...detectedTargets];
  return sortByOrder(all, (t) => t.id, prefs.order);
}

/** Run an effective opener against `path` (detected → `openWith`, custom → its command). */
export function runOpener(opener: EffectiveOpener, path: string): Promise<void> {
  if (opener.kind === 'custom') return runCustomOpener(path, opener.command);
  return openWith(openTargetFor(path, opener.id), opener.id);
}

/**
 * File-manager openers (`open`/`xdg-open`/`explorer <path>`) delegate a *file*
 * to its default app rather than revealing it. So when opening a file with a
 * file manager we hand it the containing folder instead; a directory path is
 * passed through unchanged.
 */
const FILE_MANAGER_APP_IDS = new Set(['finder', 'file-manager', 'explorer']);

export function isFileManager(appId: string): boolean {
  return FILE_MANAGER_APP_IDS.has(appId);
}

function containingDir(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '');
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return idx > 0 ? trimmed.slice(0, idx) : trimmed;
}

/** The path to actually hand `appId`: a file's containing folder for file managers. */
export function openTargetFor(path: string, appId: string): string {
  if (!isFileManager(appId)) return path;
  return extensionOf(path) ? containingDir(path) : path;
}

/**
 * Open `path` with the configured default: the first visible+usable opener from
 * the effective list, falling back to the OS default when none exists.
 */
export function openEntityFile(
  path: string,
  detected: PathOpenerInfo[],
  prefs: OpenerPrefs,
  isObsidianVault: boolean,
): Promise<void> {
  const opener = effectiveDefault(detected, prefs, isObsidianVault, path);
  return opener ? runOpener(opener, path) : openDefault(path);
}

/** Label for the default open action, reflecting where it will open. */
export function openLabel(
  path: string,
  detected: PathOpenerInfo[],
  prefs: OpenerPrefs,
  isObsidianVault: boolean,
): string {
  const opener = effectiveDefault(detected, prefs, isObsidianVault, path);
  if (!opener) return 'Open';
  return `Open in ${opener.name}`;
}
