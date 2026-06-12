import { SlideProps } from '../types';
import { NoDataFallback } from './NoDataFallback';

export function ContrastSlide({ data }: SlideProps) {
  const hasLongest = data.longestTask !== null;
  const hasStalest = data.stalestTask !== null;

  if (!hasLongest && !hasStalest) {
    return <NoDataFallback message="No contrast data available" />;
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-8">
      {hasLongest && (
        <div className="wrapped-card w-full wrapped-fade-in" style={{ animationDelay: '0.1s' }}>
          <p
            className="text-[12px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--slide-accent)', opacity: 0.4 }}
          >
            Longest task to complete
          </p>
          <p className="text-[16px] font-medium mb-2 line-clamp-2" style={{ color: 'var(--slide-accent)' }}>
            {data.longestTask!.title}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-[28px] font-bold text-[var(--w-orange)]">
              {data.longestTask!.days}
            </span>
            <span className="text-[14px]" style={{ color: 'var(--slide-accent)', opacity: 0.6 }}>
              days from creation to completion
            </span>
          </div>
          {data.longestTask!.project && (
            <p className="text-[12px] mt-2" style={{ color: 'var(--slide-accent)', opacity: 0.35 }}>
              in {data.longestTask!.project}
            </p>
          )}
        </div>
      )}

      {hasStalest && (
        <div className="wrapped-card w-full wrapped-fade-in" style={{ animationDelay: '0.4s' }}>
          <p
            className="text-[12px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--slide-accent)', opacity: 0.4 }}
          >
            Oldest open task
          </p>
          <p className="text-[16px] font-medium mb-2 line-clamp-2" style={{ color: 'var(--slide-accent)' }}>
            {data.stalestTask!.title}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-[28px] font-bold text-[var(--w-red)]">
              {data.stalestTask!.daysOpen}
            </span>
            <span className="text-[14px]" style={{ color: 'var(--slide-accent)', opacity: 0.6 }}>
              days and counting
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
