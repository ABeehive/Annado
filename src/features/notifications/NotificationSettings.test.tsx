import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { NotificationSettings } from './NotificationSettings';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const defaultPrefs = {
  trayEnabled: true,
  enabled: true,
  morningOfDeadline: true,
  morningTime: '09:00',
  dayBefore: true,
  dayBeforeTime: '18:00',
  overdueDaily: true,
  overdueTime: '08:00',
  launchBanner: true,
};

describe('NotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'get_notification_prefs') return defaultPrefs;
      return undefined;
    });
  });

  it('sends a test notification and shows success state', async () => {
    render(<NotificationSettings />);

    await userEvent.click(await screen.findByRole('button', { name: 'Send test notification' }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('send_test_notification');
    });
    expect(screen.getByRole('button', { name: 'Sent!' })).toBeInTheDocument();
  });

  it('surfaces test notification errors in the UI', async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'get_notification_prefs') return defaultPrefs;
      if (command === 'send_test_notification') throw 'Windows notifications are disabled';
      return undefined;
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<NotificationSettings />);

    await userEvent.click(await screen.findByRole('button', { name: 'Send test notification' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Windows notifications are disabled');
    consoleError.mockRestore();
  });

  it('saves notification preferences on toggle', async () => {
    render(<NotificationSettings />);

    await screen.findByText('Enable notifications');
    const switches = screen.getAllByRole('switch');
    await userEvent.click(switches[1]);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('save_notification_prefs', {
        prefs: { ...defaultPrefs, enabled: false },
      });
    });
  });
});
