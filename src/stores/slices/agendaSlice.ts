import type { SliceCreator } from './types';
import { persist } from '../storeUtils';
import { WorkSchedule, DEFAULT_WORK_SCHEDULE } from '../../features/agenda/types';

function loadPersistedAgenda() {
  try {
    const agendaSubView = localStorage.getItem('agendaSubView') as 'day' | 'week' | null;
    const weekStartsOn = localStorage.getItem('weekStartsOn') as 'monday' | 'sunday' | null;
    const workSchedule = localStorage.getItem('workSchedule');
    return {
      agendaSubView: agendaSubView && ['day', 'week'].includes(agendaSubView) ? agendaSubView : 'day' as const,
      agendaShowWeekends: JSON.parse(localStorage.getItem('agendaShowWeekends') ?? 'false') as boolean,
      weekStartsOn: weekStartsOn && ['monday', 'sunday'].includes(weekStartsOn) ? weekStartsOn : 'monday' as const,
      defaultTaskDuration: parseInt(localStorage.getItem('defaultTaskDuration') ?? '30', 10),
      workSchedule: workSchedule ? JSON.parse(workSchedule) as WorkSchedule : DEFAULT_WORK_SCHEDULE,
    };
  } catch {
    return {
      agendaSubView: 'day' as const,
      agendaShowWeekends: false,
      weekStartsOn: 'monday' as const,
      defaultTaskDuration: 30,
      workSchedule: DEFAULT_WORK_SCHEDULE,
    };
  }
}

const persisted = loadPersistedAgenda();

export interface AgendaSlice {
  agendaSubView: 'day' | 'week';
  agendaSelectedDate: string;
  agendaShowWeekends: boolean;
  weekStartsOn: 'monday' | 'sunday';
  defaultTaskDuration: number;
  agendaEditingTaskId: string | null;
  workSchedule: WorkSchedule;

  setAgendaSubView: (subView: 'day' | 'week') => void;
  setAgendaSelectedDate: (date: string) => void;
  setAgendaShowWeekends: (show: boolean) => void;
  setWeekStartsOn: (day: 'monday' | 'sunday') => void;
  setDefaultTaskDuration: (minutes: number) => void;
  setAgendaEditingTaskId: (id: string | null) => void;
  setWorkSchedule: (schedule: WorkSchedule) => void;
}

export const createAgendaSlice: SliceCreator<AgendaSlice> = (set) => ({
  agendaSubView: persisted.agendaSubView,
  agendaSelectedDate: new Date().toISOString().slice(0, 10),
  agendaShowWeekends: persisted.agendaShowWeekends,
  weekStartsOn: persisted.weekStartsOn,
  defaultTaskDuration: persisted.defaultTaskDuration,
  agendaEditingTaskId: null,
  workSchedule: persisted.workSchedule,

  setAgendaSubView: (subView) => { set({ agendaSubView: subView }); persist('agendaSubView', subView); },
  setAgendaSelectedDate: (date) => set({ agendaSelectedDate: date }),
  setAgendaShowWeekends: (show) => { set({ agendaShowWeekends: show }); persist('agendaShowWeekends', show); },
  setWeekStartsOn: (day) => { set({ weekStartsOn: day }); persist('weekStartsOn', day); },
  setDefaultTaskDuration: (minutes) => { set({ defaultTaskDuration: minutes }); persist('defaultTaskDuration', minutes); },
  setAgendaEditingTaskId: (id) => set({ agendaEditingTaskId: id }),
  setWorkSchedule: (schedule) => { set({ workSchedule: schedule }); persist('workSchedule', schedule); },
});
