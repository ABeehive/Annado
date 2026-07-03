import type { Task } from '../types/task';

/**
 * Canonical task order: document order (file path, then line number) — the same
 * key the backend sorts on (`sort_tasks` in vault.rs, and `Task::generate_id`).
 *
 * Applied at the display read boundary as defense-in-depth: even if a task array
 * reaches the store out of order (event race, a path that skipped the backend
 * sort), the rendered list stays stable and never reshuffles under the user.
 * Returns a new array; the input is not mutated.
 */
export function sortTasksByDocumentOrder(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => a.filePath.localeCompare(b.filePath) || a.lineNumber - b.lineNumber,
  );
}
