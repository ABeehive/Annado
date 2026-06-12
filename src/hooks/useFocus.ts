import { RefObject, useEffect } from 'react';

export function useFocusOnMount(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const timer = setTimeout(() => ref.current?.focus(), 50);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useFocusWhen(ref: RefObject<HTMLElement | null>, condition: boolean): void {
  useEffect(() => {
    if (!condition) return;
    const timer = setTimeout(() => ref.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [condition]); // eslint-disable-line react-hooks/exhaustive-deps
}
