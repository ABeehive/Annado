import { useLayoutEffect, useState, type RefObject } from 'react';

const DEFAULT_PICKER_WIDTH = 320;

/**
 * Computes a fixed-position style for a date-picker popover anchored just below a
 * button, clamping to the right viewport edge. Recomputes whenever the picker opens,
 * so keyboard-triggered opens (forceOpen) are positioned correctly, not just clicks,
 * and stays attached to the button while the list scrolls or the window resizes.
 *
 * `width` is the popover's width, used only for right-edge clamping; pass the
 * actual width for narrower popovers (e.g. the tag dropdown) so they don't clamp
 * left more than necessary.
 */
export function usePickerPosition(
  buttonRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  width: number = DEFAULT_PICKER_WIDTH,
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
      const overflowRight = rect.left + width > window.innerWidth;
      setPos({
        position: 'fixed',
        left: overflowRight ? rect.right - width : rect.left,
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
  }, [isOpen, buttonRef, width]);
  return pos;
}
