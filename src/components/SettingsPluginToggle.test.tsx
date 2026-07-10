import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));

import { useTaskStore } from '../stores/taskStore';
import { SettingsModal } from './SettingsModal';

describe('Obsidian plugin toggle', () => {
  const setUsedWithObsidianPlugin = vi.fn();
  beforeEach(() => {
    setUsedWithObsidianPlugin.mockClear();
    useTaskStore.setState({
      usedWithObsidianPlugin: false,
      setUsedWithObsidianPlugin,
    });
  });

  it('renders in General and toggles the setting', () => {
    render(<SettingsModal isOpen onClose={() => {}} />);
    const label = screen.getByText(/used with the Obsidian plugin/i);
    expect(label).toBeInTheDocument();
    // The row's switch is the toggle next to the label.
    const row = label.closest('div')?.parentElement as HTMLElement;
    const toggle = row.querySelector('[role="switch"]') as HTMLElement;
    fireEvent.click(toggle);
    expect(setUsedWithObsidianPlugin).toHaveBeenCalledWith(true);
  });
});
