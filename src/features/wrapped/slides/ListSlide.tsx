import { SlideProps } from '../types';
import { SlideHeader } from './SlideHeader';
import { NoDataFallback } from './NoDataFallback';

interface ListSlideProps extends SlideProps {
  title: string;
  subtitle?: string;
  items: { label: string; value: number }[];
}

export function ListSlide({ title, subtitle, items }: ListSlideProps) {
  if (items.length === 0) {
    return <NoDataFallback />;
  }

  return (
    <div className="h-full flex flex-col">
      <SlideHeader title={title} subtitle={subtitle} />

      <div className="flex-1 flex flex-col justify-center wrapped-stagger">
        {items.map((item, i) => (
          <div
            key={item.label}
            className="flex items-center gap-3 py-2.5"
            style={{ borderBottom: i < items.length - 1 ? '1px solid var(--slide-accent, #000)10' : 'none' }}
          >
            <span
              className="text-[14px] font-semibold w-[24px]"
              style={{ color: 'var(--slide-accent)', opacity: 0.4 }}
            >
              {i + 1}
            </span>
            <span
              className="text-[15px] font-medium flex-1 min-w-0 truncate"
              style={{ color: 'var(--slide-accent)' }}
            >
              {item.label}
            </span>
            <span
              className="text-[15px] font-bold flex-shrink-0"
              style={{ color: 'var(--slide-accent)', opacity: 0.7 }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
