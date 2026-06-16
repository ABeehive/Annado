import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Toggle } from '../../components/Toggle';

interface NotificationPrefs {
  trayEnabled: boolean;
  enabled: boolean;
  morningOfDeadline: boolean;
  morningTime: string;
  dayBefore: boolean;
  dayBeforeTime: string;
  overdueDaily: boolean;
  overdueTime: string;
  launchBanner: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
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

function TimeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="text-[12px] px-2 py-1 rounded-lg border border-[#E8E8E8] dark:border-[#3A3A3A] bg-white dark:bg-[#333] text-[#1A1A1A] dark:text-[#E0E0E0] disabled:opacity-40 focus:outline-none focus:border-primary"
    />
  );
}

function SettingRow({
  label,
  detail,
  checked,
  onToggle,
  disabled,
  children,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">{label}</p>
        {detail && <p className="text-[11px] text-[#B0B0B0] dark:text-[#555] mt-0.5">{detail}</p>}
        {children && <div className="mt-2">{children}</div>}
      </div>
      <Toggle checked={checked} onChange={onToggle} />
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Notification failed.';
}

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    invoke<NotificationPrefs>('get_notification_prefs')
      .then(setPrefs)
      .catch(console.error);
  }, []);

  const save = async (updated: NotificationPrefs) => {
    setPrefs(updated);
    try {
      await invoke('save_notification_prefs', { prefs: updated });
    } catch (e) {
      console.error('[notifications] save failed', e);
    }
  };

  const toggle = (key: keyof NotificationPrefs) => {
    save({ ...prefs, [key]: !prefs[key] });
  };

  const setTime = (key: keyof NotificationPrefs, value: string) => {
    save({ ...prefs, [key]: value });
  };

  const handleTrayToggle = async () => {
    const next = !prefs.trayEnabled;
    setPrefs(p => ({ ...p, trayEnabled: next }));
    try {
      await invoke('set_tray_enabled', { enabled: next });
    } catch (e) {
      console.error('[notifications] set_tray_enabled failed', e);
      setPrefs(p => ({ ...p, trayEnabled: !next }));
    }
  };

  const handleSendTest = async () => {
    try {
      setTestError(null);
      await invoke('send_test_notification');
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } catch (e) {
      console.error('[notifications] test notification failed', e);
      setTestSent(false);
      setTestError(getErrorMessage(e));
    }
  };

  const notifDisabled = !prefs.enabled;

  return (
    <div className="px-7 py-6 space-y-8">
      {/* System Tray */}
      <div>
        <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
          System Tray
        </h3>
        <SettingRow
          label="Show system tray icon"
          detail="Click the icon in the system tray to open a quick task panel"
          checked={prefs.trayEnabled}
          onToggle={handleTrayToggle}
        />
      </div>

      {/* Notifications master toggle */}
      <div>
        <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
          Notifications
        </h3>
        <SettingRow
          label="Enable notifications"
          detail="Receive OS notifications for deadlines and overdue tasks"
          checked={prefs.enabled}
          onToggle={() => toggle('enabled')}
        />
      </div>

      {/* Deadline reminders */}
      <div>
        <h3 className={`text-[10px] font-semibold uppercase tracking-wider mb-3 ${notifDisabled ? 'text-[#D0D0D0] dark:text-[#3A3A3A]' : 'text-[#B0B0B0] dark:text-[#555]'}`}>
          Deadline Reminders
        </h3>
        <div className="space-y-5">
          <SettingRow
            label="Morning of deadline"
            checked={prefs.morningOfDeadline}
            onToggle={() => toggle('morningOfDeadline')}
            disabled={notifDisabled}
          >
            <TimeInput
              value={prefs.morningTime}
              onChange={v => setTime('morningTime', v)}
              disabled={notifDisabled || !prefs.morningOfDeadline}
            />
          </SettingRow>

          <SettingRow
            label="Evening before deadline"
            checked={prefs.dayBefore}
            onToggle={() => toggle('dayBefore')}
            disabled={notifDisabled}
          >
            <TimeInput
              value={prefs.dayBeforeTime}
              onChange={v => setTime('dayBeforeTime', v)}
              disabled={notifDisabled || !prefs.dayBefore}
            />
          </SettingRow>

          <SettingRow
            label="Daily overdue reminder"
            detail="For tasks with a past deadline"
            checked={prefs.overdueDaily}
            onToggle={() => toggle('overdueDaily')}
            disabled={notifDisabled}
          >
            <TimeInput
              value={prefs.overdueTime}
              onChange={v => setTime('overdueTime', v)}
              disabled={notifDisabled || !prefs.overdueDaily}
            />
          </SettingRow>
        </div>
      </div>

      {/* In-App */}
      <div>
        <h3 className={`text-[10px] font-semibold uppercase tracking-wider mb-3 ${notifDisabled ? 'text-[#D0D0D0] dark:text-[#3A3A3A]' : 'text-[#B0B0B0] dark:text-[#555]'}`}>
          In-App
        </h3>
        <SettingRow
          label="Launch banner"
          detail="Show a summary banner when the app opens"
          checked={prefs.launchBanner}
          onToggle={() => toggle('launchBanner')}
          disabled={notifDisabled}
        />
      </div>

      {/* Test */}
      <div>
        <h3 className="text-[10px] font-semibold text-[#B0B0B0] dark:text-[#555] uppercase tracking-wider mb-3">
          Test
        </h3>
        <button
          onClick={handleSendTest}
          className="px-4 py-2 text-[12px] font-medium bg-[#F5F5F5] dark:bg-[#333] border border-[#E8E8E8] dark:border-[#3A3A3A] rounded-lg text-[#1A1A1A] dark:text-[#E0E0E0] hover:bg-[#EBEBEB] dark:hover:bg-[#3A3A3A] transition-colors"
        >
          {testSent ? 'Sent!' : 'Send test notification'}
        </button>
        {testError && (
          <p role="alert" className="text-[12px] text-danger mt-2">
            {testError}
          </p>
        )}
      </div>
    </div>
  );
}
