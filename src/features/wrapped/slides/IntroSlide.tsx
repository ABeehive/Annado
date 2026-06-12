import { SlideProps } from '../types';
import { useCountUp } from '../hooks/useCountUp';

export function IntroSlide({ data, active }: SlideProps) {
  const count = useCountUp(data.totalCompleted, 1200, active);

  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <p
        className="text-[14px] font-semibold tracking-widest uppercase wrapped-fade-in"
        style={{ color: 'var(--slide-accent)', opacity: 0.5 }}
      >
        {data.periodLabel}
      </p>

      <div className="flex-1 flex flex-col items-center justify-center">
        <h1
          className="text-[120px] font-extrabold leading-none wrapped-count-up"
          style={{ color: 'var(--slide-accent)', letterSpacing: '-0.06em' }}
        >
          {count}
        </h1>
        <p
          className="text-[22px] font-medium mt-2 wrapped-fade-in"
          style={{ animationDelay: '0.3s', color: 'var(--slide-accent)', opacity: 0.7 }}
        >
          tasks completed
        </p>
      </div>

      {data.totalCreated > 0 && (
        <div className="flex gap-2 wrapped-fade-in" style={{ animationDelay: '0.6s' }}>
          <Stat value={data.totalCreated} label="created" />
          {data.deltaCompleted !== null && data.deltaCompleted !== 0 && (
            <Stat
              value={`${data.deltaCompleted > 0 ? '+' : ''}${data.deltaCompleted}`}
              label={`vs last ${data.period === 'weekly' ? 'week' : data.period === 'monthly' ? 'month' : 'year'}`}
              highlight={data.deltaCompleted > 0}
            />
          )}
          <Stat value={`${data.completionRate}%`} label="completion" />
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, highlight }: { value: string | number; label: string; highlight?: boolean }) {
  return (
    <div className="text-center flex-1 min-w-[72px]">
      <div
        className="text-[26px] font-bold"
        style={{ color: highlight ? '#3A8050' : 'var(--slide-accent)' }}
      >
        {value}
      </div>
      <div className="text-[12px] mt-0.5" style={{ color: 'var(--slide-accent)', opacity: 0.45 }}>
        {label}
      </div>
    </div>
  );
}
