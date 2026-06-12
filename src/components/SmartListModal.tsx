import { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SmartList, SmartListFilter, ProjectInfo } from '../types/task';
import { useTaskStore } from '../stores/taskStore';

const EMOJI_OPTIONS = ['⭐', '🔥', '📌', '⏳', '👤', '🏷️', '📅', '🎯'];

function ChevronDown() {
  return (
    <svg className="w-3 h-3 text-[#ADADB8] dark:text-[#636366] flex-shrink-0 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" />
    </svg>
  );
}

// Borderless select — just text + chevron, no box
function InlineSelect({ value, onChange, disabled, children }: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`relative flex items-center gap-0.5 ${disabled ? 'opacity-30' : ''}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none bg-transparent text-[13px] text-[#1A1A1A] dark:text-[#E8E8E8] pr-4 focus:outline-none cursor-pointer disabled:cursor-not-allowed"
      >
        {children}
      </select>
      <span className="absolute right-0"><ChevronDown /></span>
    </div>
  );
}

// iOS-style segmented control — soft grey track, white pill for selected
function SegmentedControl({ options, value, onChange }: {
  options: { label: string; value: unknown }[];
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="flex bg-[#EFEFEF] dark:bg-[#3A3A3C] rounded-[8px] p-[2px]">
      {options.map(opt => (
        <button
          key={opt.label}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-[3px] rounded-[6px] text-[12px] transition-all ${
            value === opt.value
              ? 'bg-white dark:bg-[#636366] shadow-sm text-[#1A1A1A] dark:text-white font-medium'
              : 'text-[#8E8E93] hover:text-[#555] dark:hover:text-[#C0C0C0]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Multi-select dropdown — borderless trigger, portal list
function ProjectsDropdown({
  projects,
  selected,
  onChange,
}: {
  projects: ProjectInfo[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const label =
    selected.length === 0 ? 'Any'
    : selected.length === 1 ? selected[0]
    : `${selected.length} selected`;

  const handleOpen = () => {
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!buttonRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter(x => x !== name) : [...selected, name]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="flex items-center gap-1 focus:outline-none"
      >
        <span className="text-[13px] text-[#1A1A1A] dark:text-[#E8E8E8] max-w-[160px] truncate">{label}</span>
        <ChevronDown />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[200] bg-white dark:bg-[#2C2C2E] rounded-xl shadow-xl shadow-black/15 border border-black/[0.07] dark:border-white/[0.07] py-1 overflow-y-auto"
          style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 240), maxHeight: 240 }}
        >
          {projects.map(p => {
            const checked = selected.includes(p.name);
            return (
              <button
                key={p.path}
                onClick={() => toggle(p.name)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors text-left"
              >
                <span className={`w-4 h-4 rounded-[4px] flex-shrink-0 flex items-center justify-center border transition-all ${
                  checked ? 'bg-primary border-primary' : 'border-[#C7C7CC] dark:border-[#48484A]'
                }`}>
                  {checked && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12l5 5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-[13px] text-[#1A1A1A] dark:text-[#E8E8E8] truncate">{p.name}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

// Clean two-column row: label left (fixed width), control right
function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center py-2.5">
      <span className="w-24 text-[13px] font-medium text-[#3C3C43] dark:text-[#EBEBF5] flex-shrink-0">{label}</span>
      <div className="flex-1 flex justify-end items-center">{children}</div>
    </div>
  );
}

interface SmartListModalProps {
  editList?: SmartList;
  onClose: () => void;
}

export function SmartListModal({ editList, onClose }: SmartListModalProps) {
  const { addSmartList, updateSmartList, availableProjects, availablePeople, availableTags } = useTaskStore();
  const [name, setName] = useState(editList?.name ?? '');
  const [icon, setIcon] = useState(editList?.icon ?? '⭐');
  const [filter, setFilter] = useState<SmartListFilter>(editList?.filter ?? {});
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Global Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = () => {
    if (!name.trim()) return;
    if (editList) {
      updateSmartList(editList.id, { name: name.trim(), icon, filter });
    } else {
      addSmartList({ id: crypto.randomUUID(), name: name.trim(), icon, filter });
    }
    onClose();
  };

  const setF = <K extends keyof SmartListFilter>(key: K, value: SmartListFilter[K] | undefined) => {
    setFilter(f => {
      const next = { ...f };
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-[440px] bg-white dark:bg-[#2C2C2E] rounded-2xl shadow-2xl shadow-black/25 dark:shadow-black/60">

        {/* Name + Icon — borderless hero */}
        <div className="px-7 pt-7 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowIconPicker(v => !v)}
              className="text-[22px] leading-none flex-shrink-0 hover:opacity-60 transition-opacity"
              title="Change icon"
            >
              {icon}
            </button>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="List Name"
              autoFocus
              className="flex-1 bg-transparent text-[20px] font-semibold text-[#1A1A1A] dark:text-white placeholder-[#C8C8CD] dark:placeholder-[#48484A] focus:outline-none"
            />
          </div>
          {showIconPicker && (
            <div className="flex gap-3 mt-3 pl-9">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => { setIcon(e); setShowIconPicker(false); }}
                  className={`text-[18px] transition-opacity ${icon === e ? 'opacity-100' : 'opacity-20 hover:opacity-55'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hairline */}
        <div className="mx-7 border-t border-black/[0.07] dark:border-white/[0.07]" />

        {/* Filter rows */}
        <div className="px-7 py-1 max-h-[58vh] overflow-y-auto divide-y divide-black/[0.05] dark:divide-white/[0.05]">

          <FilterRow label="View">
            <InlineSelect
              value={filter.baseView ?? ''}
              onChange={v => setF('baseView', (v || undefined) as SmartListFilter['baseView'])}
            >
              <option value="">All open</option>
              <option value="inbox">Inbox</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="anytime">Anytime</option>
              <option value="someday">Someday</option>
            </InlineSelect>
          </FilterRow>

          <FilterRow label="Due within">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                value={filter.dueWithin?.amount ?? ''}
                onChange={e => {
                  const n = parseInt(e.target.value, 10);
                  setF('dueWithin', e.target.value && n > 0
                    ? { amount: n, unit: filter.dueWithin?.unit ?? 'weeks' }
                    : undefined);
                }}
                placeholder="–"
                className="w-7 text-center bg-transparent text-[13px] text-[#1A1A1A] dark:text-[#E8E8E8] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <InlineSelect
                value={filter.dueWithin?.unit ?? 'weeks'}
                onChange={v => {
                  if (!filter.dueWithin) return;
                  setF('dueWithin', { ...filter.dueWithin, unit: v as 'days' | 'weeks' | 'months' });
                }}
                disabled={!filter.dueWithin}
              >
                <option value="days">days</option>
                <option value="weeks">weeks</option>
                <option value="months">months</option>
              </InlineSelect>
            </div>
          </FilterRow>

          <FilterRow label="Priority">
            <SegmentedControl
              options={[
                { label: 'Any', value: undefined },
                { label: 'High', value: 1 },
                { label: 'Med', value: 2 },
                { label: 'Low', value: 3 },
              ]}
              value={filter.priority}
              onChange={v => setF('priority', v as 1 | 2 | 3 | undefined)}
            />
          </FilterRow>

          {availableProjects.length > 0 && (
            <FilterRow label="Projects">
              <ProjectsDropdown
                projects={availableProjects}
                selected={filter.projects ?? []}
                onChange={next => setF('projects', next.length > 0 ? next : undefined)}
              />
            </FilterRow>
          )}

          {availablePeople.length > 0 && (
            <FilterRow label="Person">
              <InlineSelect
                value={filter.person ?? ''}
                onChange={v => setF('person', v || undefined)}
              >
                <option value="">Any</option>
                {availablePeople.map(p => (
                  <option key={p.path} value={p.name}>{p.name}</option>
                ))}
              </InlineSelect>
            </FilterRow>
          )}

          {availableTags.length > 0 && (
            <FilterRow label="Tag">
              <InlineSelect
                value={filter.tag ?? ''}
                onChange={v => setF('tag', v || undefined)}
              >
                <option value="">Any</option>
                {availableTags.map(t => (
                  <option key={t.name} value={t.name}>#{t.name}</option>
                ))}
              </InlineSelect>
            </FilterRow>
          )}

          <FilterRow label="Deadline">
            <SegmentedControl
              options={[
                { label: 'Any', value: undefined },
                { label: 'Yes', value: true },
                { label: 'No', value: false },
              ]}
              value={filter.hasDeadline}
              onChange={v => setF('hasDeadline', v as boolean | undefined)}
            />
          </FilterRow>

          <FilterRow label="Older than">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                value={filter.minAgeDays ?? ''}
                onChange={e => setF('minAgeDays', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                placeholder="–"
                className="w-7 text-center bg-transparent text-[13px] text-[#1A1A1A] dark:text-[#E8E8E8] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[13px] text-[#8E8E93]">days</span>
            </div>
          </FilterRow>

        </div>

        {/* Footer */}
        <div className="px-7 pt-4 pb-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-[13px] text-[#8E8E93] hover:text-[#3C3C43] dark:hover:text-[#EBEBF5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-1.5 rounded-lg text-[13px] font-medium bg-primary text-white hover:bg-[#4A5AB0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {editList ? 'Save' : 'Create'}
          </button>
        </div>

      </div>
    </div>
  );
}
