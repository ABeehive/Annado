import { CalendarEvent } from '../../types/task';

const MEETING_PATTERNS = [
  /https?:\/\/(?:[a-z0-9-]+\.)*zoom\.us\/[^\s]*/i,
  /https?:\/\/(?:[a-z0-9-]+\.)*teams\.microsoft\.com\/[^\s]*/i,
  /https?:\/\/(?:[a-z0-9-]+\.)*webex\.com\/[^\s]*/i,
  /https?:\/\/meet\.google\.com\/[^\s]*/i,
];

function findMeetingUrl(text: string): string | null {
  for (const pattern of MEETING_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

function isMeetingUrl(url: string): boolean {
  return MEETING_PATTERNS.some((p) => p.test(url));
}

export function getMeetingUrl(event: CalendarEvent): string | null {
  // 1. Explicit event URL (if it matches a meeting pattern)
  if (event.url && isMeetingUrl(event.url)) return event.url;

  // 2. Scan location
  if (event.location) {
    const found = findMeetingUrl(event.location);
    if (found) return found;
  }

  // 3. Scan notes
  if (event.notes) {
    const found = findMeetingUrl(event.notes);
    if (found) return found;
  }

  return null;
}
