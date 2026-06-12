import { SlideProps } from '../types';
import { AnimatedBar } from '../components/AnimatedBar';
import { SlideHeader } from './SlideHeader';

interface BarChartSlideProps extends SlideProps {
  title: string;
  subtitle?: string;
  bars: { label: string; count: number }[];
}

export function BarChartSlide({ active, title, subtitle, bars }: BarChartSlideProps) {
  const max = Math.max(...bars.map((b) => b.count), 1);
  const peakIndex = bars.reduce((pi, b, i) => b.count > bars[pi].count ? i : pi, 0);

  return (
    <div className="h-full flex flex-col">
      <SlideHeader title={title} subtitle={subtitle} />
      <div className="flex-1 flex items-end">
        <div className="flex gap-2 w-full items-end">
          {bars.map((bar, i) => (
            <AnimatedBar
              key={bar.label}
              height={(bar.count / max) * 100}
              label={bar.label}
              value={bar.count}
              index={i}
              active={active}
              peak={i === peakIndex && bar.count > 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
