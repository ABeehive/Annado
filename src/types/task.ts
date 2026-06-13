export interface Milestone {
  name: string;
  start: string | null;
  end: string | null;
  completed: boolean;
}

export interface ProjectMetadata {
  description: string | null;
  deadline: string | null;
  startDate: string | null;
  ranking: string | null;
  persons: string[];
  up: string | null;  // Parent project from frontmatter
  milestones: Milestone[];
}

export interface UpdateProjectMetadataPayload {
  projectName: string;
  description: string | null;
  deadline: string | null;
  startDate: string | null;
  ranking: string | null;
  persons: string[];
  up: string | null;
  milestones: Milestone[];
}

export interface ProjectInfo {
  name: string;
  path: string;
  depth: number;
  parentFolder: string | null;
  metadata: ProjectMetadata;
}

export interface PersonInfo {
  name: string;
  path: string;
}

export interface TagInfo {
  name: string;
  count: number;
}

export interface PersonMetadata {
  name: string | null;
  organisation: string | null;
  relationship: string | null;
  languages: string[];
  projects: string[];
}

// Rust serde serializes unit variants as strings, Date variant as object
export type WhenValue =
  | 'inbox'
  | 'today'
  | 'evening'
  | 'tomorrow'
  | 'anytime'
  | 'someday'
  | { date: string };

export type WhenType = 'inbox' | 'today' | 'evening' | 'tomorrow' | 'anytime' | 'someday' | 'date';

export interface ChecklistItem {
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  when: WhenValue;
  deadline: string | null;
  tags: string[];
  checklist: ChecklistItem[];
  completed: boolean;
  completedDate: string | null;
  createdDate: string | null;
  filePath: string;
  lineNumber: number;
  projects: string[]; // Projects associated via [[Project Name]] wiki-links
  indentLevel: number;
  priority: number | null; // 1 = high, 2 = medium, 3 = low
  persons: string[]; // Persons associated via [[Person Name]] wiki-links
  recurringTemplateId: string | null; // Links to recurring template if this is an instance
  durationMinutes: number | null; // Estimated duration in minutes from @duration()
  scheduledTime: string | null; // "HH:MM" from @time()
}

export interface TaskUpdatePayload {
  id: string;
  title?: string;
  notes?: string;
  when?: WhenValue;
  deadline?: string | null;
  tags?: string[];
  completed?: boolean;
  projects?: string[];
  priority?: number | null;
  durationMinutes?: number | null;
  scheduledTime?: string | null;
}

export interface CreateTaskPayload {
  title: string;
  when?: WhenValue;
}

export type ViewType = 'inbox' | 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook' | 'recurring' | 'wrapped' | 'agenda' | 'added-today' | 'smart-list' | 'review';

export interface SmartListFilter {
  priority?: 1 | 2 | 3;
  hasDeadline?: boolean;
  minAgeDays?: number;
  projects?: string[];
  person?: string;
  tag?: string;
  baseView?: 'inbox' | 'today' | 'upcoming' | 'anytime' | 'someday';
  dueWithin?: { amount: number; unit: 'days' | 'weeks' | 'months' };
}

export interface SmartList {
  id: string;
  name: string;
  icon: string;
  filter: SmartListFilter;
}

export function getWhenType(when: WhenValue): WhenType {
  if (typeof when === 'string') {
    return when;
  }
  if ('date' in when) {
    return 'date';
  }
  return 'inbox';
}

export function createWhenValue(type: WhenType, date?: string): WhenValue {
  switch (type) {
    case 'inbox': return 'inbox';
    case 'today': return 'today';
    case 'evening': return 'evening';
    case 'tomorrow': return 'tomorrow';
    case 'anytime': return 'anytime';
    case 'someday': return 'someday';
    case 'date': return { date: date || '' };
  }
}

// Recurring task types
export type RecurrenceType = 'fixed' | 'after_completion';
export type IntervalUnit = 'days' | 'weeks' | 'months' | 'years';

export interface RecurringTemplate {
  templateId: string;
  title: string;
  notes: string;
  recurrenceType: RecurrenceType;
  interval: number;
  intervalUnit: IntervalUnit;
  startDate: string | null;
  lastGenerated: string | null;
  lastCompleted: string | null;
  filePath: string;
  projects: string[];
  priority: number | null;
  tags: string[];
}

export interface CreateRecurringTemplatePayload {
  title: string;
  notes?: string;
  recurrenceType: RecurrenceType;
  interval: number;
  intervalUnit: IntervalUnit;
  startDate?: string;
  project?: string;
  priority?: number | null;
  tags?: string[];
}

export interface UpdateRecurringTemplatePayload {
  templateId: string;
  title?: string;
  notes?: string;
  recurrenceType?: RecurrenceType;
  interval?: number;
  intervalUnit?: IntervalUnit;
  startDate?: string;
  project?: string;
  priority?: number | null;
  tags?: string[];
}

export interface FolderPaths {
  recurringTemplates: string;
  projectsPattern: string;
  areasPattern: string;
  personsPattern: string;
  dailyNotesFolder: string;
  dailyNotesFormat: string;
}

// Calendar types
export interface CalendarInfo {
  id: string;
  name: string;
  color: string;
  accountName: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  calendarName: string;
  calendarColor: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  location: string | null;
  url: string | null;
  notes: string | null;
}
