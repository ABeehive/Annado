import type { TagInfo } from '../types/task';

// Shared color palette for projects, tags, and the app accent setting
export const PROJECT_COLORS = [
  '#5C6BC0', // Indigo (default)
  '#E53935', // Red
  '#F5C000', // Yellow
  '#43A047', // Green
  '#1E88E5', // Blue
  '#8E6AC8', // Purple
  '#00ACC1', // Cyan
  '#FF7043', // Deep Orange
  '#78909C', // Blue Grey
  '#EC407A', // Pink
  '#8D6E63', // Brown
  '#26A69A', // Teal
  '#AB47BC', // Violet
  '#FFA726', // Orange
  '#66BB6A', // Light Green
  '#42A5F5', // Light Blue
  '#EF5350', // Coral
  '#7E57C2', // Deep Purple
  '#26C6DA', // Light Cyan
  '#BDBDBD', // Grey
];

export const DEFAULT_ACCENT = '#5C6BC0';

/**
 * Lighten (positive percent) or darken (negative percent) a #rrggbb color
 * by mixing it toward white or black.
 */
export function shadeHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const target = percent < 0 ? 0 : 255;
  const p = Math.min(Math.abs(percent), 100) / 100;
  const mix = (c: number) => Math.round(c + (target - c) * p);
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`;
}

export const PRIORITY_CONFIG: Record<number, { color: string; label: string }> = {
  1: { color: '#E53935', label: '!!!' },
  2: { color: '#FB8C00', label: '!!' },
  3: { color: '#5C6BC0', label: '!' },
};

/**
 * Get the color for a project, with inheritance from parent folder
 */
export function getProjectColor(
  projectName: string,
  parentFolder: string | null | undefined,
  projectColors: Record<string, string>
): string {
  // First check if this project has its own color
  if (projectColors[projectName]) {
    return projectColors[projectName];
  }
  // If it has a parent, inherit parent's color
  if (parentFolder && projectColors[parentFolder]) {
    return projectColors[parentFolder];
  }
  // Default color
  return '#5C6BC0';
}

/**
 * Get the color for a tag
 */
export function getTagColor(
  tagName: string,
  tagColors: Record<string, string>
): string {
  return tagColors[tagName] || '#5C6BC0';
}

export function filterTagSuggestions(
  input: string,
  all: TagInfo[],
  selected: string[],
): TagInfo[] {
  if (!input.trim()) return [];
  const q = input.toLowerCase().replace(/^#/, '');
  return all.filter(t => t.name.toLowerCase().startsWith(q) && !selected.includes(t.name)).slice(0, 6);
}
