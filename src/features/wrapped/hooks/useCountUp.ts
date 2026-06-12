import { useState, useEffect, useRef } from 'react';

export function useCountUp(target: number, duration: number = 1200, active: boolean = true): number {
  const [value, setValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }

    startTimeRef.current = null;

    const animate = (time: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = time;
      }
      const elapsed = time - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    // Small delay to sync with slide animation
    const timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, 200);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, active]);

  return value;
}
