/** Agenda timeline shared constants */

/** First visible hour (07:00) */
export const DAY_START_HOUR = 7;
/** Last visible hour (21:00) */
export const DAY_END_HOUR = 21;

/** Day start in minutes from midnight */
export const DAY_START = DAY_START_HOUR * 60; // 420
/** Day end in minutes from midnight */
export const DAY_END = DAY_END_HOUR * 60; // 1260

/** Number of visible hours */
export const VISIBLE_HOURS = DAY_END_HOUR - DAY_START_HOUR; // 14
/** Total visible minutes */
export const TOTAL_MINUTES = VISIBLE_HOURS * 60; // 840

/** Scale factor: pixels per minute (1 = original, 1.5 = 50% larger) */
export const PIXELS_PER_MINUTE = 1.5;

/** Total pixel height of the timeline */
export const TOTAL_HEIGHT = TOTAL_MINUTES * PIXELS_PER_MINUTE; // 1260

/** Default task duration in minutes */
export const DEFAULT_DURATION = 30;

/** Gap between adjacent blocks for visual separation */
export const BLOCK_GAP_PX = 3;

/** Height of each all-day event row in the week banner (px) */
export const ALL_DAY_ROW_HEIGHT = 24;

/** Maximum visible all-day rows before clipping */
export const MAX_ALL_DAY_ROWS = 3;

/** Array of visible hours [7, 8, ..., 21] */
export const HOURS = Array.from({ length: VISIBLE_HOURS + 1 }, (_, i) => i + DAY_START_HOUR);
