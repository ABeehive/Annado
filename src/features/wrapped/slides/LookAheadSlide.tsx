import { SlideProps } from '../types';
import { useCountUp } from '../hooks/useCountUp';

export function LookAheadSlide({ data, active }: SlideProps) {
  const count = useCountUp(data.upcomingTasks, 1000, active);

  return (
    <div className="h-full flex flex-col">
      <h2
        className="text-[24px] font-bold wrapped-fade-in"
        style={{ color: 'var(--slide-accent)', letterSpacing: '-0.02em' }}
      >
        What's ahead
      </h2>

      <div className="flex gap-3 mt-5 wrapped-fade-in" style={{ animationDelay: '0.15s' }}>
        <StatCard value={count} label="total open" />
        {data.upcomingDeadlines.length > 0 && (
          <StatCard value={data.upcomingDeadlines.length} label="deadlines" />
        )}
      </div>

      {data.upcomingDeadlines.length > 0 && (
        <div className="mt-6 flex-1 wrapped-fade-in" style={{ animationDelay: '0.3s' }}>
          <p
            className="text-[12px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--slide-accent)', opacity: 0.4 }}
          >
            Key deadlines
          </p>
          <div className="wrapped-stagger">
            {data.upcomingDeadlines.map((d, i) => (
              <div
                key={d.title}
                className="flex items-center gap-3.5 py-3"
                style={{
                  borderBottom: i < data.upcomingDeadlines.length - 1 ? '1px solid var(--slide-accent, #000)10' : 'none',
                }}
              >
                <span
                  className="text-[13px] font-semibold flex-shrink-0 min-w-[56px]"
                  style={{
                    color: i === 0 ? '#C04040' : 'var(--slide-accent)',
                    opacity: i === 0 ? 1 : 0.45,
                    ...(i === 0 ? { backgroundColor: '#C0404015', padding: '3px 10px', borderRadius: 6 } : {}),
                  }}
                >
                  {d.deadline}
                </span>
                <span
                  className="text-[15px] font-medium flex-1 min-w-0 truncate"
                  style={{ color: 'var(--slide-accent)' }}
                >
                  {d.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div
      className="flex-1 text-center py-4 px-2 rounded-xl"
      style={{ backgroundColor: 'var(--slide-accent, #000)08' }}
    >
      <div className="text-[32px] font-extrabold" style={{ color: 'var(--slide-accent)' }}>
        {value}
      </div>
      <div className="text-[12px] mt-0.5" style={{ color: 'var(--slide-accent)', opacity: 0.45 }}>
        {label}
      </div>
    </div>
  );
}
