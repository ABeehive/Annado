import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { SliceCreator } from './types';
import { storeError } from '../storeUtils';
import { _vaultVersion } from './settingsSlice';
import { filterTasks, filterTasksForSmartList, withCompletionLinger } from '../filterTasks';
import {
  Task, TaskUpdatePayload, CreateTaskPayload, ViewType,
  ProjectInfo, PersonInfo, PersonMetadata, UpdateProjectMetadataPayload,
  RecurringTemplate, CreateRecurringTemplatePayload, UpdateRecurringTemplatePayload, TagInfo,
} from '../../types/task';
import { formatDateForStorage, getToday } from '../../utils/dates';

export interface UndoEntry {
  /** Reverts the recorded action (a normal backend write, so it persists) */
  run: () => Promise<void>;
}

export interface TaskSlice {
  tasks: Task[];
  /** Tasks just marked complete, kept visible while the completion animation plays */
  completingTaskIds: string[];
  undoStack: UndoEntry[];
  undoLastAction: () => Promise<void>;
  selectedTaskId: string | null;
  selectedTaskIds: string[];
  expandedTaskId: string | null;
  taskIdWithOpenWhenPicker: string | null;
  taskIdWithOpenDeadlinePicker: string | null;
  selectedProject: string | null;
  selectedPerson: string | null;
  selectedPersonMetadata: PersonMetadata | null;
  selectedTag: string | null;
  currentView: ViewType;
  availableProjects: ProjectInfo[];
  availablePeople: PersonInfo[];
  availableTags: TagInfo[];
  recurringTemplates: RecurringTemplate[];

  fetchTasks: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchPeople: () => Promise<void>;
  fetchTags: () => Promise<void>;
  fetchPersonMetadata: (personName: string) => Promise<void>;
  selectTask: (id: string | null) => void;
  toggleTaskSelection: (id: string, multiSelect?: boolean) => void;
  expandTask: (id: string | null) => void;
  openWhenPicker: (id: string | null) => void;
  openDeadlinePicker: (id: string | null) => void;
  clearSelection: () => void;
  setCurrentView: (view: ViewType) => void;
  setSelectedProject: (project: string | null) => void;
  setSelectedPerson: (person: string | null) => void;
  setSelectedTag: (tag: string | null) => void;
  navigateToProject: (project: string) => void;
  navigateToPerson: (person: string) => void;
  updateTask: (payload: TaskUpdatePayload) => Promise<void>;
  updateMultipleTasks: (ids: string[], updates: Partial<TaskUpdatePayload>) => Promise<void>;
  createTask: (payload: CreateTaskPayload) => Promise<Task>;
  toggleTaskComplete: (id: string) => Promise<void>;
  toggleChecklistItem: (taskId: string, itemIndex: number) => Promise<void>;
  renameChecklistItem: (taskId: string, itemIndex: number, newTitle: string) => Promise<void>;
  deleteChecklistItem: (taskId: string, itemIndex: number) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  setupEventListeners: () => Promise<() => void>;
  updateProjectMetadata: (payload: UpdateProjectMetadataPayload) => Promise<void>;
  createProject: (name: string, parentFolder: string | null, meta: { description?: string; deadline?: string; persons?: string[]; milestones?: Array<{ name: string; end?: string }> }) => Promise<void>;
  renameProject: (oldName: string, newName: string) => Promise<void>;
  createPerson: (name: string, meta: { organisation?: string; relationship?: string; languages?: string[]; projects?: string[] }) => Promise<void>;
  renamePerson: (oldName: string, newName: string) => Promise<void>;
  fetchRecurringTemplates: () => Promise<void>;
  createRecurringTemplate: (payload: CreateRecurringTemplatePayload) => Promise<RecurringTemplate>;
  updateRecurringTemplate: (payload: UpdateRecurringTemplatePayload) => Promise<RecurringTemplate>;
  deleteRecurringTemplate: (templateId: string) => Promise<void>;
  generateRecurringInstances: () => Promise<void>;
  getFilteredTasks: () => Task[];
  getSelectedTask: () => Task | undefined;
}

// How long a just-completed task stays in the list before it animates out.
// Keep in sync with the .task-completing animation timing in App.css.
const COMPLETE_LINGER_MS = 1600;

// True while an undo entry is running, so the inverse action doesn't record itself
let isUndoing = false;

const UNDO_STACK_LIMIT = 50;

