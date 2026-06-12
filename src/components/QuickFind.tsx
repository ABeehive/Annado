import { useState, useEffect, useRef, useMemo } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { ViewType } from '../types/task';
import { isDateUpcoming } from '../utils/dates';
import { getProjectColor, getTagColor, PRIORITY_CONFIG } from '../utils/projectColors';
import { viewIconsSmall, PersonIcon, TagIcon } from '../utils/viewIcons';
import { matchesKeybinding } from '../utils/keybindings';
import { useFocusWhen } from '../hooks/useFocus';

type QuickFindResultType = 'task' | 'project' | 'person' | 'view' | 'tag';

interface QuickFindResult {
  id: string;
  type: QuickFindResultType;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
}

interface QuickFindProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const viewLabels: Record<ViewType, string> = {
  inbox: 'Inbox',
  today: 'Today',
  upcoming: 'Upcoming',
  anytime: 'Anytime',
  someday: 'Someday',
  logbook: 'Logbook',
  recurring: 'Recurring',
  wrapped: 'Wrapped',
  agenda: 'Agenda',
  'added-today': 'Added Today',
  'smart-list': 'Smart List',
  review: 'Weekly Review',
};

const personIcon = <PersonIcon className="w-5 h-5" stroke="#5C6BC0" />;

const taskIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" strokeWidth="1.5">
    <circle cx="12" cy="12" r="9" />
  </svg>
);

const getPriorityIcon = (priority: number | null) => {
  const config = priority ? PRIORITY_CONFIG[priority] : null;
  const color = config?.color || '#8A8A8A';
  const label = config?.label || '';

  return (
    <span className="w-5 h-5 flex items-center justify-center text-[11px] font-bold" style={{ color }}>
      {label}
    </span>
  );
};

function TypeBadge({ type }: { type: QuickFindResultType }) {
  const colors: Record<QuickFindResultType, string> = {
    view: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    project: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    person: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    tag: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    task: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
  };

  return (
    <span className={`px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded ${colors[type]}`}>
      {type}
    </span>
  );
}

