import { describe, it, expect } from 'vitest';
import { buildProjectHierarchy } from './projectHierarchy';
import type { ProjectInfo } from '../types/task';

const proj = (name: string, up: string | null = null): ProjectInfo => ({
  name,
  path: `02. Projects/${name}.md`,
  depth: 0,
  parentFolder: null,
  metadata: { up } as ProjectInfo['metadata'],
});

describe('buildProjectHierarchy', () => {
  it('renders a project with no up as top-level', () => {
    const tree = buildProjectHierarchy([proj('Alpha')], []);
    expect(tree.map((n) => n.project.name)).toEqual(['Alpha']);
  });

  it('nests a child under its resolvable up parent', () => {
    const tree = buildProjectHierarchy([proj('Parent'), proj('Child', 'Parent')], []);
    expect(tree.map((n) => n.project.name)).toEqual(['Parent']);
    expect(tree[0].children.map((n) => n.project.name)).toEqual(['Child']);
  });

  it('renders a project top-level when its up does not resolve (the iHub case)', () => {
    const tree = buildProjectHierarchy(
      [proj('Parent'), proj('iHub', '02. Projects')], // index note is never a project
      [],
    );
    expect(tree.map((n) => n.project.name).sort()).toEqual(['Parent', 'iHub'].sort());
    expect(tree.every((n) => n.children.length === 0)).toBe(true);
  });

  it('renders a self-referencing up top-level (no recursion)', () => {
    const tree = buildProjectHierarchy([proj('Loop', 'Loop')], []);
    expect(tree.map((n) => n.project.name)).toEqual(['Loop']);
    expect(tree[0].children).toEqual([]);
  });

  it('sorts by projectOrder, unknown names after known ones', () => {
    const tree = buildProjectHierarchy(
      [proj('B'), proj('A'), proj('C')],
      ['C', 'A'],
    );
    expect(tree.map((n) => n.project.name)).toEqual(['C', 'A', 'B']);
  });
});
