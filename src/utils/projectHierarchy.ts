import type { ProjectInfo } from '../types/task';

export interface ProjectHierarchy {
  project: ProjectInfo;
  children: ProjectHierarchy[];
}

/**
 * Build the sidebar's project tree. A project whose `up:` does not resolve to an
 * existing project (index note, archived/renamed/deleted parent, self-reference)
 * renders top-level instead of silently disappearing from the sidebar.
 */
export function buildProjectHierarchy(
  projects: ProjectInfo[],
  projectOrder: string[],
): ProjectHierarchy[] {
  const names = new Set(projects.map((p) => p.name));
  const childrenByParent = new Map<string, ProjectInfo[]>();
  const topLevel: ProjectInfo[] = [];

  for (const project of projects) {
    const parent = project.metadata.up || null;
    if (!parent || !names.has(parent) || parent === project.name) {
      topLevel.push(project);
    } else {
      const children = childrenByParent.get(parent) || [];
      children.push(project);
      childrenByParent.set(parent, children);
    }
  }

  const sortProjects = (list: ProjectInfo[]): ProjectInfo[] => {
    return [...list].sort((a, b) => {
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

  const buildTree = (project: ProjectInfo): ProjectHierarchy => ({
    project,
    children: sortProjects(childrenByParent.get(project.name) || []).map(buildTree),
  });

  return sortProjects(topLevel).map(buildTree);
}
