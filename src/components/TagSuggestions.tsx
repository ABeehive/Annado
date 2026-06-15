import { type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { TagInfo } from '../types/task';
import { getTagColor } from '../utils/projectColors';
import { usePickerPosition } from '../hooks/usePickerPosition';

interface TagSuggestionsProps {
  suggestions: TagInfo[];
  highlightedIndex: number;
  onSelect: (name: string) => void;
  tagColors: Record<string, string>;
  anchorRef: RefObject<HTMLElement | null>;
}

const TAG_DROPDOWN_WIDTH = 200;

export function TagSuggestions({ suggestions, highlightedIndex, onSelect, tagColors, anchorRef }: TagSuggestionsProps) {
  // Render into document.body via a portal so the dropdown escapes the modal's
  // overflow-clip box (which would otherwise cut it off at the modal edge), the
  // same pattern the When/Deadline date pickers use.
  const pos = usePickerPosition(anchorRef, suggestions.length > 0, TAG_DROPDOWN_WIDTH);
  if (suggestions.length === 0 || !pos) return null;

  return createPortal(
    <div style={pos} className="min-w-[160px] bg-white dark:bg-[#2A2A2A] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] border border-[#E8E8E8] dark:border-[#3A3A3A] py-1 overflow-hidden">
      {suggestions.map((tag, i) => {
        const color = getTagColor(tag.name, tagColors);
        const isHighlighted = i === highlightedIndex;
        return (
          <button
            key={tag.name}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // prevent input blur before we register the click
              e.stopPropagation(); // prevent click-outside handler from seeing a detached target
              onSelect(tag.name);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
              isHighlighted
                ? 'bg-[#F0F0F0] dark:bg-[#3A3A3A]'
                : 'hover:bg-[#F8F8F8] dark:hover:bg-[#333]'
            }`}
          >
            <span
              className="text-[12px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
              style={{ backgroundColor: `${color}20`, color }}
            >
              #{tag.name}
            </span>
            {tag.count > 0 && (
              <span className="text-[11px] text-[#ADADB8] dark:text-[#636366] ml-auto flex-shrink-0">
                {tag.count}
              </span>
            )}
          </button>
        );
      })}
    </div>,
    document.body
  );
}
