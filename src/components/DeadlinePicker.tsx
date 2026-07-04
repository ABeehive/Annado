import { useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePickerOpen } from '../hooks/usePickerOpen';
import { usePickerPosition } from '../hooks/usePickerPosition';
import { WhenValue } from '../types/task';
import { CENTER_POSITION } from './WhenDatePicker';
import {
  getNextMonday,
  getThisWeekend,
  formatDateForStorage,
  getTomorrow,
  formatDeadlineCountdown,
  getDeadlineUrgency,
  DEADLINE_URGENCY_COLORS,
  getToday,
} from '../utils/dates';
import { type DateSuggestion } from '../utils/dateParser';
import { DatePickerPopover, QuickSelectChip } from './DatePickerPopover';

interface DeadlinePickerProps {
  value: string | null;
  onChange: (deadline: string | null) => void;
  onClose: () => void;
  positionStyle?: React.CSSProperties;
}

/** Convert a WhenValue to an ISO date string, or null if not date-convertible */
function whenValueToDateString(wv: WhenValue): string | null {
  if (typeof wv === 'object' && 'date' in wv) {
    return wv.date;
  }
  if (wv === 'today') return formatDateForStorage(getToday());
  if (wv === 'tomorrow') return formatDateForStorage(getTomorrow());
  return null;
}

/** Filter out non-date suggestions (anytime, someday, inbox) */
function isDateSuggestion(s: DateSuggestion): boolean {
  const wv = s.whenValue;
  if (typeof wv === 'string') {
    return wv === 'today' || wv === 'tomorrow';
  }
  return typeof wv === 'object' && 'date' in wv;
}

export function DeadlinePicker({ value, onChange, onClose, positionStyle }: DeadlinePickerProps) {
  const selectedDate = value ? new Date(value) : null;

  const handleDateSelect = useCallback((date: Date) => {
    onChange(formatDateForStorage(date));
    onClose();
  }, [onChange, onClose]);

  const handleSuggestionSelect = useCallback((suggestion: DateSuggestion) => {
    const dateStr = whenValueToDateString(suggestion.whenValue);
    if (dateStr) {
      onChange(dateStr);
    }
    onClose();
  }, [onChange, onClose]);

  const filterSuggestion = useMemo(() => isDateSuggestion, []);

  const today = getToday();

  return (
    <DatePickerPopover
      selectedDate={selectedDate}
      onDateSelect={handleDateSelect}
      onSuggestionSelect={handleSuggestionSelect}
      onClose={onClose}
      filterSuggestion={filterSuggestion}
      placeholder="Type a deadline… (e.g. friday, volgende week)"
      positionStyle={positionStyle}
    >
      {/* Quick-select chips */}
      <div className="flex flex-wrap gap-2 px-3 py-2.5">
        <QuickSelectChip icon="☀️" label="Today" onClick={() => { onChange(formatDateForStorage(today)); onClose(); }} />
        <QuickSelectChip icon="→" label="Tomorrow" onClick={() => { onChange(formatDateForStorage(getTomorrow())); onClose(); }} />
        <QuickSelectChip icon="🌿" label="This Weekend" onClick={() => { onChange(formatDateForStorage(getThisWeekend())); onClose(); }} />
        <QuickSelectChip icon="📅" label="Next Week" onClick={() => { onChange(formatDateForStorage(getNextMonday())); onClose(); }} />
      </div>

      {/* No Deadline clear chip */}
      <div className="flex items-center px-3 py-2 border-t border-[#E8E8E8] dark:border-[#3A3A3A]">
        <button
          type="button"
          onClick={() => { onChange(null); onClose(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-dashed border-danger rounded-lg text-danger hover:bg-danger/10 transition-colors"
        >
          No Deadline
        </button>
      </div>
    </DatePickerPopover>
  );
}

// Button component that triggers the deadline picker
interface DeadlineButtonProps {
  value: string | null;
  onChange: (deadline: string | null) => void;
  forceOpen?: boolean;
  onClose?: () => void;
  placement?: 'anchor' | 'center';
  variant?: 'default' | 'toolbar';
}

/** Get urgency color for deadline display */
function getDeadlineColor(value: string | null): string {
  if (!value) return '#8b8fa3';
  return DEADLINE_URGENCY_COLORS[getDeadlineUrgency(value)];
}

export function DeadlineButton({ value, onChange, forceOpen, onClose, placement = 'anchor', variant = 'default' }: DeadlineButtonProps) {
  const [isOpen, setIsOpen] = usePickerOpen(forceOpen);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const anchorPos = usePickerPosition(buttonRef, isOpen && placement === 'anchor');
  const pickerPos = placement === 'center' ? (isOpen ? CENTER_POSITION : null) : anchorPos;

  const color = getDeadlineColor(value);
  const displayText = value ? formatDeadlineCountdown(value) : 'Deadline';

  const buttonChrome = variant === 'toolbar'
    // Dark chrome for the black bulk-actions bar (mirrors its old <select>).
    ? 'bg-[#333] dark:bg-[#3A3A3A] text-white border-none hover:bg-[#444] dark:hover:bg-[#444]'
    : 'border border-[#E8E8E8] dark:border-[#3A3A3A] bg-white dark:bg-[#333] text-[#1A1A1A] dark:text-[#E0E0E0] hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]';

  const picker = isOpen && pickerPos && (
    <DeadlinePicker
      value={value}
      onChange={onChange}
      onClose={() => {
        setIsOpen(false);
        onClose?.();
      }}
      positionStyle={pickerPos}
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
        <svg className="w-4 h-4" style={{ color }} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <rect x="3.5" y="15" width="1" height="7" />
        </svg>
        <span style={{ color }}>{displayText}</span>
        <svg className="w-3 h-3 text-[#888]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {picker && createPortal(picker, document.body)}
    </div>
  );
}
