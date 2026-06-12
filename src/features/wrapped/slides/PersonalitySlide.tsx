import { SlideProps } from '../types';
import { NoDataFallback } from './NoDataFallback';

export function PersonalitySlide({ data }: SlideProps) {
  if (!data.personalityType) {
    return <NoDataFallback message="Not enough data for personality type" />;
  }

  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <p
        className="text-[14px] font-semibold mb-4 wrapped-fade-in"
        style={{ color: 'var(--slide-accent)', opacity: 0.5 }}
      >
        Your productivity personality
      </p>
      <h1
        className="text-[44px] font-extrabold leading-tight wrapped-fade-in wrapped-gradient-text"
        style={{
          animationDelay: '0.2s',
          backgroundImage: 'linear-gradient(135deg, var(--w-purple), var(--w-accent-blue))',
        }}
      >
        {data.personalityType}
      </h1>
      {data.personalitySubtitle && (
        <p
          className="text-[16px] font-medium mt-4 max-w-[320px] wrapped-fade-in"
          style={{ animationDelay: '0.5s', color: 'var(--slide-accent)', opacity: 0.6 }}
        >
          {data.personalitySubtitle}
        </p>
      )}

      {/* Stats summary */}
      <div className="flex gap-8 mt-10 wrapped-fade-in" style={{ animationDelay: '0.8s' }}>
        <div>
          <p className="text-[24px] font-bold" style={{ color: 'var(--slide-accent)' }}>{data.longestStreak}</p>
          <p className="text-[11px]" style={{ color: 'var(--slide-accent)', opacity: 0.4 }}>day streak</p>
        </div>
        <div>
          <p className="text-[24px] font-bold" style={{ color: 'var(--slide-accent)' }}>{data.topProjects.length}</p>
          <p className="text-[11px]" style={{ color: 'var(--slide-accent)', opacity: 0.4 }}>projects</p>
        </div>
        <div>
          <p className="text-[24px] font-bold" style={{ color: 'var(--slide-accent)' }}>{data.priorityBreakdown.high}</p>
          <p className="text-[11px]" style={{ color: 'var(--slide-accent)', opacity: 0.4 }}>high priority</p>
        </div>
      </div>
    </div>
  );
}
