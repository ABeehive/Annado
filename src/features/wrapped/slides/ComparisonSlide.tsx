import { SlideProps } from '../types';
import { useCountUp } from '../hooks/useCountUp';

export function ComparisonSlide({ data, active }: SlideProps) {
  const current = useCountUp(data.totalCompleted, 1000, active);
  const previous = useCountUp(data.previousCompleted ?? 0, 1000, active);
  const delta = data.deltaCompleted ?? 0;
  const isUp = delta > 0;
  const pMax = Math.max(data.totalCompleted, data.previousCompleted ?? 0, 1);
  const periodName = data.period === 'weekly' ? 'week' : 'month';

  return (
    <div className="h-full flex flex-col">
      <h2
        className="text-[24px] font-bold wrapped-fade-in"
        style={{ color: 'var(--slide-accent)', letterSpacing: '-0.02em' }}
      >
        {periodName === 'week' ? 'Week over week' : 'Month over month'}
      </h2>

      <div className="flex-1 flex items-center justify-center wrapped-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-end gap-10">
          {/* Previous */}
          <div className="flex flex-col items-center gap-2.5">
            <span className="text-[13px]" style={{ color: 'var(--slide-accent)', opacity: 0.4 }}>
              Previous {periodName}
            </span>
            <div
              className="w-[56px] rounded-xl overflow-hidden flex items-end"
              style={{ height: 180, backgroundColor: 'var(--slide-accent, #000)08' }}
            >
              <div
                className="w-full rounded-xl transition-all duration-700"
                style={{
                  height: `${(data.previousCompleted ?? 0) / pMax * 100}%`,
                  backgroundColor: 'var(--slide-accent, #000)30',
                  transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
                }}
              />
            </div>
            <span className="text-[32px] font-semibold" style={{ color: 'var(--slide-accent)', opacity: 0.4 }}>
              {previous}
            </span>
          </div>

          {/* Delta */}
          <div className="flex flex-col items-center pb-[60px]">
            <span className="text-[40px] mb-1">{isUp ? '\u{1F680}' : delta === 0 ? '\u{1F91D}' : '\u{1F4AA}'}</span>
            <span className="text-[28px] font-extrabold" style={{ color: 'var(--slide-accent)' }}>
              {isUp ? '+' : ''}{delta}
            </span>
          </div>

          {/* Current */}
          <div className="flex flex-col items-center gap-2.5">
            <span className="text-[13px] font-bold" style={{ color: 'var(--slide-accent)' }}>
              This {periodName}
            </span>
            <div
              className="w-[56px] rounded-xl overflow-hidden flex items-end"
              style={{ height: 180, backgroundColor: 'var(--slide-accent, #000)08' }}
            >
              <div
                className="w-full rounded-xl transition-all duration-700"
                style={{
                  height: `${data.totalCompleted / pMax * 100}%`,
                  backgroundColor: 'var(--slide-accent)',
                  transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
                  transitionDelay: '0.2s',
                }}
              />
            </div>
            <span className="text-[44px] font-extrabold" style={{ color: 'var(--slide-accent)' }}>
              {current}
            </span>
          </div>
        </div>
      </div>

      {delta !== 0 && (
        <div
          className="wrapped-fade-in text-center text-[14px] py-3 px-6 rounded-xl"
          style={{
            animationDelay: '0.7s',
            color: 'var(--slide-accent)',
            opacity: 0.5,
            backgroundColor: 'var(--slide-accent, #000)08',
          }}
        >
          {isUp
            ? `${Math.abs(Math.round((delta / (data.previousCompleted || 1)) * 100))}% increase from last ${periodName}`
            : `${Math.abs(Math.round((delta / (data.previousCompleted || 1)) * 100))}% decrease from last ${periodName}`
          }
        </div>
      )}
    </div>
  );
}
