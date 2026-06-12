import { SlideProps } from '../types';
import { useCountUp } from '../hooks/useCountUp';

interface BigNumberSlideProps extends SlideProps {
  number: number;
  label: string;
  sublabel?: string;
  suffix?: string;
}

export function BigNumberSlide({ active, number, label, sublabel, suffix = '' }: BigNumberSlideProps) {
  const count = useCountUp(number, 1200, active);

  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <p
        className="text-[14px] font-semibold wrapped-fade-in"
        style={{ color: 'var(--slide-accent)', opacity: 0.5 }}
      >
        {label}
      </p>
      <h1
        className="text-[96px] font-extrabold leading-none wrapped-count-up"
        style={{ color: 'var(--slide-accent)', letterSpacing: '-0.04em' }}
      >
        {count}{suffix}
      </h1>
      {sublabel && (
        <p
          className="text-[16px] font-medium mt-4 wrapped-fade-in"
          style={{ animationDelay: '0.4s', color: 'var(--slide-accent)', opacity: 0.55 }}
        >
          {sublabel}
        </p>
      )}
    </div>
  );
}
