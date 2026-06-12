import { useState, useRef } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { formatDuration } from '../features/agenda/utils';

// Duration picker with quick buttons
export function DurationPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false), open);

  const presets = [
    { label: '15m', value: 15 },
    { label: '30m', value: 30 },
    { label: '45m', value: 45 },
    { label: '1h', value: 60 },
    { label: '1h30', value: 90 },
    { label: '2h', value: 120 },
    { label: '3h', value: 180 },
    { label: '4h', value: 240 },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`flex items-center gap-1 px-2 py-1 text-[12px] rounded border transition-colors ${
          value !== null
            ? 'border-primary text-primary bg-primary/5'
            : 'border-[#E8E8E8] dark:border-[#3A3A3A] text-[#888] dark:text-[#666] hover:border-primary'
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {value !== null ? formatDuration(value) : 'Duration'}
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-50 bg-white dark:bg-[#2A2A2A] rounded-lg shadow-lg border border-[#E8E8E8] dark:border-[#3A3A3A] p-2 min-w-[140px]">
          <div className="grid grid-cols-4 gap-1">
            {presets.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(p.value); setOpen(false); }}
                className={`px-2 py-1 text-[11px] rounded transition-colors ${
                  value === p.value
                    ? 'bg-primary text-white'
                    : 'bg-[#F5F5F5] dark:bg-[#333] text-[#555] dark:text-[#AAA] hover:bg-[#E0E0E0] dark:hover:bg-[#444]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {value !== null && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
              className="w-full mt-1 px-2 py-1 text-[11px] text-danger hover:bg-[#FEE] dark:hover:bg-[#3A2020] rounded transition-colors"
            >
              Remove duration
            </button>
          )}
        </div>
      )}
    </div>
  );
}
