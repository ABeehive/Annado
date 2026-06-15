import { useState, useEffect, useRef } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { getTagColor, filterTagSuggestions } from '../utils/projectColors';
import { tagsInclude, resolveTagToAdd } from '../utils/tags';
import { TagSuggestions } from './TagSuggestions';

// Tag editor with add/remove support and autocomplete in expanded view
export function TagEditor({
  tags,
  onTagClick,
  onTagsChange,
  tagColors,
}: {
  tags: string[];
  onTagClick: (tag: string) => void;
  onTagsChange: (tags: string[]) => void;
  tagColors?: Record<string, string>;
}) {
  const { availableTags } = useTaskStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // Reset highlight when input changes
  useEffect(() => { setHighlightedIndex(-1); }, [newTag]);

  const suggestions = filterTagSuggestions(newTag, availableTags, tags);

  const selectSuggestion = (name: string) => {
    if (!tagsInclude(tags, name)) onTagsChange([...tags, name]);
    setNewTag('');
    setIsAdding(false);
  };

  const addTag = () => {
    const name = resolveTagToAdd(newTag, suggestions, highlightedIndex, availableTags);
    if (name && !tagsInclude(tags, name)) {
      onTagsChange([...tags, name]);
    }
    setNewTag('');
    setIsAdding(false);
  };

  const removeTag = (tag: string) => {
    onTagsChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="px-5 pb-4 pl-14 flex flex-wrap items-center gap-2">
      {tags.map((tag) => {
        const color = tagColors ? getTagColor(tag, tagColors) : '#5C6BC0';
        return (
          <span
            key={tag}
            className="inline-flex items-center gap-1 text-[12px] px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTagClick(tag);
              }}
              className="hover:underline"
            >
              #{tag}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-0.5 hover:text-danger transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        );
      })}
      {isAdding ? (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (suggestions.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1)); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(i => Math.max(i - 1, -1)); return; }
              }
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); e.stopPropagation(); addTag(); return; }
              if (e.key === 'Escape') { setNewTag(''); setIsAdding(false); }
            }}
            onBlur={addTag}
            placeholder="tag name"
            className="text-[12px] px-2 py-0.5 rounded-full border border-[#E8E8E8] dark:border-[#3A3A3A] bg-white dark:bg-[#333] text-[#1A1A1A] dark:text-[#E0E0E0] focus:outline-none focus:border-primary w-24"
          />
          <TagSuggestions
            suggestions={suggestions}
            highlightedIndex={highlightedIndex}
            onSelect={selectSuggestion}
            tagColors={tagColors || {}}
            anchorRef={inputRef}
          />
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }}
          className="text-[12px] px-2 py-0.5 rounded-full border border-dashed border-[#C4C4C4] dark:border-[#555] text-[#888] dark:text-[#666] hover:border-primary hover:text-primary transition-colors"
        >
          + tag
        </button>
      )}
    </div>
  );
}
