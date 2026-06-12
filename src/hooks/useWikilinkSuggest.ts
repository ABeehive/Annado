import { useMemo, type Dispatch, type SetStateAction, type KeyboardEvent } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { getProjectColor } from '../utils/projectColors';

export interface WikiSuggestion {
  name: string;
  type: 'project' | 'person';
  color: string | undefined;
}

// Detects an open [[ before the cursor and returns matching suggestions.
// Returns { query: null } when no [[ is active.
export function useWikilinkSuggest(value: string, cursorPos: number): {
  query: string | null;
  suggestions: WikiSuggestion[];
} {
  const { availableProjects, availablePeople, projectColors } = useTaskStore();

  const query = useMemo(() => {
    const before = value.slice(0, cursorPos);
    const m = before.match(/\[\[([^\][\n]*)$/);
    return m ? m[1] : null;
  }, [value, cursorPos]);

  const suggestions = useMemo(() => {
    if (query === null || query.length < 1) return [];
    const q = query.toLowerCase();
    const projects: WikiSuggestion[] = availableProjects
      .filter(p => p.name.toLowerCase().includes(q))
      .map(p => ({
        name: p.name,
        type: 'project' as const,
        color: getProjectColor(p.name, p.parentFolder, projectColors),
      }));
    const people: WikiSuggestion[] = availablePeople
      .filter(p => p.name.toLowerCase().includes(q))
      .map(p => ({ name: p.name, type: 'person' as const, color: undefined }));
    return [...projects, ...people].slice(0, 8);
  }, [query, availableProjects, availablePeople, projectColors]);

  return { query, suggestions };
}

// Returns an onKeyDown handler that drives wikilink suggestion navigation.
// Pass a fallthrough handler for keys that should be handled by the outer component.
export function buildWikilinkKeyHandler(
  suggestions: WikiSuggestion[],
  highlight: number,
  value: string,
  cursor: number,
  ref: { current: HTMLInputElement | HTMLTextAreaElement | null },
  setHighlight: Dispatch<SetStateAction<number>>,
  setValue: (v: string) => void,
  setCursor: (n: number) => void,
  fallthrough?: (e: KeyboardEvent) => void,
): (e: KeyboardEvent) => void {
  return (e) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(i => Math.max(i - 1, -1)); return; }
      if ((e.key === 'Enter' || e.key === 'Tab') && (highlight >= 0 || suggestions.length === 1)) {
        e.preventDefault();
        const { newValue, newCursorPos } = applyWikilink(value, cursor, suggestions[Math.max(highlight, 0)].name);
        setValue(newValue);
        setCursor(newCursorPos);
        setHighlight(-1);
        setTimeout(() => { if (ref.current) { ref.current.selectionStart = ref.current.selectionEnd = newCursorPos; } }, 0);
        return;
      }
      if (e.key === 'Escape') { setHighlight(-1); return; }
    }
    fallthrough?.(e);
  };
}

// Inserts [[name]] by replacing the open [[ fragment before the cursor.
export function applyWikilink(
  value: string,
  cursorPos: number,
  name: string,
): { newValue: string; newCursorPos: number } {
  const before = value.slice(0, cursorPos).replace(/\[\[[^\][\n]*$/, `[[${name}]]`);
  const after = value.slice(cursorPos);
  return { newValue: before + after, newCursorPos: before.length };
}
