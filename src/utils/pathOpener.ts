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

/**
 * The app to use for the default "Open" action: Obsidian when it's installed
 * and can open this path, otherwise `null` (caller falls back to the OS default).
 */
export function defaultOpener(openers: PathOpenerInfo[], path: string): string | null {
  const usable = openersForPath(openers, path);
  return usable.some((o) => o.appId === OBSIDIAN_APP_ID) ? OBSIDIAN_APP_ID : null;
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

/** Open `path` with the default rule: Obsidian if available, else OS default. */
export function openEntityFile(path: string, openers: PathOpenerInfo[]): Promise<void> {
  const appId = defaultOpener(openers, path);
  return appId ? openWith(path, appId) : openDefault(path);
}

/** Label for the default open action, reflecting where it will open. */
export function openLabel(openers: PathOpenerInfo[], path: string): string {
  return defaultOpener(openers, path) === OBSIDIAN_APP_ID ? 'Open in Obsidian' : 'Open';
}
