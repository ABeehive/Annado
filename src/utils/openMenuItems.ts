import type { ContextMenuItem } from '../components/ContextMenu';
import {
  openEntityFile,
  openWith,
  openersForPath,
  openLabel,
  type PathOpenerInfo,
} from './pathOpener';

/**
 * Context-menu items for opening an entity's backing file:
 *   - "Open" / "Open in Obsidian" — the default action (Obsidian if available, else OS default)
 *   - "Open with ▸" — a flyout of every detected app that can open this path
 *
 * Spread the result into any entity's context menu. The "Open with" submenu is
 * omitted when no app can open the path.
 */
export function buildOpenMenuItems(path: string, openers: PathOpenerInfo[]): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    {
      label: openLabel(openers, path),
      onClick: () => void openEntityFile(path, openers).catch(console.error),
    },
  ];

  const usable = openersForPath(openers, path);
  if (usable.length > 0) {
    items.push({
      label: 'Open with',
      submenu: usable.map((o) => ({
        label: o.name,
        onClick: () => void openWith(path, o.appId).catch(console.error),
      })),
    });
  }

  return items;
}
