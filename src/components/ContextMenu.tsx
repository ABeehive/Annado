import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  label?: string;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Render a horizontal divider instead of a clickable row. */
  separator?: boolean;
  /** Colored leading dot (matches the sidebar/agenda menu style). */
  dot?: string;
  /** Right-aligned shortcut hint, e.g. "⌘E". */
  shortcut?: string;
  /** Nested items shown in a flyout on hover/focus. */
  submenu?: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  /** Optional bold title row at the top of the menu. */
  header?: string;
  /** Optional secondary line under the header (e.g. a time range). */
  subheader?: string;
}

const PANEL_CLASS =
  'bg-white dark:bg-[#2A2A2A] rounded-lg shadow-lg border border-[#E8E8E8] dark:border-[#3A3A3A] py-1 min-w-[160px]';

function MenuRow({
  item,
  onClose,
  openToLeft,
}: {
  item: ContextMenuItem;
  onClose: () => void;
  openToLeft: boolean;
}) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  if (item.separator) {
    return <div className="my-1 border-t border-[#E8E8E8] dark:border-[#3A3A3A]" />;
  }

  const rowClass = `w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 transition-colors ${
    item.disabled
      ? 'text-[#C0C0C0] dark:text-[#555] cursor-default'
      : item.destructive
        ? 'text-red-500 dark:text-red-400 hover:bg-black/5 dark:hover:bg-white/5'
        : 'text-[#1A1A1A] dark:text-[#E0E0E0] hover:bg-black/5 dark:hover:bg-white/5'
  }`;

  const content = (
    <>
      {item.dot && (
        <span className="rounded-full flex-shrink-0" style={{ backgroundColor: item.dot, width: 5, height: 5 }} />
      )}
      <span className="flex-1">{item.label}</span>
      {item.shortcut && <span className="text-[11px] text-[#999] dark:text-[#777]">{item.shortcut}</span>}
    </>
  );

  if (item.submenu && item.submenu.length > 0) {
    const open = () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      setSubmenuOpen(true);
    };
    const scheduleClose = () => {
      closeTimer.current = window.setTimeout(() => setSubmenuOpen(false), 120);
    };
    return (
      <div className="relative" onMouseEnter={open} onMouseLeave={scheduleClose}>
        <button type="button" className={rowClass}>
          {content}
          <span className="text-[#999] dark:text-[#777]">›</span>
        </button>
        {submenuOpen && (
          <div className={`absolute top-0 z-50 ${openToLeft ? 'right-full mr-1' : 'left-full ml-1'} ${PANEL_CLASS}`}>
            {item.submenu.map((sub, i) => (
              <MenuRow key={i} item={sub} onClose={onClose} openToLeft={openToLeft} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={() => {
        if (item.disabled) return;
        item.onClick?.();
        onClose();
      }}
      className={rowClass}
    >
      {content}
    </button>
  );
}

export function ContextMenu({ x, y, items, onClose, header, subheader }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<React.CSSProperties>({ top: y, left: x, visibility: 'hidden' });

  // Flip the menu (and submenu direction) to stay on-screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const style: React.CSSProperties = {};
    if (y + el.offsetHeight > window.innerHeight) style.bottom = window.innerHeight - y;
    else style.top = y;
    if (x + el.offsetWidth > window.innerWidth) style.right = window.innerWidth - x;
    else style.left = x;
    style.visibility = 'visible';
    setPos(style);
  }, [x, y]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
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

  const openToLeft = typeof window !== 'undefined' && x > window.innerWidth * 0.6;

  return (
    <div ref={ref} className={`fixed z-50 ${PANEL_CLASS}`} style={pos}>
      {header && (
        <div className="px-3 pt-1.5 pb-1.5 mb-1 border-b border-[#F0F0F0] dark:border-[#3A3A3A]">
          <div className="text-[13px] font-semibold text-[#1A1A1A] dark:text-[#E0E0E0] truncate">{header}</div>
          {subheader && <div className="text-[11px] text-[#888] truncate mt-0.5">{subheader}</div>}
        </div>
      )}
      {items.map((item, i) => (
        <MenuRow key={i} item={item} onClose={onClose} openToLeft={openToLeft} />
      ))}
    </div>
  );
}
