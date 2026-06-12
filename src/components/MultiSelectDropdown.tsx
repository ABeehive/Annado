import { useRef, useState } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';

interface MultiSelectDropdownProps {
  label: string;
  items: Array<{ name: string }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  addMoreLabel?: string;
}

export function MultiSelectDropdown({ label, items, selected, onChange, addMoreLabel }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter(n => n !== name) : [...selected, name]);
  };

  if (items.length === 0) return null;

  return (
    <div>
      <label className="block text-[11px] font-medium text-[#888] uppercase tracking-wide mb-1.5">{label}</label>
      <div className="relative" ref={containerRef}>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selected.map(name => (
              <span key={name} className="flex items-center gap-1 px-2 py-0.5 text-[12px] bg-[#EEF0FB] dark:bg-[#2D3055] text-primary rounded-full">
                {name}
                <button type="button" onClick={() => toggle(name)} className="hover:text-danger transition-colors">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setOpen(v => !v)} className="text-[12px] text-primary hover:underline transition-colors">
          {selected.length > 0 ? (addMoreLabel ?? '+ Add more') : `+ Add ${label.toLowerCase()}`}
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-10 bg-white dark:bg-[#2A2A2A] border border-[#E8E8E8] dark:border-[#3A3A3A] rounded-lg shadow-lg overflow-hidden min-w-[180px] max-h-[180px] overflow-y-auto">
            {items.map(item => (
              <button
                key={item.name}
                type="button"
                onClick={() => { toggle(item.name); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-[#F5F5F5] dark:hover:bg-[#333] transition-colors"
              >
                <svg className={`w-3.5 h-3.5 ${selected.includes(item.name) ? 'text-primary' : 'text-transparent'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-[#1A1A1A] dark:text-[#E0E0E0]">{item.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
