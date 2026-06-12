import { useState } from 'react';
import { PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { useTaskStore } from '../stores/taskStore';
import type { Task, WhenValue } from '../types/task';

export function useDragAndDrop() {
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragTask(event.active.data.current?.task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragTask(null);
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);

    // Agenda timeslot drop: agenda-timeslot-YYYY-MM-DD-minutes
    const agendaMatch = overId.match(/^agenda-timeslot-(\d{4}-\d{2}-\d{2})-(\d+)$/);
    if (agendaMatch) {
      const targetDate = agendaMatch[1];
      const totalMinutes = parseInt(agendaMatch[2], 10);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const scheduledTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

      const activeId = String(active.id);
      const taskMatch = activeId.match(/^(?:main|sidePanel|agenda)-(.+)$/);
      const taskId = taskMatch ? taskMatch[1] : activeId;

      const store = useTaskStore.getState();
      const draggedTask = store.tasks.find(t => t.id === taskId);
      const duration = draggedTask?.durationMinutes || 30;
      const proposedEnd = totalMinutes + duration;
      const todayStr = new Date().toISOString().slice(0, 10);

      const hasConflict = store.tasks.some(t => {
        if (t.id === taskId || t.completed || !t.scheduledTime) return false;
        let taskDate: string | null = null;
        if (typeof t.when === 'object' && 'date' in t.when) {
          taskDate = t.when.date;
        } else if ((t.when === 'today' || t.when === 'evening') && targetDate === todayStr) {
          taskDate = todayStr;
        }
        if (taskDate !== targetDate) return false;

        const otherStart = parseInt(t.scheduledTime!.split(':')[0], 10) * 60 + parseInt(t.scheduledTime!.split(':')[1], 10);
        const otherEnd = otherStart + (t.durationMinutes || 30);
        return totalMinutes < otherEnd && proposedEnd > otherStart;
      });

      if (hasConflict) return;

      store.updateTask({ id: taskId, when: { date: targetDate }, scheduledTime });
      return;
    }

    // Agenda unscheduled drop zone
    if (overId === 'agenda-unscheduled') {
      const activeId = String(active.id);
      const taskMatch = activeId.match(/^(?:main|sidePanel|agenda)-(.+)$/);
      const taskId = taskMatch ? taskMatch[1] : activeId;
      useTaskStore.getState().updateTask({ id: taskId, scheduledTime: '' });
      return;
    }

    // View-level drop: move task to a view (inbox, today, anytime, someday)
    const viewMatch = overId.match(/^(?:main|sidePanel)-view-(.+)$/);
    if (viewMatch) {
      const targetView = viewMatch[1];
      const whenMap: Record<string, WhenValue> = {
        inbox: 'inbox',
        today: 'today',
        anytime: 'anytime',
        someday: 'someday',
      };
      if (whenMap[targetView]) {
        const activeId = String(active.id);
        const taskMatch = activeId.match(/^(?:main|sidePanel|agenda)-(.+)$/);
        const taskId = taskMatch ? taskMatch[1] : activeId;
        useTaskStore.getState().updateTask({ id: taskId, when: whenMap[targetView] });
      }
      return;
    }

    const dayMatch = overId.match(/^(?:main|sidePanel)-day-(.+)$/);
    if (!dayMatch) return;

    const targetDate = dayMatch[1];
    const activeId = String(active.id);
    const taskMatch = activeId.match(/^(?:main|sidePanel|agenda)-(.+)$/);
    const taskId = taskMatch ? taskMatch[1] : activeId;
    useTaskStore.getState().updateTask({ id: taskId, when: { date: targetDate } });
  };

  return { activeDragTask, dndSensors, handleDragStart, handleDragEnd };
}
