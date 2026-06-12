import { SlideProps } from '../types';
import { SlideHeader } from './SlideHeader';
import { NoDataFallback } from './NoDataFallback';

export function AreaDistributionSlide({ data, active }: SlideProps) {
  if (data.areas.length === 0) {
    return <NoDataFallback message="No area data available" />;
  }

  // Build segments for the horizontal stacked bar
  const total = data.areas.reduce((sum, a) => sum + a.tasks, 0) || 1;

  return (
    <div className="h-full flex flex-col">
      <SlideHeader title="Area Distribution" subtitle="How your work spreads across areas" />

      {/* Stacked bar */}
      <div
        className="flex h-[32px] rounded-lg overflow-hidden mb-8 wrapped-fade-in"
        style={{ animationDelay: '0.2s' }}
      >
        {data.areas.map((area) => (
          <div
            key={area.name}
            className="transition-all duration-700"
            style={{
              width: active ? `${(area.tasks / total) * 100}%` : '0%',
              backgroundColor: area.color,
              transitionDelay: '0.4s',
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex-1 flex flex-col justify-center wrapped-stagger">
        {data.areas.slice(0, 8).map((area) => (
          <div key={area.name} className="flex items-center gap-3 py-1.5">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: area.color }}
            />
            <span className="text-[14px] font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--slide-accent)' }}>
              {area.name}
            </span>
            <span className="text-[13px] font-semibold flex-shrink-0" style={{ color: 'var(--slide-accent)', opacity: 0.7 }}>
              {area.pct}%
            </span>
            <span className="text-[12px] flex-shrink-0 w-[40px] text-right" style={{ color: 'var(--slide-accent)', opacity: 0.45 }}>
              {area.tasks}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
