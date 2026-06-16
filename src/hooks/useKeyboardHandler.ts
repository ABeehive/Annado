import { useEffect } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { getFixedShortcutBindings, hasAnyShortcutModifier, KEYBINDING_DEFAULTS, matchesKeybinding } from '../utils/keybindings';
import { groupTasksByProject } from '../utils/taskGrouping';
import type { RecurringTemplate, ViewType } from '../types/task';

interface KeyboardHandlerOptions {
  moveToProjectOpen: boolean;
  quickFindOpen: boolean;
  confirmModal: { message: string; onConfirm: () => void } | null;
  setMoveToProjectOpen: (open: boolean) => void;
  setQuickFindOpen: (open: boolean) => void;
  setQuickFindInitialQuery: (query: string) => void;
  setRecurringModalOpen: (open: boolean) => void;
  setEditingRecurringTemplate: (template: RecurringTemplate | null) => void;
  setConfirmModal: (modal: { message: string; onConfirm: () => void } | null) => void;
}

function getActivePanelContext() {
  const state = useTaskStore.getState();
  const isSide = state.activePanel === 'side';
  return {
    isSide,
    selectedIds: isSide ? state.sidePanelSelectedTaskIds : state.selectedTaskIds,
    expandedId: isSide ? state.sidePanelExpandedTaskId : state.expandedTaskId,
    expand: (id: string | null) => isSide ? state.sidePanelExpandTask(id) : state.expandTask(id),
  };
}

const FIXED_SHORTCUTS = getFixedShortcutBindings();
const VIEW_SHORTCUT_ACTIONS = [
  'viewInbox',
  'viewToday',
  'viewAgenda',
  'viewUpcoming',
  'viewAnytime',
  'viewSomeday',
  'viewLogbook',
  'viewRecurring',
  'viewWrapped',
  'viewAddedToday',
  'viewReview',
];

function shouldHandleShortcutWhileTyping(e: KeyboardEvent): boolean {
  const state = useTaskStore.getState();
  if (!state.expandedTaskId && !state.sidePanelExpandedTaskId) return false;

  const { keybindings } = state;
  const allowedBindings = [
    FIXED_SHORTCUTS.newTask,
    FIXED_SHORTCUTS.newRecurringTask,
    keybindings.toggleSidePanel || KEYBINDING_DEFAULTS.toggleSidePanel,
    keybindings.undo || KEYBINDING_DEFAULTS.undo,
    keybindings.quickFind || KEYBINDING_DEFAULTS.quickFind,
    keybindings.moveToProject || KEYBINDING_DEFAULTS.moveToProject,
    keybindings.showWhen || KEYBINDING_DEFAULTS.showWhen,
    keybindings.showDeadline || KEYBINDING_DEFAULTS.showDeadline,
    keybindings.startToday || KEYBINDING_DEFAULTS.startToday,
    keybindings.deleteTask || KEYBINDING_DEFAULTS.deleteTask,
    keybindings.completeTask || KEYBINDING_DEFAULTS.completeTask,
    ...VIEW_SHORTCUT_ACTIONS.map(action => keybindings[action] || KEYBINDING_DEFAULTS[action]),
  ];

  return allowedBindings.some(binding => matchesKeybinding(e, binding));
}

