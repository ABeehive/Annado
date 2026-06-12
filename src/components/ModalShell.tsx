import { ReactNode } from 'react';
import { modalShadow } from '../utils/styles';

interface ModalShellProps {
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
  children: ReactNode;
  maxWidth?: string;
  paddingTop?: string;
}

export function ModalShell({
  title,
  submitLabel,
  onClose,
  onSubmit,
  disabled,
  children,
  maxWidth = 'max-w-lg',
  paddingTop = 'pt-[10vh]',
}: ModalShellProps) {
  return (
    <div className={`fixed inset-0 z-50 flex items-start justify-center ${paddingTop}`}>
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} mx-4 bg-white dark:bg-[#2A2A2A] rounded-xl ${modalShadow}`}>
        <form onSubmit={onSubmit}>
          <div className="px-5 py-3.5 border-b border-[#E8E8E8] dark:border-[#3A3A3A] flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">{title}</h2>
            <button type="button" onClick={onClose} className="text-[#888] hover:text-[#555] dark:hover:text-[#CCC] transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {children}
          </div>
          <div className="px-5 py-3.5 border-t border-[#E8E8E8] dark:border-[#3A3A3A] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-[13px] text-[#888] hover:text-[#555] dark:hover:text-[#CCC] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disabled}
              className="px-4 py-1.5 text-[13px] bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