/** Build the payload that reverts `payload` by restoring the previous task's values. */
function inversePayload(previous: Task, payload: TaskUpdatePayload): TaskUpdatePayload {
  const inverse: TaskUpdatePayload = { id: payload.id };
  for (const key of Object.keys(payload) as (keyof TaskUpdatePayload)[]) {
    if (key !== 'id' && payload[key] !== undefined) {
      (inverse as unknown as Record<string, unknown>)[key] = (previous as unknown as Record<string, unknown>)[key];
    }
  }
  return inverse;
}

/** Merge the defined fields of an update payload into a task (for optimistic updates). */
function applyTaskPayload(task: Task, payload: TaskUpdatePayload): Task {
  const merged = { ...task };
  for (const [key, value] of Object.entries(payload)) {
    if (key !== 'id' && value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

export const createTaskSlice: SliceCreator<TaskSlice> = (set, get) => {
  const pushUndo = (run: () => Promise<void>): UndoEntry | null => {
    if (isUndoing) return null;
    const entry: UndoEntry = { run };
    set((state) => ({ undoStack: [...state.undoStack.slice(-(UNDO_STACK_LIMIT - 1)), entry] }));
    return entry;
  };

  // Drop an entry whose original action failed (the optimistic change was rolled back)
  const dropUndo = (entry: UndoEntry | null) => {
    if (!entry) return;
    set((state) => ({ undoStack: state.undoStack.filter((e: UndoEntry) => e !== entry) }));
  };

  return {
  tasks: [],
  completingTaskIds: [],
  undoStack: [],

  undoLastAction: async () => {
    const stack = get().undoStack as UndoEntry[];
    const entry = stack[stack.length - 1];
    if (!entry) return;
    set({ undoStack: stack.slice(0, -1) });
    isUndoing = true;
    try {
      await entry.run();
    } finally {
      isUndoing = false;
    }
  },

  selectedTaskId: null,
  selectedTaskIds: [],
  expandedTaskId: null,
  taskIdWithOpenWhenPicker: null,
  taskIdWithOpenDeadlinePicker: null,
  selectedProject: null,
  selectedPerson: null,
  selectedPersonMetadata: null,
  selectedTag: null,
  currentView: 'inbox' as ViewType,
  availableProjects: [],
  availablePeople: [],
  availableTags: [],
  recurringTemplates: [],

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await invoke<Task[]>('get_tasks');
      set({ tasks, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchProjects: async () => {
    const v = _vaultVersion;
    try {
      const projects = await invoke<ProjectInfo[]>('get_all_projects');
      if (_vaultVersion !== v) return;
      set({ availableProjects: projects });
    } catch (error) {
      if (_vaultVersion !== v) return;
      set({ error: String(error) });
    }
  },

  fetchPeople: async () => {
    const v = _vaultVersion;
    try {
      const people = await invoke<PersonInfo[]>('get_all_persons');
      if (_vaultVersion !== v) return;
      set({ availablePeople: people });
    } catch (error) {
      if (_vaultVersion !== v) return;
      set({ error: String(error) });
    }
  },

  fetchTags: async () => {
    const v = _vaultVersion;
    try {
      const tags = await invoke<TagInfo[]>('get_all_tags');
      if (_vaultVersion !== v) return;
      set({ availableTags: tags });
    } catch (error) {
      if (_vaultVersion !== v) return;
      set({ error: String(error) });
    }
  },

  fetchPersonMetadata: async (personName: string) => {
    const v = _vaultVersion;
    try {
      const metadata = await invoke<PersonMetadata>('get_person_metadata', { personName });
      if (_vaultVersion !== v) return;
      set({ selectedPersonMetadata: metadata });
    } catch (error) {
      if (_vaultVersion !== v) return;
      set({ selectedPersonMetadata: null, error: String(error) });
    }
  },

  selectTask: (id) => {
    set({ selectedTaskId: id, selectedTaskIds: id ? [id] : [] });
  },

  toggleTaskSelection: (id, multiSelect = false) => {
    const currentIds = (get().selectedTaskIds as string[]);
    if (multiSelect) {
      const isSelected = currentIds.includes(id);
      const newIds = isSelected ? currentIds.filter((tid) => tid !== id) : [...currentIds, id];
      set({
        selectedTaskIds: newIds,
        sidePanelSelectedTaskIds: [],
        activePanel: 'main',
        selectedTaskId: newIds.length === 1 ? newIds[0] : null,
      });
    } else {
      const isSelected = currentIds.length === 1 && currentIds[0] === id;
      set({
        selectedTaskIds: isSelected ? [] : [id],
        selectedTaskId: isSelected ? null : id,
        sidePanelSelectedTaskIds: [],
        activePanel: 'main',
      });
    }
  },

  expandTask: (id) => {
    // Collapse side panel's expanded task when expanding main panel task, and clear
    // any open date-picker flags so re-expanding a task never auto-reopens a picker.
    set({
      expandedTaskId: id,
      sidePanelExpandedTaskId: null,
      taskIdWithOpenWhenPicker: null,
      taskIdWithOpenDeadlinePicker: null,
    });
  },

  // Opening one date picker closes the other (mutual exclusivity).
  openWhenPicker: (id) => set(id
    ? { taskIdWithOpenWhenPicker: id, taskIdWithOpenDeadlinePicker: null }
    : { taskIdWithOpenWhenPicker: null }),
  openDeadlinePicker: (id) => set(id
    ? { taskIdWithOpenDeadlinePicker: id, taskIdWithOpenWhenPicker: null }
    : { taskIdWithOpenDeadlinePicker: null }),

  clearSelection: () => {
    set({ selectedTaskId: null, selectedTaskIds: [], expandedTaskId: null });
  },

  setCurrentView: (view) => {
    set({ currentView: view, selectedTaskId: null, selectedProject: null, selectedPerson: null, selectedTag: null, expandedTaskId: null });
  },

  setSelectedProject: (project) => {
    set({ selectedProject: project, selectedPerson: null, selectedTag: null, expandedTaskId: null, selectedTaskId: null });
  },

  setSelectedPerson: (person) => {
    set({ selectedPerson: person, selectedProject: null, selectedTag: null, expandedTaskId: null, selectedTaskId: null, selectedPersonMetadata: null });
    if (person) get().fetchPersonMetadata(person);
  },

  setSelectedTag: (tag) => {
    set({ selectedTag: tag, selectedProject: null, selectedPerson: null, expandedTaskId: null, selectedTaskId: null, selectedPersonMetadata: null });
  },

  navigateToProject: (project) => {
    set({ currentView: 'inbox' as ViewType, selectedTaskId: null, expandedTaskId: null });
    set({ selectedProject: project, selectedPerson: null, selectedTag: null, expandedTaskId: null, selectedTaskId: null });
  },

  navigateToPerson: (person) => {
    set({ currentView: 'inbox' as ViewType, selectedTaskId: null, expandedTaskId: null });
    set({ selectedPerson: person, selectedProject: null, selectedTag: null, expandedTaskId: null, selectedTaskId: null, selectedPersonMetadata: null });
    if (person) get().fetchPersonMetadata(person);
  },

  updateTask: async (payload) => {
    const previous = (get().tasks as Task[]).find((t) => t.id === payload.id);
    if (!previous) return;

    // Optimistic merge of the defined payload fields; the backend response
    // (which may normalize values) replaces it, or we roll back on error.
    const optimistic = applyTaskPayload(previous, payload);
    set((state) => ({ tasks: state.tasks.map((t: Task) => t.id === payload.id ? optimistic : t) }));
    const undoEntry = pushUndo(() => get().updateTask(inversePayload(previous, payload)));

    try {
      const updatedTask = await invoke<Task>('update_task', { payload });
      set((state) => ({ tasks: state.tasks.map((t: Task) => t.id === updatedTask.id ? updatedTask : t) }));
    } catch (error) {
      set((state) => ({ tasks: state.tasks.map((t: Task) => t.id === payload.id ? previous : t) }));
      dropUndo(undoEntry);
      storeError(set, error);
    }
  },

  updateMultipleTasks: async (ids, updates) => {
    const previousById = new Map(
      (get().tasks as Task[]).filter((t) => ids.includes(t.id)).map((t) => [t.id, t])
    );

    set((state) => ({
      tasks: state.tasks.map((t: Task) =>
        previousById.has(t.id) ? applyTaskPayload(t, { id: t.id, ...updates }) : t
      ),
      selectedTaskIds: [],
      selectedTaskId: null,
    }));
    const undoEntry = pushUndo(async () => {
      await Promise.all(
        [...previousById.values()].map((prev) =>
          get().updateTask(inversePayload(prev, { id: prev.id, ...updates }))
        )
      );
    });

    try {
      const updatedTasks = await Promise.all(
        ids.map((id) => invoke<Task>('update_task', { payload: { id, ...updates } }))
      );
      const updatedById = new Map(updatedTasks.map((t) => [t.id, t]));
      set((state) => ({
        tasks: state.tasks.map((t: Task) => updatedById.get(t.id) ?? t),
      }));
    } catch (error) {
      set((state) => ({
        tasks: state.tasks.map((t: Task) => previousById.get(t.id) ?? t),
      }));
      dropUndo(undoEntry);
      storeError(set, error);
    }
  },

  createTask: async (payload) => {
    try {
      const newTask = await invoke<Task>('create_task', { payload });
      set((state) => ({ tasks: [...state.tasks, newTask] }));
      pushUndo(() => get().deleteTask(newTask.id));
      return newTask;
    } catch (error) {
      storeError(set, error);
    }
  },

  toggleTaskComplete: async (id) => {
    const previous = (get().tasks as Task[]).find((t) => t.id === id);
    if (!previous) return;
    const completing = !previous.completed;

    // Optimistic flip so the checkbox responds instantly; the backend write
    // happens in the background. Completing tasks linger in the list while
    // the completion animation plays, then drop out.
    set((state) => ({
      tasks: state.tasks.map((t: Task) =>
        t.id === id
          ? { ...t, completed: completing, completedDate: completing ? formatDateForStorage(getToday()) : null }
          : t
      ),
      completingTaskIds: completing
        ? [...state.completingTaskIds, id]
        : state.completingTaskIds.filter((tid: string) => tid !== id),
    }));

    if (completing) {
      setTimeout(() => {
        set((state) => ({
          completingTaskIds: state.completingTaskIds.filter((tid: string) => tid !== id),
        }));
      }, COMPLETE_LINGER_MS);
    }

    const undoEntry = pushUndo(() => get().toggleTaskComplete(id));

    try {
      const updatedTask = await invoke<Task>('toggle_task_complete', { id });
      set((state) => ({
        tasks: state.tasks.map((t: Task) => {
          if (t.id !== updatedTask.id) return t;
          // Don't overwrite a quick re-toggle that happened while the write was in flight
          return t.completed === updatedTask.completed ? updatedTask : t;
        }),
      }));
    } catch (error) {
      // Roll back the optimistic flip
      set((state) => ({
        tasks: state.tasks.map((t: Task) => (t.id === id ? previous : t)),
        completingTaskIds: state.completingTaskIds.filter((tid: string) => tid !== id),
      }));
      dropUndo(undoEntry);
      storeError(set, error);
    }
  },

  toggleChecklistItem: async (taskId, itemIndex) => {
    const previous = (get().tasks as Task[]).find((t) => t.id === taskId);
    if (previous?.checklist[itemIndex]) {
      const checklist = previous.checklist.map((item, i) =>
        i === itemIndex ? { ...item, completed: !item.completed } : item
      );
      set((state) => ({ tasks: state.tasks.map((t: Task) => t.id === taskId ? { ...t, checklist } : t) }));
      pushUndo(() => get().toggleChecklistItem(taskId, itemIndex));
    }
    try {
      const updatedTask = await invoke<Task>('toggle_checklist_item', { taskId, itemIndex });
      set((state) => ({ tasks: state.tasks.map((t: Task) => t.id === updatedTask.id ? updatedTask : t) }));
    } catch (error) {
      if (previous) {
        set((state) => ({ tasks: state.tasks.map((t: Task) => t.id === taskId ? previous : t) }));
      }
      storeError(set, error);
    }
  },

  renameChecklistItem: async (taskId, itemIndex, newTitle) => {
    try {
      const updatedTask = await invoke<Task>('rename_checklist_item', { taskId, itemIndex, newTitle });
      set((state) => ({ tasks: state.tasks.map((t: Task) => t.id === updatedTask.id ? updatedTask : t) }));
    } catch (error) {
      storeError(set, error);
    }
  },

  deleteChecklistItem: async (taskId, itemIndex) => {
    try {
      const updatedTask = await invoke<Task>('delete_checklist_item', { taskId, itemIndex });
      set((state) => ({ tasks: state.tasks.map((t: Task) => t.id === updatedTask.id ? updatedTask : t) }));
    } catch (error) {
      storeError(set, error);
    }
  },

  deleteTask: async (id) => {
    const previousTasks = get().tasks as Task[];
    set((state) => ({
      tasks: state.tasks.filter((t: Task) => t.id !== id),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
      selectedTaskIds: state.selectedTaskIds.filter((tid: string) => tid !== id),
      expandedTaskId: state.expandedTaskId === id ? null : state.expandedTaskId,
    }));
    try {
      await invoke('delete_task', { id });
    } catch (error) {
      set({ tasks: previousTasks });
      storeError(set, error);
    }
  },

  setupEventListeners: async () => {
    const unlisten = await listen<Task[]>('tasks-updated', (event) => {
      set({ tasks: event.payload });
      get().fetchPeople();
      get().fetchProjects();
      get().fetchTags();
    });
    return unlisten;
  },

  updateProjectMetadata: async (payload) => {
    try {
      await invoke('update_project_metadata', { payload });
      await get().fetchProjects();
    } catch (error) {
      storeError(set, error);
    }
  },

  createProject: async (name, parentFolder, meta) => {
    await invoke('create_project', { payload: { name, parentFolder, ...meta } });
    await get().fetchProjects();
  },

  renameProject: async (oldName, newName) => {
    await invoke('rename_project', { payload: { oldName, newName } });
    const projectColors = get().projectColors as Record<string, string>;
    if (projectColors[oldName]) {
      get().setProjectColor(newName, projectColors[oldName]);
      const cleaned = { ...projectColors };
      delete cleaned[oldName];
      set({ projectColors: cleaned });
      localStorage.setItem('projectColors', JSON.stringify(cleaned));
    }
    await get().fetchProjects();
  },

  createPerson: async (name, meta) => {
    await invoke('create_person', { payload: { name, ...meta } });
    await get().fetchPeople();
  },

  renamePerson: async (oldName, newName) => {
    await invoke('rename_person', { payload: { oldName, newName } });
    await get().fetchPeople();
  },

  fetchRecurringTemplates: async () => {
    const v = _vaultVersion;
    try {
      const templates = await invoke<RecurringTemplate[]>('get_all_recurring_templates');
      if (_vaultVersion !== v) return;
      set({ recurringTemplates: templates });
    } catch (error) {
      if (_vaultVersion !== v) return;
      set({ error: String(error) });
    }
  },

  createRecurringTemplate: async (payload) => {
    try {
      const template = await invoke<RecurringTemplate>('create_recurring_template', { payload });
      set((state) => ({ recurringTemplates: [...state.recurringTemplates, template] }));
      const tasks = await invoke<Task[]>('get_tasks');
      set({ tasks });
      return template;
    } catch (error) {
      storeError(set, error);
    }
  },

  updateRecurringTemplate: async (payload) => {
    try {
      const template = await invoke<RecurringTemplate>('update_recurring_template', { payload });
      set((state) => ({
        recurringTemplates: state.recurringTemplates.map((t: RecurringTemplate) =>
          t.templateId === template.templateId ? template : t
        ),
      }));
      return template;
    } catch (error) {
      storeError(set, error);
    }
  },

  deleteRecurringTemplate: async (templateId) => {
    try {
      await invoke('delete_recurring_template', { templateId });
      set((state) => ({
        recurringTemplates: state.recurringTemplates.filter((t: RecurringTemplate) => t.templateId !== templateId),
      }));
    } catch (error) {
      storeError(set, error);
    }
  },

  generateRecurringInstances: async () => {
    try {
      await invoke<Task[]>('generate_recurring_instances');
      get().fetchRecurringTemplates();
      const tasks = await invoke<Task[]>('get_tasks');
      set({ tasks });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  getFilteredTasks: () => {
    const state = get();
    const { tasks, completingTaskIds, currentView, selectedProject, selectedPerson, selectedTag, smartLists, selectedSmartListId } = state;
    if (currentView === 'smart-list') {
      const list = smartLists.find((l) => l.id === selectedSmartListId);
      if (!list) return [];
      return withCompletionLinger(tasks, completingTaskIds, (ts) =>
        filterTasksForSmartList(ts, list.filter, formatDateForStorage(getToday())));
    }
    return withCompletionLinger(tasks, completingTaskIds, (ts) =>
      filterTasks(ts, currentView, selectedProject, selectedPerson, selectedTag));
  },

  getSelectedTask: () => {
    const { tasks, selectedTaskId } = get();
    return tasks.find((t) => t.id === selectedTaskId);
  },
  };
};
