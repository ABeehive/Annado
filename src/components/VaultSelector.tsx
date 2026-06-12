import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useTaskStore } from '../stores/taskStore';

export function VaultSelector() {
  const { setVaultPath, isLoading, error } = useTaskStore();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSelectVault = async () => {
    try {
      setLocalError(null);
      const selected = await open({
        directory: true,
        title: 'Select your vault folder',
      });

      if (selected && typeof selected === 'string') {
        await setVaultPath(selected);
      }
    } catch (err) {
      setLocalError(String(err));
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-[#FAFAFA] dark:bg-[#1A1A1A]">
      <div className="text-center max-w-md px-8">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>

        <h1 className="text-[24px] font-bold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          Annado
        </h1>
        <p className="text-[14px] text-[#666] dark:text-[#888] mb-8 leading-relaxed">
          A task manager for your markdown files.
        </p>

        <button
          onClick={handleSelectVault}
          disabled={isLoading}
          className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-[#4A5AAF] disabled:opacity-50 transition-colors font-medium text-[14px] shadow-sm"
        >
          {isLoading ? 'Loading...' : 'Select Vault'}
        </button>

        {(error || localError) && (
          <p className="mt-4 text-[13px] text-danger">{error || localError}</p>
        )}

        <p className="mt-10 text-[12px] text-[#A0A0A0] dark:text-[#666] leading-relaxed">
          Tasks are stored as markdown checkboxes.
          <br />
          <code className="bg-[#F0F0F0] dark:bg-[#2A2A2A] px-1.5 py-0.5 rounded text-[11px] mt-1 inline-block">
            - [ ] Buy groceries @when(today)
          </code>
        </p>
      </div>
    </div>
  );
}
