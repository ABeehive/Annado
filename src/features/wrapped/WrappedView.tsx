import { useState, useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { WrappedPeriod } from './types';
import { useWrappedData } from './useWrappedData';
import { buildSlides } from './slideBuilders';
import { WrappedPlayer } from './WrappedPlayer';
import './wrapped.css';

const PERIOD_LABELS: Record<WrappedPeriod, string> = {
  weekly: 'This Week',
  monthly: 'This Month',
  yearly: 'This Year',
};

export function WrappedView() {
  const setCurrentView = useTaskStore((s) => s.setCurrentView);
  const [period, setPeriod] = useState<WrappedPeriod>('yearly');
  const [offset, setOffset] = useState(0);

  const data = useWrappedData(period, offset);
  const slides = useMemo(() => (data ? buildSlides(data) : []), [data]);

  const handleClose = () => {
    setCurrentView('inbox');
  };

  const periodLabel = offset === 0
    ? PERIOD_LABELS[period]
    : data?.periodLabel ?? '';

  return (
    <div className="wrapped-view flex-1 flex flex-col min-w-0 bg-[var(--w-bg)]">
      {/* Header */}
      <div className="pl-[52px] pr-8 pt-12 pb-4 titlebar-drag">
        <div className="flex items-center gap-4 mb-4">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="var(--w-gold)" strokeWidth="1.5">
            <path d="M12 3l1.5 3.2 3.5.5-2.5 2.5.6 3.5L12 11l-3.1 1.7.6-3.5L7 6.7l3.5-.5L12 3z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 16l1 2.1 2.3.3-1.7 1.6.4 2.3L5 21l-2 1.3.4-2.3L1.7 18.4l2.3-.3L5 16z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 16l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.3-2 1.3.4-2.3-1.7-1.6 2.3-.3L19 16z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 className="text-[26px] font-medium text-[var(--w-text-primary)]">Wrapped</h2>
        </div>

        {/* Period picker */}
        <div className="flex items-center gap-3">
          <div className="flex bg-[var(--w-surface)] border border-[var(--w-border)] rounded-lg overflow-hidden">
            {(['weekly', 'monthly', 'yearly'] as WrappedPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setOffset(0); }}
                className={`px-4 py-1.5 text-[13px] font-medium transition-colors ${
                  period === p
                    ? 'bg-[var(--w-blue)] text-white'
                    : 'text-[var(--w-text-secondary)] hover:bg-[var(--w-surface)]'
                }`}
              >
                {p === 'weekly' ? 'Week' : p === 'monthly' ? 'Month' : 'Year'}
              </button>
            ))}
          </div>

          {/* Offset nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOffset((o) => o - 1)}
              className="p-1.5 rounded-md text-[var(--w-text-tertiary)] hover:text-[var(--w-text-primary)] hover:bg-white transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-[13px] text-[var(--w-text-secondary)] min-w-[80px] text-center font-medium">
              {periodLabel}
            </span>
            <button
              onClick={() => setOffset((o) => Math.min(0, o + 1))}
              disabled={offset >= 0}
              className="p-1.5 rounded-md text-[var(--w-text-tertiary)] hover:text-[var(--w-text-primary)] hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-default"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden px-[52px] pr-8 pb-8">
        {!data ? (
          <div className="flex items-center justify-center h-full text-[var(--w-text-tertiary)]">
            <p>Loading...</p>
          </div>
        ) : !data.hasEnoughData ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--w-text-tertiary)]">
            <svg className="w-12 h-12 mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M12 3l1.5 3.2 3.5.5-2.5 2.5.6 3.5L12 11l-3.1 1.7.6-3.5L7 6.7l3.5-.5L12 3z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-[14px] font-medium">Not enough data</p>
            <p className="text-[12px] mt-1 opacity-70">
              Complete more tasks this {period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'year'} to unlock your Wrapped
            </p>
          </div>
        ) : (
          <WrappedPlayer slides={slides} data={data} onClose={handleClose} />
        )}
      </div>
    </div>
  );
}
