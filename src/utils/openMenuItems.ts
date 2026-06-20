import type { ContextMenuItem } from '../components/ContextMenu';
import {
  openEntityFile,
  openLabel,
  effectiveOpeners,
  runOpener,
  type PathOpenerInfo,
  type OpenerPrefs,
} from './pathOpener';

/**
 * Context-menu items for opening an entity's backing file:
 *   - "Open" / "Open in <app>" — the default action (first visible+usable opener,
 *     else OS default)
 *   - "Open with ▸" — a flyout of every configured (visible + ordered) opener that
 *     can act on this path, custom openers included
 *
 * Spread the result into any entity's context menu. The "Open with" submenu is
 * omitted when no opener applies to the path.
 */
export function buildOpenMenuItems(
  path: string,
  detected: PathOpenerInfo[],
  prefs: OpenerPrefs,
  isObsidianVault: boolean,
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    {
      label: openLabel(path, detected, prefs, isObsidianVault),
      onClick: () => void openEntityFile(path, detected, prefs, isObsidianVault).catch(console.error),
    },
  ];

  const openers = effectiveOpeners(detected, prefs, isObsidianVault, path);
  if (openers.length > 0) {
    items.push({
      label: 'Open with',
      submenu: openers.map((o) => ({
        label: o.name,
        onClick: () => void runOpener(o, path).catch(console.error),
      })),
    });
  }

  return items;
}
