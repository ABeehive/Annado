import { PRIORITY_CONFIG } from '../utils/projectColors';

interface PrioritySelectorProps {
  value: number | null;
  onChange: (priority: number | null) => void;
}

const PRIORITY_STYLES: Record<number, { activeBg: string; hoverText: string; title: string }> = {
  1: { activeBg: 'bg-[#FFEBEE] dark:bg-[#4A2020]', hoverText: 'hover:text-danger', title: 'High priority' },
  2: { activeBg: 'bg-[#FFF3E0] dark:bg-[#4A3520]', hoverText: 'hover:text-[#FB8C00]', title: 'Medium priority' },
  3: { activeBg: 'bg-[#E8EAF6] dark:bg-[#2A2D4A]', hoverText: 'hover:text-primary', title: 'Low priority' },
};

export function PrioritySelector({ value, onChange }: PrioritySelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {([1, 2, 3] as const).map((level) => {
        const { color, label } = PRIORITY_CONFIG[level];
        const { activeBg, hoverText, title } = PRIORITY_STYLES[level];
        const isActive = value === level;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(isActive ? null : level)}
            className={`px-1.5 py-0.5 text-[11px] font-bold rounded transition-all ${
              isActive
                ? `${activeBg}`
                : `text-[#C4C4C4] dark:text-[#555] ${hoverText}`
            }`}
            style={isActive ? { color } : undefined}
            title={title}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
