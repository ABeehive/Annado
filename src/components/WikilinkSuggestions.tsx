import { WikiSuggestion } from '../hooks/useWikilinkSuggest';
import { PersonIcon } from '../utils/viewIcons';

interface WikilinkSuggestionsProps {
  suggestions: WikiSuggestion[];
  highlightedIndex: number;
  onSelect: (name: string) => void;
}

export function WikilinkSuggestions({ suggestions, highlightedIndex, onSelect }: WikilinkSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="absolute top-full left-0 mt-1 z-[200] min-w-[200px] bg-white dark:bg-[#2A2A2A] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] border border-[#E8E8E8] dark:border-[#3A3A3A] py-1 overflow-hidden">
      {suggestions.map((s, i) => {
        const isHighlighted = i === highlightedIndex;
        return (
          <button
            key={`${s.type}-${s.name}`}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // prevent blur before selection registers
              onSelect(s.name);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
              isHighlighted
                ? 'bg-[#F0F0F0] dark:bg-[#3A3A3A]'
                : 'hover:bg-[#F8F8F8] dark:hover:bg-[#333]'
            }`}
          >
            {s.type === 'project' ? (
              <svg className="w-3 h-3 flex-shrink-0" style={{ color: s.color || '#5C6BC0' }} viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="6" />
              </svg>
            ) : (
              <PersonIcon className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
            )}
            <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] truncate">{s.name}</span>
            <span className="text-[11px] text-[#ADADB8] dark:text-[#636366] ml-auto flex-shrink-0">
              {s.type}
            </span>
          </button>
        );
      })}
    </div>
  );
}
