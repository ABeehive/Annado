import { SlideProps } from '../types';
import { SlideHeader } from './SlideHeader';
import { NoDataFallback } from './NoDataFallback';

export function TaskAgeSlide({ data, active }: SlideProps) {
  const { taskAgeBuckets } = data;
  const total = taskAgeBuckets.reduce((s, b) => s + b.count, 0);

  if (total === 0) {
    return <NoDataFallback message="Not enough completion data" />;
  }

  const max = Math.max(...taskAgeBuckets.map((b) => b.count), 1);
  const peakIdx = taskAgeBuckets.reduce((pi, b, i) => b.count > taskAgeBuckets[pi].count ? i : pi, 0);

  return (
    <div className="h-full flex flex-col">
      <SlideHeader title="How fast you move" subtitle="Age of tasks when completed" />

      <div className="flex-1 flex flex-col justify-center gap-3 wrapped-stagger">
        {taskAgeBuckets.map((bucket, i) => {
          const pct = Math.round((bucket.count / total) * 100);
          const barWidth = (bucket.count / max) * 100;
          const isPeak = i === peakIdx && bucket.count > 0;
          return (
            <div key={bucket.label} className="flex items-center gap-3">
              <span
                className="text-[13px] font-medium w-[90px] flex-shrink-0 text-right"
                style={{ color: 'var(--slide-accent)', opacity: isPeak ? 1 : 0.6 }}
              >
                {bucket.label}
              </span>
              <div
                className="flex-1 h-[16px] rounded-[8px] overflow-hidden"
                style={{ backgroundColor: 'color-mix(in srgb, var(--slide-accent) 10%, transparent)' }}
              >
                <div
                  className="h-full rounded-[8px] transition-all duration-500"
                  style={{
                    width: active ? `${barWidth}%` : '0%',
                    backgroundColor: 'var(--slide-accent)',
                    opacity: isPeak ? 1 : 0.55,
                    transitionDelay: `${0.1 + i * 0.07}s`,
                    transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
                  }}
                />
              </div>
              <span
                className="text-[14px] font-bold w-[40px] flex-shrink-0"
                style={{ color: 'var(--slide-accent)', opacity: isPeak ? 1 : 0.6 }}
              >
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