export function useKeyboardHandler(opts: KeyboardHandlerOptions) {
  const {
    moveToProjectOpen, quickFindOpen, confirmModal,
    setMoveToProjectOpen, setQuickFindOpen, setQuickFindInitialQuery,
    setRecurringModalOpen, setEditingRecurringTemplate, setConfirmModal,
  } = opts;

  useEffect(() => {
    const { setCurrentView, setSelectedProject } = useTaskStore.getState();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs, except:
      // - Escape always blurs
      // - command shortcuts pass through when a task is expanded
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        if (!shouldHandleShortcutWhileTyping(e)) return;
      }

      // Check customizable keybindings (side panel toggle)
      {
        const { keybindings } = useTaskStore.getState();
        if (matchesKeybinding(e, keybindings.toggleSidePanel || KEYBINDING_DEFAULTS.toggleSidePanel)) {
          e.preventDefault();
          useTaskStore.getState().toggleSidePanel();
          return;
        }
        // Undo last task change — never while typing (text fields keep native undo)
        if (
          matchesKeybinding(e, keybindings.undo || KEYBINDING_DEFAULTS.undo) &&
          !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        ) {
          e.preventDefault();
          useTaskStore.getState().undoLastAction();
          return;
        }
      }

      if (matchesKeybinding(e, FIXED_SHORTCUTS.newTask)) {
        e.preventDefault();
        useTaskStore.getState().openQuickAdd();
        return;
      }

      if (matchesKeybinding(e, FIXED_SHORTCUTS.newRecurringTask)) {
        e.preventDefault();
        setEditingRecurringTemplate(null);
        setRecurringModalOpen(true);
        return;
      }

      const { keybindings } = useTaskStore.getState();

      if (matchesKeybinding(e, keybindings.quickFind || KEYBINDING_DEFAULTS.quickFind)) {
        e.preventDefault();
        setQuickFindInitialQuery('');
        setQuickFindOpen(true);
        return;
      }

      if (matchesKeybinding(e, keybindings.moveToProject || KEYBINDING_DEFAULTS.moveToProject)) {
        e.preventDefault();
        const { selectedIds, expandedId } = getActivePanelContext();
        if (selectedIds.length > 0 || expandedId) {
          setMoveToProjectOpen(true);
        }
        return;
      }

      // Show When - opens the When picker for the selected task
      if (matchesKeybinding(e, keybindings.showWhen || KEYBINDING_DEFAULTS.showWhen)) {
        e.preventDefault();
        const state = useTaskStore.getState();
        const { selectedIds, expandedId, expand } = getActivePanelContext();
        const targetId = selectedIds.length === 1 ? selectedIds[0] : expandedId;
        if (targetId) {
          if (!expandedId) expand(targetId);
          setTimeout(() => { state.openWhenPicker(targetId); }, expandedId ? 0 : 50);
        }
        return;
      }

      // Show Deadline - opens the Deadline picker for the selected task
      if (matchesKeybinding(e, keybindings.showDeadline || KEYBINDING_DEFAULTS.showDeadline)) {
        e.preventDefault();
        const state = useTaskStore.getState();
        const { selectedIds, expandedId, expand } = getActivePanelContext();
        const targetId = selectedIds.length === 1 ? selectedIds[0] : expandedId;
        if (targetId) {
          if (!expandedId) expand(targetId);
          setTimeout(() => { state.openDeadlinePicker(targetId); }, expandedId ? 0 : 50);
        }
        return;
      }

      // Start Today - sets selected task(s) to "today"
      if (matchesKeybinding(e, keybindings.startToday || KEYBINDING_DEFAULTS.startToday)) {
        e.preventDefault();
        const state = useTaskStore.getState();
        const { selectedIds, expandedId } = getActivePanelContext();
        const targetIds = selectedIds.length > 0 ? selectedIds : (expandedId ? [expandedId] : []);
        if (targetIds.length > 0) {
          state.updateMultipleTasks(targetIds, { when: 'today' });
        }
        return;
      }

      // Delete Task - deletes selected task(s)
      if (matchesKeybinding(e, keybindings.deleteTask || KEYBINDING_DEFAULTS.deleteTask)) {
        e.preventDefault();
        const state = useTaskStore.getState();
        const { selectedIds, expandedId } = getActivePanelContext();
        const targetIds = selectedIds.length > 0 ? selectedIds : (expandedId ? [expandedId] : (state.selectedTaskId ? [state.selectedTaskId] : []));
        if (targetIds.length === 0) return;
        const doDelete = () => { for (const id of targetIds) state.deleteTask(id); };
        if (state.confirmDelete) {
          const msg = targetIds.length === 1 ? 'Delete this task?' : `Delete ${targetIds.length} tasks?`;
          setConfirmModal({ message: msg, onConfirm: doDelete });
        } else {
          doDelete();
        }
        return;
      }

      // Complete Task - toggles completion of selected task(s)
      if (matchesKeybinding(e, keybindings.completeTask || KEYBINDING_DEFAULTS.completeTask)) {
        e.preventDefault();
        const state = useTaskStore.getState();
        const { selectedIds, expandedId } = getActivePanelContext();
        const targetIds = selectedIds.length > 0 ? selectedIds : (expandedId ? [expandedId] : (state.selectedTaskId ? [state.selectedTaskId] : []));
        for (const id of targetIds) {
          state.toggleTaskComplete(id);
        }
        return;
      }

      // Escape to close modals, expanded task, or deselect
      if (e.key === 'Escape') {
        if (quickFindOpen) {
          setQuickFindOpen(false);
          return;
        }
        if (moveToProjectOpen) {
          setMoveToProjectOpen(false);
          return;
        }
        useTaskStore.getState().closeQuickAdd();
        const state = useTaskStore.getState();
        const { isSide, expandedId, expand } = getActivePanelContext();
        if (expandedId) {
          expand(null);
        } else if (isSide) {
          useTaskStore.setState({ sidePanelSelectedTaskIds: [], activePanel: 'main' });
        } else {
          state.selectTask(null);
        }
        return;
      }

      // Agenda-specific keyboard navigation
      {
        const state = useTaskStore.getState();
        if (state.currentView === 'agenda') {
          if (e.key === 't') {
            e.preventDefault();
            state.setAgendaSelectedDate(new Date().toISOString().slice(0, 10));
            return;
          }

          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const current = new Date(state.agendaSelectedDate + 'T12:00:00');
            const direction = e.key === 'ArrowRight' ? 1 : -1;
            const days = e.shiftKey || state.agendaSubView === 'week' ? 7 * direction : direction;
            current.setDate(current.getDate() + days);
            state.setAgendaSelectedDate(current.toISOString().slice(0, 10));
            return;
          }
        }
      }

      // Up/Down navigation
      const isNavigateDown = e.key === 'ArrowDown' || matchesKeybinding(e, keybindings.navigateDown || KEYBINDING_DEFAULTS.navigateDown);
      const isNavigateUp = e.key === 'ArrowUp' || matchesKeybinding(e, keybindings.navigateUp || KEYBINDING_DEFAULTS.navigateUp);

      if (isNavigateDown || isNavigateUp) {
        e.preventDefault();
        const state = useTaskStore.getState();
        const { isSide, expandedId, expand } = getActivePanelContext();
        const rawTasks = isSide ? state.getSidePanelFilteredTasks() : state.getFilteredTasks();
        if (rawTasks.length === 0) return;

        const { currentView, selectedProject, selectedPerson, selectedTag } = state;
        let tasks = rawTasks;
        if (!selectedProject && !selectedPerson && !selectedTag &&
            currentView !== 'logbook' && currentView !== 'upcoming') {
          const dayTasks = currentView === 'today' ? rawTasks.filter(t => t.when !== 'evening') : rawTasks;
          const eveningTasks = currentView === 'today' ? rawTasks.filter(t => t.when === 'evening') : [];
          const flattenGrouped = (list: typeof rawTasks) => {
            const { noProject, projects } = groupTasksByProject(list);
            const seen = new Set<string>();
            const result: typeof rawTasks = [];
            for (const t of [...noProject, ...projects.flatMap(g => g.tasks)]) {
              if (!seen.has(t.id)) { seen.add(t.id); result.push(t); }
            }
            return result;
          };
          tasks = [...flattenGrouped(dayTasks), ...flattenGrouped(eveningTasks)];
        }

        const currentSelectedId = isSide ? state.sidePanelSelectedTaskIds[0] : state.selectedTaskId;
        const currentIndex = currentSelectedId ? tasks.findIndex(t => t.id === currentSelectedId) : -1;

        const newIndex = isNavigateDown
          ? (currentIndex < tasks.length - 1 ? currentIndex + 1 : 0)
          : (currentIndex > 0 ? currentIndex - 1 : tasks.length - 1);

        if (isSide) {
          state.sidePanelToggleTaskSelection(tasks[newIndex].id, false);
          if (expandedId) expand(null);
        } else {
          state.selectTask(tasks[newIndex].id);
          if (expandedId) expand(null);
        }
        return;
      }

      // Enter to toggle expand/collapse selected task
      if (e.key === 'Enter') {
        if (confirmModal !== null) return;
        const { selectedIds, expandedId, expand } = getActivePanelContext();
        const currentId = selectedIds[0] ?? null;
        if (currentId) {
          e.preventDefault();
          expand(expandedId === currentId ? null : currentId);
        }
        return;
      }

      // View navigation shortcuts
      const viewShortcuts: [string, string, ViewType][] = [
        ['viewInbox', KEYBINDING_DEFAULTS.viewInbox, 'inbox'],
        ['viewToday', KEYBINDING_DEFAULTS.viewToday, 'today'],
        ['viewAgenda', KEYBINDING_DEFAULTS.viewAgenda, 'agenda'],
        ['viewUpcoming', KEYBINDING_DEFAULTS.viewUpcoming, 'upcoming'],
        ['viewAnytime', KEYBINDING_DEFAULTS.viewAnytime, 'anytime'],
        ['viewSomeday', KEYBINDING_DEFAULTS.viewSomeday, 'someday'],
        ['viewLogbook', KEYBINDING_DEFAULTS.viewLogbook, 'logbook'],
        ['viewRecurring', KEYBINDING_DEFAULTS.viewRecurring, 'recurring'],
        ['viewWrapped', KEYBINDING_DEFAULTS.viewWrapped, 'wrapped'],
        ['viewAddedToday', KEYBINDING_DEFAULTS.viewAddedToday, 'added-today'],
        ['viewReview', KEYBINDING_DEFAULTS.viewReview, 'review'],
      ];
      for (const [action, defaultBinding, view] of viewShortcuts) {
        if (matchesKeybinding(e, keybindings[action] || defaultBinding)) {
          e.preventDefault();
          setSelectedProject(null);
          setCurrentView(view);
          return;
        }
      }

      // Type-to-search: open Quick Find when typing a printable character
      const { currentView: view } = useTaskStore.getState();
      if (view !== 'review' && view !== 'wrapped' && view !== 'agenda' &&
          !hasAnyShortcutModifier(e) &&
          e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        e.preventDefault();
        setQuickFindInitialQuery(e.key);
        setQuickFindOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveToProjectOpen, quickFindOpen, confirmModal]);
}
