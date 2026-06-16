import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useTaskStore, QuickAddPrefill } from '../stores/taskStore';
import { isDateUpcoming } from '../utils/dates';
import { KEYBINDING_DEFAULTS } from '../utils/keybindings';

const MAX_DEEP_LINK_PARAM_LENGTH = 1000;

function parseDeepLinkUrl(urlString: string): QuickAddPrefill | null {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'annado:') return null;
    if (url.hostname !== 'quickadd') return null;

    const params = url.searchParams;
    const get = (key: string) => {
      const val = params.get(key);
      return val && val.length <= MAX_DEEP_LINK_PARAM_LENGTH ? val : undefined;
    };
    return {
      title: get('title'),
      notes: get('notes'),
      when: get('when'),
      project: get('project'),
    };
  } catch {
    return null;
  }
}

export function useAppEvents() {
  const { loadSavedVaultPath, setupEventListeners } = useTaskStore();
  const initializedRef = useRef(false);

  // Guard against React Strict Mode double invocation
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    loadSavedVaultPath();

    let cleanup: (() => void) | undefined;
    setupEventListeners().then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  // Calendar: fetch events on startup + refresh every 5 minutes
  useEffect(() => {
    const { detectCalendarSupport, fetchCalendars } = useTaskStore.getState();
    detectCalendarSupport()
      .then((supported) => {
        if (supported && useTaskStore.getState().calendarEnabled) {
          fetchCalendars();
        }
      })
      .catch((error) => console.error('Failed to initialize calendar support:', error));

    const interval = setInterval(() => {
      const state = useTaskStore.getState();
      if (state.calendarEnabled && state.calendarSupported) {
        state.fetchCalendarEvents();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Listen for deep link events
  useEffect(() => {
    const handleUrls = (urls: string[]) => {
      for (const url of urls) {
        const prefill = parseDeepLinkUrl(url);
        if (prefill) {
          useTaskStore.getState().openQuickAdd(prefill);
          break;
        }
      }
    };

    const checkPending = () => {
      invoke<string | null>('get_pending_deep_link').then((url) => {
        if (url) {
          handleUrls([url]);
        }
      }).catch(console.error);
    };

    checkPending();
    // Retry after delay in case URL arrives via on_open_url after initial check
    const retryTimeout = setTimeout(checkPending, 500);
    const cleanupRetry = () => clearTimeout(retryTimeout);

    const unlistenPromise = listen<string>('deep-link-received', (event) => {
      handleUrls([event.payload]);
    });

    return () => {
      cleanupRetry();
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Listen for global hotkey to open QuickAdd
  useEffect(() => {
    const unlistenPromise = listen('global-quickadd', () => {
      useTaskStore.getState().openQuickAdd();
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Open a task from the tray popup — same navigation logic as QuickFind
  useEffect(() => {
    const unlistenPromise = listen<string>('tray-open-task', (event) => {
      const taskId = event.payload;
      const store = useTaskStore.getState();
      const task = store.tasks.find(t => t.id === taskId);
      if (!task) return;

      if (task.projects.length > 0) {
        store.setCurrentView('inbox');
        store.setSelectedProject(task.projects[0]);
      } else {
        const when = task.when;
        const whenType = typeof when === 'string' ? when : 'date';
        if (whenType === 'inbox') store.setCurrentView('inbox');
        else if (whenType === 'today' || whenType === 'evening') store.setCurrentView('today');
        else if (whenType === 'anytime') store.setCurrentView('anytime');
        else if (whenType === 'someday') store.setCurrentView('someday');
        else if (whenType === 'tomorrow') store.setCurrentView('upcoming');
        else if (typeof when === 'object' && 'date' in when) {
          store.setCurrentView(isDateUpcoming(when.date) ? 'upcoming' : 'today');
        } else {
          store.setCurrentView('upcoming');
        }
      }

      store.selectTask(taskId);
      store.expandTask(taskId);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Register global shortcuts on startup and when keybindings change
  useEffect(() => {
    const { keybindings } = useTaskStore.getState();
    const quickAddBinding = keybindings.globalQuickAdd || KEYBINDING_DEFAULTS.globalQuickAdd;
    const showAppBinding = keybindings.globalShowApp || KEYBINDING_DEFAULTS.globalShowApp;
    invoke('register_global_shortcuts', { quickAddBinding, showAppBinding })
      .catch((e) => console.error('[shortcuts] registration failed:', e));

    let lastQuickAdd = quickAddBinding;
    let lastShowApp = showAppBinding;
    const unsubscribe = useTaskStore.subscribe((state) => {
      const newQuickAdd = state.keybindings.globalQuickAdd || KEYBINDING_DEFAULTS.globalQuickAdd;
      const newShowApp = state.keybindings.globalShowApp || KEYBINDING_DEFAULTS.globalShowApp;
      if (newQuickAdd !== lastQuickAdd || newShowApp !== lastShowApp) {
        lastQuickAdd = newQuickAdd;
        lastShowApp = newShowApp;
        invoke('register_global_shortcuts', { quickAddBinding: newQuickAdd, showAppBinding: newShowApp })
          .catch((e) => console.error('[shortcuts] re-registration failed:', e));
      }
    });

    return () => unsubscribe();
  }, []);
}
