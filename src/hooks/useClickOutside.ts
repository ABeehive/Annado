import { RefObject, useEffect } from 'react';

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose, enabled]);
}
