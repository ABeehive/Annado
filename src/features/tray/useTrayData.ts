import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Task, PersonInfo, ProjectInfo } from '../../types/task';
import { isDateTodayOrEarlier } from '../../utils/dates';

function isWhenToday(when: Task['when']): boolean {
  if (typeof when === 'string') {
    return when === 'today' || when === 'evening';
  }
  return isDateTodayOrEarlier(when.date);
}

export interface TrayData {
  todayTasks: Task[];
  deadlineTasks: Task[];
  isVaultReady: boolean;
  isLoading: boolean;
  personNames: Set<string>;
  projectNames: Set<string>;
  projectColors: Record<string, string>;
  availableProjects: ProjectInfo[];
}

export function useTrayData(): TrayData {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [persons, setPersons] = useState<PersonInfo[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [isVaultReady, setIsVaultReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      const [result, fetchedPersons, fetchedProjects] = await Promise.all([
        invoke<Task[]>('get_tasks'),
        invoke<PersonInfo[]>('get_all_persons').catch(() => [] as PersonInfo[]),
        invoke<ProjectInfo[]>('get_all_projects').catch(() => [] as ProjectInfo[]),
      ]);
      setTasks(result);
      setPersons(fetchedPersons);
      setProjects(fetchedProjects);
      setIsVaultReady(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Vault not initialized') || msg.includes('not initialized')) {
        setIsVaultReady(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();

    let unlisten: (() => void) | undefined;
    listen<Task[]>('tasks-updated', (event) => {
      setTasks(event.payload);
      setIsVaultReady(true);
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, []);

  const incomplete = tasks.filter(t => !t.completed);
  const todayTasks = incomplete.filter(t => isWhenToday(t.when));
  const todayIds = new Set(todayTasks.map(t => t.id));
  const deadlineTasks = incomplete.filter(
    t => t.deadline && isDateTodayOrEarlier(t.deadline) && !todayIds.has(t.id)
  );

  const projectColors: Record<string, string> = JSON.parse(
    localStorage.getItem('projectColors') || '{}'
  );

  return {
    todayTasks,
    deadlineTasks,
    isVaultReady,
    isLoading,
    personNames: new Set(persons.map(p => p.name)),
    projectNames: new Set(projects.map(p => p.name)),
    projectColors,
    availableProjects: projects,
  };
}
