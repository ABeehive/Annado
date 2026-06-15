import type { TagInfo } from '../types/task';

// Shared tag identity + resolution helpers. Tags are case-insensitive for
// identity (like Obsidian) but the original casing is preserved in storage.

/** Trim and strip a single leading "#". Case is left untouched. */
export function normalizeTagInput(s: string): string {
  return s.trim().replace(/^#/, '');
}

/** Two tag names are the same tag if they match case-insensitively. */
export function sameTag(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Whether `tags` already contains `tag` (case-insensitively). */
export function tagsInclude(tags: string[], tag: string): boolean {
  return tags.some((t) => sameTag(t, tag));
}

/**
 * Resolve the tag name to add when the user commits the input (Enter/Tab/comma).
 * Precedence: arrow-highlighted suggestion → exact case-insensitive match against
 * existing tags → a single remaining suggestion → otherwise the typed text as a
 * new tag. Returns null when there's nothing to add.
 */
export function resolveTagToAdd(
  input: string,
  suggestions: TagInfo[],
  highlightedIndex: number,
  availableTags: TagInfo[],
): string | null {
  if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
    return suggestions[highlightedIndex].name;
  }
  const trimmed = normalizeTagInput(input);
  if (!trimmed) return null;
  const exact = availableTags.find((t) => sameTag(t.name, trimmed));
  if (exact) return exact.name;
  if (suggestions.length === 1) return suggestions[0].name;
  return trimmed;
}
