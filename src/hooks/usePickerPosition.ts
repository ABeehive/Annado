import { useLayoutEffect, useState, type RefObject } from 'react';

const PICKER_WIDTH = 320;

/**
 * Computes a fixed-position style for a date-picker popover anchored just below a
 * button, clamping to the right viewport edge. Recomputes whenever the picker opens,
 * so keyboard-triggered opens (forceOpen) are positioned correctly, not just clicks,
 * and stays attached to the button while the list scrolls or the window resizes.
 */
export function usePickerPosition(
  buttonRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
): React.CSSProperties | null {
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const overflowRight = rect.left + PICKER_WIDTH > window.innerWidth;
      setPos({
        position: 'fixed',
        left: overflowRight ? rect.right - PICKER_WIDTH : rect.left,
        top: rect.bottom + 4,
        zIndex: 9999,
      });
    };
    update();
    // Capture-phase scroll catches scrolling on any ancestor container, so the
    // popover follows the button instead of staying detached.
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen, buttonRef]);
  return pos;
}
