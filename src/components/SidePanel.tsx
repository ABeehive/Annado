import { useState, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PanelProvider } from '../contexts/PanelContext';
import { useTaskStore } from '../stores/taskStore';
import { TaskList } from './TaskList';
import { ViewType } from '../types/task';
import { viewIconsSmall } from '../utils/viewIcons';

const viewOptions: { value: ViewType; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'anytime', label: 'Anytime' },
  { value: 'someday', label: 'Someday' },
  { value: 'logbook', label: 'Logbook' },
];

export function SidePanel() {
  const { sidePanelOpen, sidePanelWidth, sidePanelView, sidePanelSelectedProject, sidePanelSelectedPerson, sidePanelSelectedTag, setSidePanelOpen, setSidePanelWidth, setSidePanelView, setSidePanelSelectedProject, setSidePanelSelectedPerson, setSidePanelSelectedTag } = useTaskStore(useShallow((s) => ({ sidePanelOpen: s.sidePanelOpen, sidePanelWidth: s.sidePanelWidth, sidePanelView: s.sidePanelView, sidePanelSelectedProject: s.sidePanelSelectedProject, sidePanelSelectedPerson: s.sidePanelSelectedPerson, sidePanelSelectedTag: s.sidePanelSelectedTag, setSidePanelOpen: s.setSidePanelOpen, setSidePanelWidth: s.setSidePanelWidth, setSidePanelView: s.setSidePanelView, setSidePanelSelectedProject: s.setSidePanelSelectedProject, setSidePanelSelectedPerson: s.setSidePanelSelectedPerson, setSidePanelSelectedTag: s.setSidePanelSelectedTag, })));

  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle resize drag
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const windowWidth = window.innerWidth;
      const newWidth = Math.max(280, Math.min(600, windowWidth - e.clientX));
      setSidePanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, setSidePanelWidth]);

  // Determine if we're in a sub-view (project/person/tag)
  const subViewLabel = sidePanelSelectedTag
    ? `#${sidePanelSelectedTag}`
    : sidePanelSelectedPerson || sidePanelSelectedProject || null;

  const handleBack = () => {
    setSidePanelSelectedProject(null);
    setSidePanelSelectedPerson(null);
    setSidePanelSelectedTag(null);
  };

  return (
    <div
      ref={panelRef}
      className="side-panel flex-shrink-0 relative bg-[#FEFEFE] dark:bg-[#1A1A1A] border-l border-[#E8E8E8] dark:border-[#2A2A2A]"
      style={{ width: sidePanelOpen ? sidePanelWidth : 0 }}
    >
      <div
        className="h-full min-h-0 flex flex-col"
        style={{ minWidth: sidePanelWidth }}
      >
        {/* Resize handle on left edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-10"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-12 pb-3 titlebar-drag titlebar-header titlebar-header-compact">
          {subViewLabel ? (
            <>
              <button
                onClick={handleBack}
                className="flex-shrink-0 p-1 rounded hover:bg-[#F0F0F0] dark:hover:bg-[#2A2A2A] text-[#888] dark:text-[#666] transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span className="text-[14px] font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] truncate flex-1">
                {subViewLabel}
              </span>
            </>
          ) : (
            <>
              <div className="flex-shrink-0">
                {viewIconsSmall[sidePanelView]}
              </div>
              <select
                value={sidePanelView}
                onChange={(e) => setSidePanelView(e.target.value as ViewType)}
                className="flex-1 text-[14px] font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] bg-transparent border-none focus:outline-none cursor-pointer appearance-none"
              >
                {viewOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </>
          )}

          {/* Close button */}
          <button
            onClick={() => setSidePanelOpen(false)}
            className="flex-shrink-0 p-1 rounded hover:bg-[#F0F0F0] dark:hover:bg-[#2A2A2A] text-[#888] dark:text-[#666] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Task list - reused component without new todo / recurring features */}
        <PanelProvider value={{ panelId: 'sidePanel' }}>
          <TaskList />
        </PanelProvider>
      </div>
    </div>
  );
}
