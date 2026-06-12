import { useEffect } from 'react';
import { useTaskStore } from '../stores/taskStore';

export function ErrorToast() {
  const error = useTaskStore((s) => s.error);
  const clearError = useTaskStore((s) => s.clearError);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(clearError, 4000);
    return () => clearTimeout(id);
  }, [error, clearError]);

  if (!error) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] max-w-sm bg-[#2A2A2A] dark:bg-[#3A3A3A] text-white rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.4)] px-4 py-3 flex items-start gap-3">
      <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium">Save failed</p>
        <p className="text-[12px] text-[#AAA] mt-0.5 break-words">{error}</p>
      </div>
      <button
        onClick={clearError}
        className="text-[#888] hover:text-[#CCC] transition-colors flex-shrink-0 mt-0.5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
