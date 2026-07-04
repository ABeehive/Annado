import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from '../taskStore';

describe('reorderProjects', () => {
  beforeEach(() => {
    localStorage.clear();
    useTaskStore.setState({ projectOrder: [] });
  });

  it('seeds from the displayed order so the first drag matches the screen', () => {
    // Displayed (alphabetical) order differs from any raw store order.
    const displayed = ['Alpha', 'Beta', 'Gamma'];
    useTaskStore.getState().reorderProjects('Gamma', 'Alpha', displayed);
    expect(useTaskStore.getState().projectOrder).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  it('appends projects unknown to the saved order before splicing', () => {
    useTaskStore.setState({ projectOrder: ['Beta', 'Alpha'] });
    // "New" arrived after the order was saved; it is displayed last.
    useTaskStore.getState().reorderProjects('New', 'Beta', ['Beta', 'Alpha', 'New']);
    expect(useTaskStore.getState().projectOrder).toEqual(['New', 'Beta', 'Alpha']);
  });

  it('reorders children within their sibling group via the same flat list', () => {
    // Parent P with children C1, C2 — displayed flat: P, C1, C2.
    useTaskStore.getState().reorderProjects('C2', 'C1', ['P', 'C1', 'C2']);
    expect(useTaskStore.getState().projectOrder).toEqual(['P', 'C2', 'C1']);
  });
});
