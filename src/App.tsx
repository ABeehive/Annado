import React, { useState, lazy, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useTaskStore } from './stores/taskStore';
import { PanelProvider } from './contexts/PanelContext';
import { Sidebar } from './components/Sidebar';
import { TaskList } from './components/TaskList';
import { SidePanel } from './components/SidePanel';
import { QuickAdd } from './components/QuickAdd';
import { MoveToProjectModal } from './components/MoveToProjectModal';
import { QuickFind } from './components/QuickFind';
import { VaultSelector } from './components/VaultSelector';
import { RecurringTaskModal } from './components/RecurringTaskModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ErrorToast } from './components/ErrorToast';
import { RecurringTemplate } from './types/task';

// Feature views are loaded on demand — keeps the startup bundle small.
const WrappedView = lazy(() => import('./features/wrapped/WrappedView').then((m) => ({ default: m.WrappedView })));
const AgendaView = lazy(() => import('./features/agenda/AgendaView').then((m) => ({ default: m.AgendaView })));
const ReviewView = lazy(() => import('./features/review/ReviewView').then((m) => ({ default: m.ReviewView })));
import { useTheme } from './hooks/useTheme';
import { useAppEvents } from './hooks/useAppEvents';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useKeyboardHandler } from './hooks/useKeyboardHandler';
import './App.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('ErrorBoundary caught:', error, info.componentStack); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p>Something went wrong.</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { vaultPath, currentView } = useTaskStore(useShallow((s) => ({ vaultPath: s.vaultPath, currentView: s.currentView, })));
  useTheme();
  useAppEvents();
  const [moveToProjectOpen, setMoveToProjectOpen] = useState(false);
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [quickFindInitialQuery, setQuickFindInitialQuery] = useState('');
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [editingRecurringTemplate, setEditingRecurringTemplate] = useState<RecurringTemplate | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  useKeyboardHandler({
    moveToProjectOpen, quickFindOpen, confirmModal,
    setMoveToProjectOpen, setQuickFindOpen, setQuickFindInitialQuery,
    setRecurringModalOpen, setEditingRecurringTemplate, setConfirmModal,
  });

  const handleQuickFindClose = () => {
    setQuickFindOpen(false);
    setQuickFindInitialQuery('');
  };

  const { activeDragTask, dndSensors, handleDragStart, handleDragEnd } = useDragAndDrop();

  const handleRecurringModalClose = () => {
    setRecurringModalOpen(false);
    setEditingRecurringTemplate(null);
  };

  const handleOpenRecurringModal = (template?: RecurringTemplate) => {
    setEditingRecurringTemplate(template || null);
    setRecurringModalOpen(true);
  };

  if (!vaultPath) {
    return (
      <ErrorBoundary>
        <VaultSelector />
        <QuickAdd />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-screen flex bg-[#FEFEFE] dark:bg-[#1A1A1A]">
        {/* Drag zone for window movement - covers top of window */}
        <div
          data-tauri-drag-region
          className="fixed top-0 left-0 right-0 h-8 z-[9999]"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          onMouseDown={(e) => {
            // Only drag if not clicking on interactive elements
            if ((e.target as HTMLElement).closest('button, input, select, a')) return;
            e.preventDefault();
            getCurrentWindow().startDragging();
          }}
        />
        <Sidebar />
        <DndContext
          sensors={dndSensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {currentView === 'wrapped' ? (
            <Suspense fallback={<div className="flex-1" />}><WrappedView /></Suspense>
          ) : currentView === 'agenda' ? (
            <Suspense fallback={<div className="flex-1" />}><AgendaView /></Suspense>
          ) : currentView === 'review' ? (
            <Suspense fallback={<div className="flex-1" />}><ReviewView /></Suspense>
          ) : (
            <PanelProvider value={{ panelId: 'main' }}>
              <TaskList
                onOpenRecurringModal={handleOpenRecurringModal}
              />
            </PanelProvider>
          )}
          <SidePanel />
          <DragOverlay>
            {activeDragTask ? (
              <div className="bg-white dark:bg-[#2A2A2A] rounded-lg shadow-lg border border-[#E0E0E0] dark:border-[#3A3A3A] px-4 py-2 max-w-[300px]">
                <span className="text-[14px] text-[#1A1A1A] dark:text-[#E8E8E8] truncate block">
                  {activeDragTask.title}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        <QuickAdd />
        <MoveToProjectModal isOpen={moveToProjectOpen} onClose={() => setMoveToProjectOpen(false)} />
        <QuickFind isOpen={quickFindOpen} onClose={handleQuickFindClose} initialQuery={quickFindInitialQuery} />
        <RecurringTaskModal isOpen={recurringModalOpen} onClose={handleRecurringModalClose} editTemplate={editingRecurringTemplate} />
        <ConfirmModal
          open={confirmModal !== null}
          message={confirmModal?.message ?? ''}
          onConfirm={confirmModal?.onConfirm ?? (() => {})}
          onCancel={() => setConfirmModal(null)}
        />
        <ErrorToast />
      </div>
    </ErrorBoundary>
  );
}

export default App;
