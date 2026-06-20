import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SortableList, SortableItem } from './Sortable';
import { useTaskStore } from '../stores/taskStore';
import { ViewType, getWhenType, ProjectInfo, PersonInfo, SmartList } from '../types/task';
import { ContextMenu } from './ContextMenu';

// Heavy modals load on first open — keeps the startup bundle small.
const SettingsModal = lazy(() => import('./SettingsModal').then((m) => ({ default: m.SettingsModal })));
const SmartListModal = lazy(() => import('./SmartListModal').then((m) => ({ default: m.SmartListModal })));
import { CreateProjectModal } from './CreateProjectModal';
import { CreatePersonModal } from './CreatePersonModal';
import { getProjectColor, getTagColor, PROJECT_COLORS } from '../utils/projectColors';
import { sameTag } from '../utils/tags';
import { buildTagTree, type TagNode } from '../utils/tagTree';
import { getViewIcon, PersonIcon } from '../utils/viewIcons';
import { useClickOutside } from '../hooks/useClickOutside';
import { isDateTodayOrEarlier, isDateUpcoming } from '../utils/dates';
import { AgendaDaySelector } from '../features/agenda/AgendaDaySelector';
import { OpenFileButton } from './OpenFileButton';

const chevronIcon = (expanded: boolean) => (
  <svg
    className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const personIcon = (active: boolean) => (
  <PersonIcon className="w-5 h-5" stroke={active ? 'currentColor' : '#5C6BC0'} />
);

const rowClass = (active: boolean) =>
  `w-full flex items-center px-3 py-2 rounded-lg text-[13px] font-normal transition-all ${
    active
      ? 'bg-[#EFECE4] dark:bg-white/[0.10] text-[#1A1A1A] dark:text-white'
      : 'text-[#1A1A1A] dark:text-[#E0E0E0] hover:bg-black/5 dark:hover:bg-white/5'
  }`;

const sectionHeadingClass = 'text-[11px] font-semibold text-[#8A8A8A] dark:text-[#666] uppercase tracking-wide';

// Color picker component
function ColorPicker({
  currentColor,
  onSelect,
  onClose
}: {
  currentColor: string;
  onSelect: (color: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, onClose);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-[#2A2A2A] rounded-lg shadow-lg border border-[#E8E8E8] dark:border-[#3A3A3A] p-2"
    >
      <div className="grid grid-cols-5 gap-1">
        {PROJECT_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => {
              onSelect(color);
              onClose();
            }}
            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
              color === currentColor ? 'ring-2 ring-offset-2 ring-primary dark:ring-offset-[#2A2A2A]' : ''
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

// Project icon with color
function ProjectIcon({
  color,
  active,
  onClick,
  size = 'normal'
}: {
  color: string;
  active: boolean;
  onClick?: (e: React.MouseEvent) => void;
  size?: 'normal' | 'small';
}) {
  const sizeClass = size === 'small' ? 'w-4 h-4' : 'w-5 h-5';
  const radius = size === 'small' ? 7 : 9;

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 hover:scale-110 transition-transform"
    >
      <svg className={sizeClass} viewBox="0 0 24 24" fill={active ? "currentColor" : color} stroke="none">
        <circle cx="12" cy="12" r={radius} />
      </svg>
    </button>
  );
}

interface ProjectHierarchy {
  project: ProjectInfo;
  children: ProjectHierarchy[];  // Changed to recursive structure
}

function MenuItem({ dot, label, onClick }: { dot: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f5f3f0] dark:hover:bg-[#333] transition-colors duration-[0.1s] cursor-pointer"
    >
      <span className="rounded-full flex-shrink-0" style={{ backgroundColor: dot, width: 5, height: 5 }} />
      <span className="text-[13px] flex-1 text-left text-[#1A1A1A] dark:text-[#E0E0E0]">{label}</span>
    </button>
  );
}

function ProjectContextMenu({ project, color, x, y, onColor, onRename, onAddSubproject, onClose }: {
  project: ProjectInfo; color: string; x: number; y: number;
  onColor: () => void; onRename: () => void; onAddSubproject: () => void; onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<React.CSSProperties>({ top: y, left: x, visibility: 'hidden' });

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const style: React.CSSProperties = {};
    if (y + el.offsetHeight > window.innerHeight) style.bottom = window.innerHeight - y;
    else style.top = y;
    if (x + el.offsetWidth > window.innerWidth) style.right = window.innerWidth - x;
    else style.left = x;
    style.visibility = 'visible';
    setPos(style);
  }, [x, y]);

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div ref={menuRef} className="fixed z-50 bg-white dark:bg-[#2A2A2A] min-w-[180px] overflow-hidden"
        style={{ ...pos, borderRadius: 12, boxShadow: '0 0 0 0.5px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="px-3 pt-2.5 pb-1.5 border-b border-[#F0F0F0] dark:border-[#3A3A3A]">
          <div className="text-[13px] font-semibold text-[#1A1A1A] dark:text-[#E0E0E0] truncate">{project.name}</div>
        </div>
        <MenuItem dot={color} label="Color…" onClick={onColor} />
        <MenuItem dot="#999" label="Rename" onClick={onRename} />
        <MenuItem dot="#5C6BC0" label="New Subproject" onClick={onAddSubproject} />
      </div>
    </>
  );
}

function PersonContextMenu({ person, x, y, onRename, onClose }: {
  person: PersonInfo; x: number; y: number;
  onRename: () => void; onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<React.CSSProperties>({ top: y, left: x, visibility: 'hidden' });

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const style: React.CSSProperties = {};
    if (y + el.offsetHeight > window.innerHeight) style.bottom = window.innerHeight - y;
    else style.top = y;
    if (x + el.offsetWidth > window.innerWidth) style.right = window.innerWidth - x;
    else style.left = x;
    style.visibility = 'visible';
    setPos(style);
  }, [x, y]);

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div ref={menuRef} className="fixed z-50 bg-white dark:bg-[#2A2A2A] min-w-[160px] overflow-hidden"
        style={{ ...pos, borderRadius: 12, boxShadow: '0 0 0 0.5px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="px-3 pt-2.5 pb-1.5 border-b border-[#F0F0F0] dark:border-[#3A3A3A]">
          <div className="text-[13px] font-semibold text-[#1A1A1A] dark:text-[#E0E0E0] truncate">{person.name}</div>
        </div>
        <MenuItem dot="#999" label="Rename" onClick={onRename} />
      </div>
    </>
  );
}

// Sortable wrapper for project items
export function Sidebar() {
  const { currentView, setCurrentView, tasks, selectedProject, setSelectedProject, availableProjects, selectedPerson, setSelectedPerson, availablePeople, selectedTag, setSelectedTag, availableTags, sidebarWidth, setSidebarWidth, expandedFolders, toggleFolder, projectColors, setProjectColor, tagColors, setTagColor, projectOrder, reorderProjects, sidebarCounts, showProjectCounts, smartLists, selectedSmartListId, deleteSmartList, setSelectedSmartList, renameProject, renamePerson } = useTaskStore(useShallow((s) => ({ currentView: s.currentView, setCurrentView: s.setCurrentView, tasks: s.tasks, selectedProject: s.selectedProject, setSelectedProject: s.setSelectedProject, availableProjects: s.availableProjects, selectedPerson: s.selectedPerson, setSelectedPerson: s.setSelectedPerson, availablePeople: s.availablePeople, selectedTag: s.selectedTag, setSelectedTag: s.setSelectedTag, availableTags: s.availableTags, sidebarWidth: s.sidebarWidth, setSidebarWidth: s.setSidebarWidth, expandedFolders: s.expandedFolders, toggleFolder: s.toggleFolder, projectColors: s.projectColors, setProjectColor: s.setProjectColor, tagColors: s.tagColors, setTagColor: s.setTagColor, projectOrder: s.projectOrder, reorderProjects: s.reorderProjects, sidebarCounts: s.sidebarCounts, showProjectCounts: s.showProjectCounts, smartLists: s.smartLists, selectedSmartListId: s.selectedSmartListId, deleteSmartList: s.deleteSmartList, setSelectedSmartList: s.setSelectedSmartList, renameProject: s.renameProject, renamePerson: s.renamePerson, })));
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [colorPickerProject, setColorPickerProject] = useState<string | null>(null);
  const [colorPickerTag, setColorPickerTag] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isPeopleExpanded, setIsPeopleExpanded] = useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [expandedTagNodes, setExpandedTagNodes] = useState<Set<string>>(new Set());
  const [isSmartListsExpanded, setIsSmartListsExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; listId: string } | null>(null);
  const [smartListModalOpen, setSmartListModalOpen] = useState(false);
  const [editingSmartList, setEditingSmartList] = useState<SmartList | undefined>(undefined);
  const sidebarRef = useRef<HTMLElement>(null);

  // Project/person creation and rename state
  const [projectContextMenu, setProjectContextMenu] = useState<{ x: number; y: number; project: ProjectInfo } | null>(null);
  const [renamingProject, setRenamingProject] = useState<string | null>(null);
  const [createProjectParent, setCreateProjectParent] = useState<string | null | undefined>(undefined);
  const [personContextMenu, setPersonContextMenu] = useState<{ x: number; y: number; person: PersonInfo } | null>(null);
  const [renamingPerson, setRenamingPerson] = useState<string | null>(null);
  const [showCreatePerson, setShowCreatePerson] = useState(false);

  const submitProjectRename = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (trimmed && trimmed !== oldName) renameProject(oldName, trimmed);
    setRenamingProject(null);
  };

  const submitPersonRename = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (trimmed && trimmed !== oldName) renamePerson(oldName, trimmed);
    setRenamingPerson(null);
  };

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(400, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, setSidebarWidth]);

  // Cmd+, to open settings/shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ',') {
        e.preventDefault();
        setShowShortcuts(true);
      }
      if (e.key === 'Escape' && showShortcuts) {
        setShowShortcuts(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showShortcuts]);

  // Build project hierarchy (recursive tree structure)
  const projectHierarchy = useMemo(() => {
    const childrenByParent = new Map<string, ProjectInfo[]>();
    const topLevel: ProjectInfo[] = [];

    // Group projects by parent
    for (const project of availableProjects) {
      const parent = project.metadata.up || null;
      if (!parent) {
        topLevel.push(project);
      } else {
        const children = childrenByParent.get(parent) || [];
        children.push(project);
        childrenByParent.set(parent, children);
      }
    }

    // Sort function based on projectOrder
    const sortProjects = (projects: ProjectInfo[]): ProjectInfo[] => {
      return [...projects].sort((a, b) => {
        if (projectOrder.length === 0) {
          return a.path.localeCompare(b.path);
        }
        const aIndex = projectOrder.indexOf(a.name);
        const bIndex = projectOrder.indexOf(b.name);
        if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    };

    // Recursive tree builder
    const buildTree = (project: ProjectInfo): ProjectHierarchy => ({
      project,
      children: sortProjects(childrenByParent.get(project.name) || []).map(buildTree),
    });

    // Build trees for all top-level projects
    return sortProjects(topLevel).map(buildTree);
  }, [availableProjects, projectOrder]);

  const getCount = (view: ViewType): number => {
    if (view === 'recurring') {
      return tasks.filter((t) => t.recurrence && !t.completed).length;
    }
    if (view === 'wrapped' || view === 'agenda') {
      return 0;
    }

    return tasks.filter((task) => {
      if (task.completed) return view === 'logbook';
      if (view === 'logbook') return false;

      const whenType = getWhenType(task.when);
      switch (view) {
        case 'inbox':
          return whenType === 'inbox' && task.projects.length === 0;
        case 'today':
          // Include overdue tasks (date <= today)
          if (whenType === 'today' || whenType === 'evening') return true;
          if (whenType === 'date' && typeof task.when === 'object' && 'date' in task.when) {
            return isDateTodayOrEarlier(task.when.date);
          }
          return false;
        case 'upcoming':
          if (whenType === 'tomorrow') return true;
          if (whenType === 'date' && typeof task.when === 'object' && 'date' in task.when) {
            return isDateUpcoming(task.when.date);
          }
          // Also include tasks with a future deadline (even without a 'when' date)
          if (task.deadline && isDateUpcoming(task.deadline)) return true;
          return false;
        case 'anytime':
          return whenType === 'anytime';
        case 'someday':
          return whenType === 'someday';
        default:
          return false;
      }
    }).length;
  };

  const getProjectCount = (project: string): number => {
    return tasks.filter((t) => t.projects.includes(project) && !t.completed).length;
  };

  const getPersonCount = (person: string): number => {
    return tasks.filter((t) => t.persons.includes(person) && !t.completed).length;
  };

  const navItems: { id: ViewType; label: string }[] = [
    { id: 'inbox', label: 'Inbox' },
    { id: 'today', label: 'Today' },
    { id: 'agenda', label: 'Agenda' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'anytime', label: 'Anytime' },
    { id: 'someday', label: 'Someday' },
    { id: 'logbook', label: 'Logbook' },
    { id: 'recurring', label: 'Recurring' },
    { id: 'wrapped', label: 'Wrapped' },
    { id: 'review', label: 'Review' },
  ];

  const handleNavClick = (view: ViewType) => {
    setSelectedProject(null);
    setSelectedPerson(null);
    setSelectedTag(null);
    setCurrentView(view);
  };

  const handleTagClick = (tag: string) => {
    setCurrentView('inbox');
    setSelectedTag(tag);
  };

  // Nested-tag hierarchy for the Tags section (Obsidian-style parent/child).
  const tagTree = useMemo(() => buildTagTree(availableTags, tasks), [availableTags, tasks]);
  const toggleTagNode = (key: string) => {
    setExpandedTagNodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const renderTagNode = (node: TagNode, depth: number): React.ReactNode => {
    const isActive = selectedTag != null && sameTag(selectedTag, node.name);
    const tagColor = getTagColor(node.name, tagColors);
    const hasChildren = node.children.length > 0;
    const key = node.name.toLowerCase();
    const isOpen = expandedTagNodes.has(key);
    return (
      <li key={node.name} className="relative">
        <div className={`${rowClass(isActive)} justify-between`} style={{ paddingLeft: `${12 + depth * 16}px` }}>
          <span className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleTagNode(key); }}
                className="flex-shrink-0 text-[#8A8A8A] dark:text-[#666] hover:opacity-80"
                aria-label={isOpen ? 'Collapse' : 'Expand'}
              >
                {chevronIcon(isOpen)}
              </button>
            ) : (
              <span className="w-3.5 flex-shrink-0" />
            )}
            <button onClick={() => handleTagClick(node.name)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={isActive ? "currentColor" : tagColor} strokeWidth="1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  setColorPickerTag(colorPickerTag === node.name ? null : node.name);
                }}
              >
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="7" cy="7" r="1.5" fill={isActive ? "currentColor" : tagColor} stroke="none" />
              </svg>
              <span className="truncate">#{node.label}</span>
            </button>
          </span>
          {node.count > 0 && (
            <span className="text-[12px] text-[#8A8A8A] dark:text-[#888] font-normal flex-shrink-0 ml-2">
              {node.count}
            </span>
          )}
        </div>
        {colorPickerTag === node.name && (
          <ColorPicker
            currentColor={tagColor}
            onSelect={(newColor) => setTagColor(node.name, newColor)}
            onClose={() => setColorPickerTag(null)}
          />
        )}
        {hasChildren && isOpen && (
          <ul className="space-y-0.5">
            {node.children.map((child) => renderTagNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  const handleProjectClick = (project: string) => {
    setCurrentView('inbox');  // Clear the view so TaskList shows tasks, not recurring templates
    setSelectedProject(project);
  };

  const handlePersonClick = (person: string) => {
    setCurrentView('inbox');
    setSelectedPerson(person);
  };

  const handleSmartListClick = (id: string) => {
    setCurrentView('smart-list');
    setSelectedSmartList(id);
  };

  const handleColorClick = (e: React.MouseEvent, projectName: string) => {
    e.stopPropagation();
    setColorPickerProject(colorPickerProject === projectName ? null : projectName);
  };

  // Use imported getProjectColor with projectColors from store
  const getColor = (projectName: string, parentFolder?: string | null): string => {
    return getProjectColor(projectName, parentFolder, projectColors);
  };

  // Recursive function to render project tree at any depth
  const renderProjectTree = (node: ProjectHierarchy, depth: number = 0): React.ReactElement => {
    const { project, children } = node;
    const hasChildren = children.length > 0;
    const isExpanded = expandedFolders.has(project.name);
    const count = getProjectCount(project.name);
    const isActive = selectedProject === project.name;
    const color = getColor(project.name, project.parentFolder);
    const isSubProject = depth > 0;

    // Calculate indentation based on depth
    const depthIndent = depth * 16; // 16px per level of nesting

    return (
      <li key={project.path} className="relative">
        <div className="flex items-center group">
          {hasChildren ? (
            <button
              onClick={() => toggleFolder(project.name)}
              className="p-1 mr-0.5 text-[#8A8A8A] hover:text-[#555] dark:hover:text-[#AAA] transition-colors"
              style={{ marginLeft: depthIndent }}
            >
              {chevronIcon(isExpanded)}
            </button>
          ) : (
            <div className="p-1 mr-0.5 invisible" style={{ marginLeft: depthIndent }}>
              {chevronIcon(false)}
            </div>
          )}
          <button
            onClick={() => { if (renamingProject !== project.name) handleProjectClick(project.name); }}
            onContextMenu={(e) => { e.preventDefault(); setProjectContextMenu({ x: e.clientX, y: e.clientY, project }); }}
            className={`flex-1 flex items-center justify-between py-2 rounded-lg transition-all ${
              isSubProject ? 'text-[13px] font-normal' : 'text-[14px] font-medium'
            } ${
              isActive
                ? 'bg-[#EFECE4] dark:bg-white/[0.10] text-[#1A1A1A] dark:text-white'
                : isSubProject
                  ? 'text-[#666] dark:text-[#AAA] hover:bg-black/5 dark:hover:bg-white/5'
                  : 'text-[#1A1A1A] dark:text-[#E0E0E0] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            style={{ paddingLeft: 4, paddingRight: 12 }}
          >
            <span className="flex items-center gap-3 min-w-0 flex-1">
              <ProjectIcon
                color={color}
                active={isActive}
                onClick={(e) => handleColorClick(e, project.name)}
                size={isSubProject ? 'small' : 'normal'}
              />
              {renamingProject === project.name ? (
                <input
                  autoFocus
                  defaultValue={project.name}
                  className="bg-transparent border-b border-primary outline-none text-[14px] w-full"
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitProjectRename(project.name, e.currentTarget.value);
                    if (e.key === 'Escape') setRenamingProject(null);
                  }}
                  onBlur={e => submitProjectRename(project.name, e.currentTarget.value)}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="truncate">{project.name}</span>
              )}
            </span>
            {showProjectCounts && count > 0 && renamingProject !== project.name && (
              <span className="text-[12px] text-[#8A8A8A] dark:text-[#888] font-normal flex-shrink-0 ml-2">
                {count}
              </span>
            )}
          </button>
          <OpenFileButton path={project.path} />
        </div>
        {colorPickerProject === project.name && (
          <ColorPicker
            currentColor={color}
            onSelect={(newColor) => setProjectColor(project.name, newColor)}
            onClose={() => setColorPickerProject(null)}
          />
        )}
        {hasChildren && isExpanded && (
          <ul className="space-y-0.5 mt-0.5">
            {children.map((child) => renderProjectTree(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside
      ref={sidebarRef}
      className="bg-[#F8F7F6] dark:bg-[#1E1E1E] flex flex-col h-full relative"
      style={{ width: sidebarWidth }}
    >
      {/* Traffic light padding for macOS */}
      <div className="h-12 titlebar-drag" />


      <nav className="flex-1 px-4 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const count = getCount(item.id);
            const isActive = currentView === item.id && !selectedProject && !selectedPerson && !selectedTag;

            return (
              <li key={item.id}>
                <button
                  onClick={() => handleNavClick(item.id)}
                  className={`${rowClass(isActive)} justify-between`}
                >
                  <span className="flex items-center gap-3">
                    {getViewIcon(item.id, 'sm', isActive)}
                    <span>{item.label}</span>
                  </span>
                  {count > 0 && sidebarCounts[item.id] === true && (
                    <span className="text-[12px] text-[#8A8A8A] dark:text-[#888] font-normal">
                      {count}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Meta-nav cluster: People / Tags / Smart Lists — tight spacing between, mt-8 from nav above */}
        <div className="mt-8 flex flex-col">
          <>
            <div className="mb-2 px-3 py-1 flex items-center justify-between group">
              <button
                onClick={() => setIsPeopleExpanded(!isPeopleExpanded)}
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <span className="text-[#8A8A8A] dark:text-[#666]">
                  {chevronIcon(isPeopleExpanded)}
                </span>
                <h2 className={sectionHeadingClass}>People</h2>
              </button>
              <button
                onClick={() => setShowCreatePerson(true)}
                className="text-[#8A8A8A] hover:text-[#555] dark:hover:text-[#AAA] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-[120ms]"
                title="New Person"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {isPeopleExpanded && availablePeople.length > 0 && (
              <ul className="space-y-0.5">
                {availablePeople.map((person) => {
                  const count = getPersonCount(person.name);
                  const isActive = selectedPerson === person.name;
                  return (
                    <li key={person.path} className="group flex items-center">
                      <button
                        onClick={() => { if (renamingPerson !== person.name) handlePersonClick(person.name); }}
                        onContextMenu={(e) => { e.preventDefault(); setPersonContextMenu({ x: e.clientX, y: e.clientY, person }); }}
                        className={`${rowClass(isActive)} justify-between flex-1`}
                      >
                        <span className="flex items-center gap-3 min-w-0 flex-1">
                          {personIcon(isActive)}
                          {renamingPerson === person.name ? (
                            <input
                              autoFocus
                              defaultValue={person.name}
                              className="bg-transparent border-b border-primary outline-none text-[13px] w-full"
                              onKeyDown={e => {
                                if (e.key === 'Enter') submitPersonRename(person.name, e.currentTarget.value);
                                if (e.key === 'Escape') setRenamingPerson(null);
                              }}
                              onBlur={e => submitPersonRename(person.name, e.currentTarget.value)}
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <span className="truncate">{person.name}</span>
                          )}
                        </span>
                        {count > 0 && renamingPerson !== person.name && (
                          <span className="text-[12px] text-[#8A8A8A] dark:text-[#888] font-normal flex-shrink-0 ml-2">
                            {count}
                          </span>
                        )}
                      </button>
                      <OpenFileButton path={person.path} />
                    </li>
                  );
                })}
              </ul>
            )}
          </>

          {availableTags.length > 0 && (
            <>
              <button
                onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                className="mt-1 mb-2 px-3 py-1 flex items-center gap-1 w-full text-left hover:opacity-80 transition-opacity"
              >
                <span className="text-[#8A8A8A] dark:text-[#666]">
                  {chevronIcon(isTagsExpanded)}
                </span>
                <h2 className={sectionHeadingClass}>Tags</h2>
              </button>
              {isTagsExpanded && (
                <ul className="space-y-0.5">
                  {tagTree.map((node) => renderTagNode(node, 0))}
                </ul>
              )}
            </>
          )}

          {/* Smart Lists */}
          <div className="mt-1 mb-2 px-3 py-1 flex items-center justify-between group">
            <button
              onClick={() => setIsSmartListsExpanded(!isSmartListsExpanded)}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-[#8A8A8A] dark:text-[#666]">
                {chevronIcon(isSmartListsExpanded)}
              </span>
              <h2 className={sectionHeadingClass}>Smart Lists</h2>
            </button>
            <button
              onClick={() => { setEditingSmartList(undefined); setSmartListModalOpen(true); }}
              className="text-[#8A8A8A] hover:text-[#555] dark:hover:text-[#AAA] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-[120ms]"
              title="New Smart List"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {isSmartListsExpanded && smartLists.length > 0 && (
            <ul className="space-y-0.5">
              {smartLists.map((list) => {
                const isActive = currentView === 'smart-list' && selectedSmartListId === list.id;
                return (
                  <li key={list.id}>
                    <button
                      onClick={() => handleSmartListClick(list.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, listId: list.id });
                      }}
                      className={rowClass(isActive)}
                    >
                      <span className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-5 h-5 flex items-center justify-center text-base flex-shrink-0">
                          {list.icon}
                        </span>
                        <span className="truncate">{list.name}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-12 mb-2 px-3 flex items-center justify-between group">
          <h2 className={sectionHeadingClass}>Projects</h2>
          <button
            onClick={() => setCreateProjectParent(null)}
            className="text-[#8A8A8A] hover:text-[#555] dark:hover:text-[#AAA] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-[120ms]"
            title="New Project"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {projectHierarchy.length > 0 && (
          <SortableList
            ids={projectHierarchy.map(h => h.project.name)}
            onReorder={(from, to) => reorderProjects(from, to)}
          >
            <ul className="space-y-0.5">
              {projectHierarchy.map((item) => (
                <SortableItem key={item.project.path} id={item.project.name}>
                  {({ handleProps }) => (
                    <div {...handleProps}>{renderProjectTree(item)}</div>
                  )}
                </SortableItem>
              ))}
            </ul>
          </SortableList>
        )}
      </nav>

      {/* Agenda mini calendar — pinned between nav and bottom bar */}
      {currentView === 'agenda' && !selectedProject && !selectedPerson && !selectedTag && (
        <div className="flex-shrink-0 border-t border-[#E0E0E0] dark:border-[#333]">
          <AgendaDaySelector />
        </div>
      )}

      <div className="px-4 py-4 flex items-center justify-between">
        <span className="text-[11px] text-[#8A8A8A] dark:text-[#666]">
          {tasks.filter((t) => !t.completed).length} tasks
        </span>
        <button
          onClick={() => setShowShortcuts(true)}
          className="p-1.5 rounded-md text-[#8A8A8A] hover:text-[#555] dark:hover:text-[#AAA] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Keyboard shortcuts"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
        onMouseDown={() => setIsResizing(true)}
      />

      {showShortcuts && (
        <Suspense fallback={null}>
          <SettingsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
        </Suspense>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: 'Edit',
              onClick: () => {
                const list = smartLists.find(l => l.id === contextMenu.listId);
                setEditingSmartList(list);
                setSmartListModalOpen(true);
              },
            },
            {
              label: 'Delete',
              destructive: true,
              onClick: () => deleteSmartList(contextMenu.listId),
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}

      {smartListModalOpen && (
        <Suspense fallback={null}>
          <SmartListModal
            editList={editingSmartList}
            onClose={() => { setSmartListModalOpen(false); setEditingSmartList(undefined); }}
          />
        </Suspense>
      )}

      {projectContextMenu && (
        <ProjectContextMenu
          project={projectContextMenu.project}
          color={getColor(projectContextMenu.project.name, projectContextMenu.project.parentFolder)}
          x={projectContextMenu.x}
          y={projectContextMenu.y}
          onColor={() => {
            setColorPickerProject(projectContextMenu.project.name);
            setProjectContextMenu(null);
          }}
          onRename={() => {
            setRenamingProject(projectContextMenu.project.name);
            setProjectContextMenu(null);
          }}
          onAddSubproject={() => {
            setCreateProjectParent(projectContextMenu.project.name);
            setProjectContextMenu(null);
          }}
          onClose={() => setProjectContextMenu(null)}
        />
      )}

      {createProjectParent !== undefined && (
        <CreateProjectModal
          parentFolder={createProjectParent}
          onClose={() => setCreateProjectParent(undefined)}
        />
      )}

      {personContextMenu && (
        <PersonContextMenu
          person={personContextMenu.person}
          x={personContextMenu.x}
          y={personContextMenu.y}
          onRename={() => {
            setRenamingPerson(personContextMenu.person.name);
            setPersonContextMenu(null);
          }}
          onClose={() => setPersonContextMenu(null)}
        />
      )}

      {showCreatePerson && (
        <CreatePersonModal onClose={() => setShowCreatePerson(false)} />
      )}
    </aside>
  );
}
