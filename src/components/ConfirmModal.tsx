import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { modalShadow } from '../utils/styles';

interface ConfirmModalProps {
  open: boolean;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ open, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onConfirm(); onCancel(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  // Portal to document.body so the fixed-position overlay escapes any
  // transformed / content-visibility ancestor. Without this, ConfirmModal
  // rendered inside a virtualized list row (which sits in a `transform:
  // translateY(...)` + `content-visibility:auto` container) would be
  // positioned relative to that row instead of the viewport — clipped and
  // unreachable. See TaskItem/ExpandedTaskCard delete affordances.
  return createPortal(
    // `data-picker-portal` marks this as an in-app overlay so the expanded
    // task card's click-outside handler (which collapses on any mousedown
    // outside its own DOM) does NOT treat a click in this portaled dialog as
    // an outside click — otherwise the card collapses on mousedown and unmounts
    // the dialog before the confirm click can fire.
    <div data-picker-portal className="fixed inset-0 z-50 flex items-start justify-center pt-[25vh]">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40" onClick={onCancel} />
      <div
        className={`relative w-full max-w-sm mx-4 bg-white dark:bg-[#2A2A2A] rounded-xl ${modalShadow}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4">
          <p className="text-[14px] text-[#1A1A1A] dark:text-[#E8E8E8]">{message}</p>
        </div>
        <div className="px-5 py-3 border-t border-[#E8E8E8] dark:border-[#3A3A3A] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-[13px] text-[#888] hover:text-[#555] dark:hover:text-[#CCC] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onCancel(); }}
            className="px-4 py-1.5 text-[13px] bg-danger text-white rounded-lg hover:bg-danger-dark transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
