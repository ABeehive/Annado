import { useState, useEffect, useCallback, useMemo } from 'react';
import { SlideConfig, WrappedData } from './types';

interface WrappedPlayerProps {
  slides: SlideConfig[];
  data: WrappedData;
  onClose: () => void;
}

export function WrappedPlayer({ slides, data, onClose }: WrappedPlayerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState<'right' | 'left'>('right');
  const [animKey, setAnimKey] = useState(0);

  const isDark = useMemo(() => {
    return document.documentElement.classList.contains('dark');
  }, []);

  const goNext = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      setDirection('right');
      setCurrentSlide((s) => s + 1);
      setAnimKey((k) => k + 1);
    }
  }, [currentSlide, slides.length]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) {
      setDirection('left');
      setCurrentSlide((s) => s - 1);
      setAnimKey((k) => k + 1);
    }
  }, [currentSlide]);

  const goTo = useCallback((i: number) => {
    setDirection(i > currentSlide ? 'right' : 'left');
    setCurrentSlide(i);
    setAnimKey((k) => k + 1);
  }, [currentSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, onClose]);

  if (slides.length === 0) return null;

  const slide = slides[currentSlide];
  const SlideComponent = slide.component;
  const theme = slide.theme;
  const gradient = theme ? (isDark ? theme.gradientDark : theme.gradient) : undefined;
  const accent = theme ? (isDark ? theme.accentDark : theme.accent) : undefined;

  return (
    <div className="wrapped-player">
      {/* Progress bar */}
      <div className="flex gap-1 mb-3">
        {slides.map((_, i) => (
          <div
            key={i}
            className="h-[4px] flex-1 rounded-full transition-all duration-300 cursor-pointer"
            onClick={() => goTo(i)}
            style={{
              backgroundColor:
                i < currentSlide
                  ? (accent ? `${accent}40` : 'rgba(0,0,0,0.2)')
                  : i === currentSlide
                  ? (accent || 'var(--w-accent-blue)')
                  : 'rgba(0,0,0,0.08)',
            }}
          />
        ))}
      </div>

      {/* Slide container = the colorful card */}
      <div
        className="wrapped-slide-container"
        style={{
          background: gradient || 'var(--w-surface)',
          '--slide-accent': accent || 'var(--w-text-primary)',
        } as React.CSSProperties}
      >
        <div
          key={animKey}
          className={direction === 'right' ? 'wrapped-slide-right' : 'wrapped-slide-left'}
          style={{ height: '100%', position: 'relative' }}
        >
          <SlideComponent data={data} active={true} {...(slide.props || {})} />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-3 pb-2">
        <button
          onClick={goPrev}
          disabled={currentSlide === 0}
          className="text-[13px] text-[var(--w-text-tertiary)] hover:text-[var(--w-text-secondary)] transition-colors disabled:opacity-0 disabled:cursor-default py-2 px-1 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        {/* Dot navigation */}
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <span
              key={i}
              onClick={() => goTo(i)}
              className="block rounded-full cursor-pointer transition-all duration-200"
              style={{
                width: i === currentSlide ? 8 : 6,
                height: i === currentSlide ? 8 : 6,
                backgroundColor: i === currentSlide
                  ? 'var(--w-text-secondary)'
                  : 'var(--w-border)',
              }}
            />
          ))}
        </div>

        <button
          onClick={currentSlide === slides.length - 1 ? onClose : goNext}
          className="text-[13px] font-medium text-[var(--w-text-primary)] hover:text-[var(--w-accent-blue)] transition-colors py-2 px-1 flex items-center gap-1"
        >
          {currentSlide === slides.length - 1 ? 'Done' : 'Next'}
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