export function QuickFind({ isOpen, onClose, initialQuery = '' }: QuickFindProps) {
  const {
    tasks,
    availableProjects,
    availablePeople,
    availableTags,
    projectColors,
    tagColors,
    recentItems,
    keybindings,
    addRecentItem,
    setCurrentView,
    setSelectedProject,
    setSelectedPerson,
    setSelectedTag,
    selectTask,
    expandTask,
  } = useTaskStore();

  const [query, setQuery] = useState(initialQuery);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setHighlightedIndex(0);
    }
  }, [isOpen, initialQuery]);

  useFocusWhen(inputRef, isOpen);

  // Build search results
  const results = useMemo((): QuickFindResult[] => {
    const lowerQuery = query.toLowerCase().trim();

    // If no query, show recent items
    if (!lowerQuery) {
      const recentResults: QuickFindResult[] = [];

      for (const item of recentItems.slice(0, 10)) {
        if (item.type === 'view') {
          const viewType = item.id as ViewType;
          if (viewLabels[viewType]) {
            recentResults.push({
              id: item.id,
              type: 'view',
              title: viewLabels[viewType],
              icon: viewIconsSmall[viewType],
            });
          }
        } else if (item.type === 'project') {
          const project = availableProjects.find(p => p.name === item.id);
          if (project) {
            recentResults.push({
              id: item.id,
              type: 'project',
              title: project.name,
              subtitle: project.metadata.description || undefined,
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill={getProjectColor(project.name, project.parentFolder, projectColors)} stroke="none">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              ),
            });
          }
        } else if (item.type === 'person') {
          const person = availablePeople.find(p => p.name === item.id);
          if (person) {
            recentResults.push({
              id: item.id,
              type: 'person',
              title: person.name,
              icon: personIcon,
            });
          }
        } else if (item.type === 'tag') {
          const tag = availableTags.find(t => t.name === item.id);
          if (tag) {
            const tColor = getTagColor(tag.name, tagColors);
            recentResults.push({
              id: item.id,
              type: 'tag',
              title: `#${tag.name}`,
              subtitle: `${tag.count} task${tag.count !== 1 ? 's' : ''}`,
              icon: <TagIcon className="w-5 h-5" stroke={tColor} circleFill={tColor} />,
            });
          }
        } else if (item.type === 'task') {
          const task = tasks.find(t => t.id === item.id);
          if (task && !task.completed) {
            recentResults.push({
              id: item.id,
              type: 'task',
              title: task.title,
              subtitle: task.projects.length > 0 ? task.projects.join(', ') : undefined,
              icon: taskIcon,
            });
          }
        }
      }

      return recentResults;
    }

    // Check for priority search
    const isPrioritySearch =
      lowerQuery === 'priority' ||
      lowerQuery === '!' ||
      lowerQuery === '!!' ||
      lowerQuery === '!!!';

    if (isPrioritySearch) {
      // Get all tasks with priority, sorted high to low
      const priorityTasks = tasks
        .filter(task => !task.completed && task.priority !== null)
        .sort((a, b) => (a.priority || 999) - (b.priority || 999)) // 1 (high) first
        .slice(0, 50);

      return priorityTasks.map(task => ({
        id: task.id,
        type: 'task' as QuickFindResultType,
        title: task.title,
        subtitle: task.projects.length > 0 ? task.projects.join(', ') : undefined,
        icon: getPriorityIcon(task.priority),
      }));
    }

    // "added today" / "vandaag toegevoegd" are aliases for the added-today view
    const isAddedTodayAlias =
      lowerQuery === 'added today' ||
      lowerQuery === 'vandaag toegevoegd' ||
      lowerQuery === 'toegevoegd vandaag';

    if (isAddedTodayAlias) {
      return [{
        id: 'added-today',
        type: 'view',
        title: 'Added Today',
        icon: viewIconsSmall['added-today'],
      }];
    }

    const searchResults: QuickFindResult[] = [];

    // Search views
    const views: ViewType[] = ['inbox', 'today', 'upcoming', 'anytime', 'someday', 'logbook', 'added-today'];
    for (const view of views) {
      if (viewLabels[view].toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          id: view,
          type: 'view',
          title: viewLabels[view],
          icon: viewIconsSmall[view],
        });
      }
    }

    // Search projects
    for (const project of availableProjects) {
      const nameMatch = project.name.toLowerCase().includes(lowerQuery);
      const descMatch = project.metadata.description?.toLowerCase().includes(lowerQuery);
      if (nameMatch || descMatch) {
        searchResults.push({
          id: project.name,
          type: 'project',
          title: project.name,
          subtitle: project.metadata.description || undefined,
          icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={getProjectColor(project.name, project.parentFolder, projectColors)} stroke="none">
              <circle cx="12" cy="12" r="9" />
            </svg>
          ),
        });
      }
    }

    // Search people
    for (const person of availablePeople) {
      if (person.name.toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          id: person.name,
          type: 'person',
          title: person.name,
          icon: personIcon,
        });
      }
    }

    // Search tags
    for (const tag of availableTags) {
      if (tag.name.toLowerCase().includes(lowerQuery)) {
        const tColor = getTagColor(tag.name, tagColors);
        searchResults.push({
          id: tag.name,
          type: 'tag',
          title: `#${tag.name}`,
          subtitle: `${tag.count} task${tag.count !== 1 ? 's' : ''}`,
          icon: <TagIcon className="w-5 h-5" stroke={tColor} circleFill={tColor} />,
        });
      }
    }

    // Search tasks (title, notes, tags)
    for (const task of tasks) {
      if (task.completed) continue;

      const titleMatch = task.title.toLowerCase().includes(lowerQuery);
      const notesMatch = task.notes.toLowerCase().includes(lowerQuery);
      const tagsMatch = task.tags.some(tag => tag.toLowerCase().includes(lowerQuery));

      if (titleMatch || notesMatch || tagsMatch) {
        searchResults.push({
          id: task.id,
          type: 'task',
          title: task.title,
          subtitle: task.projects.length > 0 ? task.projects.join(', ') : (tagsMatch ? task.tags.join(', ') : undefined),
          icon: taskIcon,
        });
      }
    }

    return searchResults.slice(0, 50); // Limit results
  }, [query, tasks, availableProjects, availablePeople, availableTags, projectColors, tagColors, recentItems]);

  // Keep highlighted index in bounds
  useEffect(() => {
    if (highlightedIndex >= results.length) {
      setHighlightedIndex(Math.max(0, results.length - 1));
    }
  }, [results.length, highlightedIndex]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current) {
      const highlightedEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      highlightedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSelect = (result: QuickFindResult) => {
    addRecentItem(result.type, result.id);

    switch (result.type) {
      case 'view':
        setCurrentView(result.id as ViewType);
        break;
      case 'project':
        setCurrentView('inbox');
        setSelectedProject(result.id);
        break;
      case 'person':
        setCurrentView('inbox');
        setSelectedPerson(result.id);
        break;
      case 'tag':
        setCurrentView('inbox');
        setSelectedTag(result.id);
        break;
      case 'task': {
        const task = tasks.find(t => t.id === result.id);
        if (task) {
          if (task.projects.length > 0) {
            setCurrentView('inbox');
            setSelectedProject(task.projects[0]);
          } else {
            // Navigate to the correct view based on task.when
            const whenValue = task.when;
            const whenType = typeof whenValue === 'string' ? whenValue : 'date';
            if (whenType === 'inbox') setCurrentView('inbox');
            else if (whenType === 'today' || whenType === 'evening') setCurrentView('today');
            else if (whenType === 'anytime') setCurrentView('anytime');
            else if (whenType === 'someday') setCurrentView('someday');
            else if (whenType === 'tomorrow') setCurrentView('upcoming');
            else if (typeof whenValue === 'object' && 'date' in whenValue) {
              setCurrentView(isDateUpcoming(whenValue.date) ? 'upcoming' : 'today');
            } else {
              setCurrentView('upcoming');
            }
          }
          selectTask(task.id);
          expandTask(task.id);
        }
        break;
      }
    }

    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check configurable keybindings first
    if (e.key === 'ArrowDown' || matchesKeybinding(e, keybindings.navigateDown || 'ctrl+j')) {
      e.preventDefault();
      e.stopPropagation();
      if (results.length > 0) {
        setHighlightedIndex(i => (i + 1) % results.length);
      }
      return;
    }

    if (e.key === 'ArrowUp' || matchesKeybinding(e, keybindings.navigateUp || 'ctrl+k')) {
      e.preventDefault();
      e.stopPropagation();
      if (results.length > 0) {
        setHighlightedIndex(i => (i - 1 + results.length) % results.length);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (results[highlightedIndex]) {
        handleSelect(results[highlightedIndex]);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
  };

  if (!isOpen) return null;

  const showingRecent = !query.trim();

  return (
    <div className="fixed inset-0 z-50 flex justify-center" style={{ paddingTop: '15vh' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/10 dark:bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#2A2A2A] rounded-xl shadow-2xl overflow-hidden h-fit"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E8E8E8] dark:border-[#3A3A3A]">
          <svg className="w-5 h-5 text-[#8A8A8A] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, projects, people, views..."
            className="flex-1 bg-transparent text-[15px] text-[#1A1A1A] dark:text-[#E8E8E8] placeholder-[#8A8A8A]"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setHighlightedIndex(0);
                inputRef.current?.focus();
              }}
              className="text-[#A0A0A0] hover:text-[#666] dark:hover:text-[#888] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {showingRecent && results.length > 0 && (
            <div className="px-4 py-2 text-[11px] font-semibold text-[#8A8A8A] uppercase tracking-wide">
              Recent
            </div>
          )}
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[#8A8A8A]">
              {showingRecent ? 'No recent items' : 'No results found'}
            </div>
          ) : (
            results.map((result, index) => {
              const isHighlighted = index === highlightedIndex;

              return (
                <button
                  key={`${result.type}-${result.id}`}
                  data-index={index}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isHighlighted
                      ? 'bg-[#D4E4FA] dark:bg-[#2D4A6F]'
                      : 'hover:bg-[#F5F5F5] dark:hover:bg-[#333]'
                  }`}
                >
                  {/* Icon */}
                  <span className="flex-shrink-0">
                    {result.icon}
                  </span>

                  {/* Title and Subtitle */}
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[14px] truncate ${
                      isHighlighted
                        ? 'text-[#1A1A1A] dark:text-white'
                        : 'text-[#1A1A1A] dark:text-[#E0E0E0]'
                    }`}>
                      {result.title}
                    </span>
                    {result.subtitle && (
                      <span className="block text-[12px] text-[#8A8A8A] truncate">
                        {result.subtitle}
                      </span>
                    )}
                  </span>

                  {/* Type Badge */}
                  <TypeBadge type={result.type} />
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#F5F5F5] dark:bg-[#252525] border-t border-[#E8E8E8] dark:border-[#3A3A3A]">
          <div className="flex items-center justify-center gap-4 text-[11px] text-[#888]">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-[#3A3A3A] rounded border border-[#D0D0D0] dark:border-[#4A4A4A] text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-[#3A3A3A] rounded border border-[#D0D0D0] dark:border-[#4A4A4A] text-[10px]">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-[#3A3A3A] rounded border border-[#D0D0D0] dark:border-[#4A4A4A] text-[10px]">esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
