import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { useFocusOnMount } from '../hooks/useFocus';
import { useClickOutside } from '../hooks/useClickOutside';
import {
  getCalendarDays,
  isSameDay,
  getToday,
} from '../utils/dates';
import {
  parseNaturalDate,
  getDateSuggestions,
  formatDatePreview,
  type DateSuggestion,
  type ParsedDate,
} from '../utils/dateParser';
import { useTaskStore } from '../stores/taskStore';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES_MON = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_NAMES_SUN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function QuickSelectChip({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-[#F5F5F5] dark:bg-[#333] border border-[#E8E8E8] dark:border-[#3A3A3A] rounded-lg text-[#1A1A1A] dark:text-[#E0E0E0] hover:bg-[#EBEBEB] dark:hover:bg-[#3A3A3A] transition-colors"
    >
      <span>{icon}</span> {label}
    </button>
  );
}

export interface DatePickerPopoverProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onSuggestionSelect: (suggestion: DateSuggestion) => void;
  onClose: () => void;
  filterSuggestion?: (s: DateSuggestion) => boolean;
  placeholder?: string;
  children?: ReactNode;
  positionStyle?: React.CSSProperties;
}

export function DatePickerPopover({
  selectedDate,
  onDateSelect,
  onSuggestionSelect,
  onClose,
  filterSuggestion,
  placeholder = 'Type a date… (e.g. tomorrow, volgende week)',
  children,
  positionStyle,
}: DatePickerPopoverProps) {
  const today = getToday();
  const { weekStartsOn } = useTaskStore();
  const DAY_NAMES = weekStartsOn === 'sunday' ? DAY_NAMES_SUN : DAY_NAMES_MON;

  const [inputValue, setInputValue] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedDate | null>(null);
  const [suggestions, setSuggestions] = useState<DateSuggestion[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useFocusOnMount(inputRef);

  useClickOutside(popoverRef, onClose);

  // Update suggestions and parsed result when input changes
  useEffect(() => {
    if (inputValue.trim()) {
      let allSuggestions = getDateSuggestions(inputValue);
      if (filterSuggestion) {
        allSuggestions = allSuggestions.filter(filterSuggestion);
      }
      setSuggestions(allSuggestions);
      setParsedResult(parseNaturalDate(inputValue));
      setHighlightedIndex(-1);
    } else {
      setSuggestions([]);
      setParsedResult(null);
      setHighlightedIndex(-1);
    }
  }, [inputValue, filterSuggestion]);

  const handleDateSelect = (date: Date) => {
    onDateSelect(date);
  };

  const handleSelectSuggestion = useCallback((suggestion: DateSuggestion) => {
    onSuggestionSelect(suggestion);
  }, [onSuggestionSelect]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0 && highlightedIndex >= 0) {
        handleSelectSuggestion(suggestions[highlightedIndex]);
      } else if (parsedResult) {
        onSuggestionSelect({ label: parsedResult.label, detail: formatDatePreview(parsedResult.date), whenValue: parsedResult.whenValue });
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (inputValue) {
        setInputValue('');
      } else {
        onClose();
      }
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const calendarDays = getCalendarDays(viewYear, viewMonth, weekStartsOn);
  const hasInput = inputValue.trim().length > 0;

  // data-picker-portal exempts the portal'd popover from ExpandedTaskCard's
  // click-outside collapse; data-picker-popover is the test hook. Distinct roles.
  return (
    <div
      ref={popoverRef}
      data-picker-portal="true"
      data-picker-popover
      className="z-[9999] bg-white dark:bg-[#2A2A2A] border border-[#E8E8E8] dark:border-[#3A3A3A] rounded-xl shadow-lg overflow-hidden"
      style={{ minWidth: '320px', position: positionStyle ? undefined : 'absolute', marginTop: positionStyle ? undefined : '4px', ...positionStyle }}
    >
      {/* 1. Input row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <svg className="w-4 h-4 text-[#888] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          className="flex-1 px-2 py-1.5 text-[13px] bg-[#F5F5F5] dark:bg-[#333] border border-[#E8E8E8] dark:border-[#3A3A3A] rounded-lg text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#999] dark:placeholder-[#666] focus:outline-none focus:border-primary"
        />
        {inputValue && (
          <button
            type="button"
            onClick={() => setInputValue('')}
            className="text-[#888] hover:text-[#E0E0E0] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* 2. Preview / Suggestions / No-match */}
      {hasInput && (
        <div className="border-t border-[#E8E8E8] dark:border-[#3A3A3A]">
          {suggestions.length > 0 ? (
            <div className="max-h-[180px] overflow-y-auto py-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                    index === highlightedIndex
                      ? 'bg-[#D4E4FA] dark:bg-[#2D4A6F]'
                      : 'hover:bg-[#F5F5F5] dark:hover:bg-[#333]'
                  }`}
                >
                  <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0]">{suggestion.label}</span>
                  <span className="text-[12px] text-[#888]">{suggestion.detail}</span>
                </button>
              ))}
            </div>
          ) : parsedResult ? (
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#1A1A1A] dark:text-[#E0E0E0] font-medium">{parsedResult.label}</span>
                <span className="text-[12px] text-[#888]">{formatDatePreview(parsedResult.date)}</span>
              </div>
              <span className="text-[11px] text-[#888]">&#x23CE; Enter</span>
            </div>
          ) : (
            <div className="px-3 py-2.5">
              <span className="text-[12px] text-[#888]">No match found</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Divider */}
      <div className="border-t border-[#E8E8E8] dark:border-[#3A3A3A]" />

      {/* 4. Custom chips (provided by wrapper) */}
      {children}

      {/* 5. Show calendar toggle */}
      <div className="flex items-center justify-end px-3 py-2 border-t border-[#E8E8E8] dark:border-[#3A3A3A]">
        <button
          type="button"
          onClick={() => setShowCalendar(!showCalendar)}
          className="text-[12px] text-primary hover:underline transition-colors"
        >
          {showCalendar ? 'Hide calendar' : 'Show calendar'}
        </button>
      </div>

      {/* 6. Calendar grid (hidden by default) */}
      {showCalendar && (
        <div className="border-t border-[#E8E8E8] dark:border-[#3A3A3A]">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-4 py-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-[#F5F5F5] dark:hover:bg-[#333] rounded transition-colors"
            >
              <svg className="w-4 h-4 text-[#888]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-[13px] font-medium text-[#1A1A1A] dark:text-[#E0E0E0]">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-[#F5F5F5] dark:hover:bg-[#333] rounded transition-colors"
            >
              <svg className="w-4 h-4 text-[#888]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Calendar grid */}
          <div className="p-2">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0 mb-1">
              {DAY_NAMES.map((day) => (
                <div key={day} className="text-center text-[11px] text-[#999] dark:text-[#666] py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-0">
              {calendarDays.map((date, index) => {
                const isCurrentMonth = date.getMonth() === viewMonth;
                const isToday = isSameDay(date, today);
                const isSelected = selectedDate && isSameDay(date, selectedDate);

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleDateSelect(date)}
                    className={`
                      w-8 h-8 text-[12px] rounded-full flex items-center justify-center transition-colors
                      ${!isCurrentMonth ? 'text-[#CCC] dark:text-[#555]' : 'text-[#1A1A1A] dark:text-[#E0E0E0]'}
                      ${isToday && !isSelected ? 'text-primary font-bold' : ''}
                      ${isSelected ? 'bg-primary text-white' : 'hover:bg-[#F5F5F5] dark:hover:bg-[#333]'}
                    `}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
