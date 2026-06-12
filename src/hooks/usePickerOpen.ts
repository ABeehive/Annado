import { useState, useEffect } from 'react';

export function usePickerOpen(forceOpen?: boolean): [boolean, (v: boolean) => void] {
  const [isOpen, setIsOpen] = useState(false);
  // Sync both ways: a falling forceOpen (store flag cleared) closes the picker.
  // Uncontrolled usages pass forceOpen === undefined, which never changes, so the
  // effect doesn't re-run and click-driven opens stay open.
  useEffect(() => {
    setIsOpen(!!forceOpen);
  }, [forceOpen]);
  return [isOpen, setIsOpen];
}
