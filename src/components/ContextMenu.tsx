import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white dark:bg-[#2A2A2A] rounded-lg shadow-lg border border-[#E8E8E8] dark:border-[#3A3A3A] py-1 min-w-[140px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
            item.destructive
              ? 'text-red-500 dark:text-red-400'
              : 'text-[#1A1A1A] dark:text-[#E0E0E0]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
