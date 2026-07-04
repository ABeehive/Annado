import { useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePickerOpen } from '../hooks/usePickerOpen';
import { usePickerPosition } from '../hooks/usePickerPosition';
import { WhenType, WhenValue, createWhenValue } from '../types/task';
import {
  getNextMonday,
  getThisWeekend,
  formatDateForStorage,
  formatWhenDisplay,
} from '../utils/dates';
import { type DateSuggestion } from '../utils/dateParser';
import { DatePickerPopover, QuickSelectChip } from './DatePickerPopover';

// Fixed viewport-centered position for pickers opened from the bulk-actions
// bar, which floats at the bottom edge where an anchored popover gets clipped.
export const CENTER_POSITION: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  top: '40%',
  transform: 'translate(-50%, -50%)',
  zIndex: 9999,
};

interface WhenDatePickerProps {
  value: WhenValue;
  onChange: (when: WhenValue) => void;
  onClose: () => void;
  positionStyle?: React.CSSProperties;
  includeInbox?: boolean;
}

export function WhenDatePicker({ value, onChange, onClose, positionStyle, includeInbox = false }: WhenDatePickerProps) {
  // Get the currently selected date (if any)
  const selectedDate = typeof value === 'object' && 'date' in value
    ? new Date(value.date)
    : null;

  const handleQuickSelect = (type: WhenType, date?: string) => {
    onChange(createWhenValue(type, date));
    onClose();
  };

  const handleDateSelect = useCallback((date: Date) => {
    onChange({ date: formatDateForStorage(date) });
    onClose();
  }, [onChange, onClose]);

  const handleSuggestionSelect = useCallback((suggestion: DateSuggestion) => {
    onChange(suggestion.whenValue);
    onClose();
  }, [onChange, onClose]);

  return (
    <DatePickerPopover
      selectedDate={selectedDate}
      onDateSelect={handleDateSelect}
      onSuggestionSelect={handleSuggestionSelect}
      onClose={onClose}
      positionStyle={positionStyle}
    >
      {/* Quick-select chips */}
      <div className="flex flex-wrap gap-2 px-3 py-2.5">
        {includeInbox && (
          <QuickSelectChip icon="📥" label="Inbox" onClick={() => handleQuickSelect('inbox')} />
        )}
        <QuickSelectChip icon="☀️" label="Today" onClick={() => handleQuickSelect('today')} />
        <QuickSelectChip icon="→" label="Tomorrow" onClick={() => handleQuickSelect('tomorrow')} />
        <QuickSelectChip icon="🌿" label="This Weekend" onClick={() => handleDateSelect(getThisWeekend())} />
        <QuickSelectChip icon="📅" label="Next Week" onClick={() => handleDateSelect(getNextMonday())} />
      </div>

      {/* Bottom row: Anytime + Someday + Clear */}
      <div className="flex items-center px-3 py-2 border-t border-[#E8E8E8] dark:border-[#3A3A3A]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleQuickSelect('anytime')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-dashed border-primary rounded-lg text-primary hover:bg-primary/10 transition-colors"
          >
            🔄 Anytime
          </button>
          <button
            type="button"
            onClick={() => handleQuickSelect('someday')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-dashed border-[#8E6AC8] rounded-lg text-[#8E6AC8] hover:bg-[#8E6AC8]/10 transition-colors"
          >
            📦 Someday
          </button>
        </div>
        <button
          type="button"
          onClick={() => { onChange('anytime'); onClose(); }}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-dashed border-[#CCC] dark:border-[#555] rounded-lg text-[#AAA] dark:text-[#666] hover:border-danger hover:text-danger transition-colors"
        >
          Clear date
        </button>
      </div>
    </DatePickerPopover>
  );
}

// Button component that triggers the date picker
interface WhenButtonProps {
  value: WhenValue;
  onChange: (when: WhenValue) => void;
  forceOpen?: boolean;
  onClose?: () => void;
  placement?: 'anchor' | 'center';
  includeInbox?: boolean;
  variant?: 'default' | 'toolbar';
}

export function WhenButton({ value, onChange, forceOpen, onClose, placement = 'anchor', includeInbox = false, variant = 'default' }: WhenButtonProps) {
  const [isOpen, setIsOpen] = usePickerOpen(forceOpen);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const anchorPos = usePickerPosition(buttonRef, isOpen && placement === 'anchor');
  const pickerPos = placement === 'center' ? (isOpen ? CENTER_POSITION : null) : anchorPos;

  const buttonChrome = variant === 'toolbar'
    // Dark chrome for the black bulk-actions bar (mirrors its old <select>).
    ? 'bg-[#333] dark:bg-[#3A3A3A] text-white border-none hover:bg-[#444] dark:hover:bg-[#444]'
    : 'border border-[#E8E8E8] dark:border-[#3A3A3A] bg-white dark:bg-[#333] text-[#1A1A1A] dark:text-[#E0E0E0] hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]';

  const getDisplayText = (): string => {
    if (typeof value === 'string') {
      switch (value) {
        case 'inbox': return 'Inbox';
        case 'today': return 'Today';
        case 'evening': return 'This Evening';
        case 'tomorrow': return 'Tomorrow';
        case 'anytime': return 'Anytime';
        case 'someday': return 'Someday';
      }
    }
    if (typeof value === 'object' && 'date' in value) {
      return formatWhenDisplay(value) || 'When';
    }
    return 'When';
  };

  const getIcon = () => {
    if (typeof value === 'string') {
      if (value === 'today') {
        return (
          <svg className="w-4 h-4 text-warning" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        );
      }
      if (value === 'evening') {
        return (
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        );
      }
      if (value === 'someday') {
        return (
          <svg className="w-4 h-4 text-[#8E6AC8]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4z" />
          </svg>
        );
      }
    }
    // Default calendar icon for dates
    return (
      <svg className="w-4 h-4 text-[#888]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  };

  const picker = isOpen && pickerPos && (
    <WhenDatePicker
      value={value}
      onChange={onChange}
      onClose={() => {
        setIsOpen(false);
        onClose?.();
      }}
      positionStyle={pickerPos}
      includeInbox={includeInbox}
    />
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (isOpen) { setIsOpen(false); onClose?.(); }
          else { setIsOpen(true); }
        }}
        className={`flex items-center gap-1.5 px-2 py-1 text-[12px] rounded-md transition-colors cursor-pointer ${buttonChrome}`}
      >
        {getIcon()}
        <span>{getDisplayText()}</span>
        <svg className="w-3 h-3 text-[#888]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {picker && createPortal(picker, document.body)}
    </div>
  );
}
