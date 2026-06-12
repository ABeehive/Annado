import { useMemo } from 'react';
import { SlideProps } from '../types';

const CONFETTI_COLORS = ['#E07070', '#E0A040', '#5B8FD4', '#45B89A', '#9898A8', '#8B80D8', '#F0B0C8'];

function Confetti() {
  const pieces = useMemo(() => {
    return Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: `${Math.random() * 1.5}s`,
      duration: `${2.5 + Math.random() * 2}s`,
      width: Math.random() > 0.5 ? 10 : 7,
      height: Math.random() > 0.5 ? 7 : 10,
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
    }));
  }, []);

  return (
    <div className="wrapped-confetti">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="wrapped-confetti-piece"
          style={{
            left: p.left,
            backgroundColor: p.color,
            width: p.width,
            height: p.height,
            borderRadius: p.borderRadius,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

export function OutroSlide({ data }: SlideProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center relative" style={{ overflow: 'hidden' }}>
      <Confetti />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
        <div className="text-[48px] mb-4 wrapped-fade-in">{'\u{1F389}'}</div>
        <h1
          className="text-[34px] font-extrabold wrapped-fade-in"
          style={{ animationDelay: '0.2s', color: 'var(--slide-accent)', letterSpacing: '-0.03em' }}
        >
          That's a wrap!
        </h1>
        <p
          className="text-[17px] mt-2 wrapped-fade-in"
          style={{ animationDelay: '0.4s', color: 'var(--slide-accent)', opacity: 0.55 }}
        >
          {data.totalCompleted} tasks completed in {data.periodLabel}
        </p>

        {data.topProjects.length > 0 && (
          <div className="flex flex-wrap gap-2.5 justify-center mt-7 wrapped-fade-in" style={{ animationDelay: '0.6s' }}>
            {data.topProjects.slice(0, 4).map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-[14px]"
                style={{ backgroundColor: 'var(--slide-accent, #000)0D' }}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="font-medium" style={{ color: 'var(--slide-accent)' }}>{p.name}</span>
                <span className="font-bold" style={{ color: 'var(--slide-accent)' }}>{p.tasks}</span>
              </div>
            ))}
          </div>
        )}

        <p
          className="text-[15px] mt-7 wrapped-fade-in"
          style={{ animationDelay: '0.8s', color: 'var(--slide-accent)', opacity: 0.4 }}
        >
          Keep going — your next milestone awaits
        </p>
      </div>
    </div>
  );
}
