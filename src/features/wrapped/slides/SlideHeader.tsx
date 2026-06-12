interface SlideHeaderProps {
  title: string;
  subtitle?: string;
}

export function SlideHeader({ title, subtitle }: SlideHeaderProps) {
  return (
    <>
      <h2
        className="text-[24px] font-bold mb-1 wrapped-fade-in"
        style={{ color: 'var(--slide-accent)', letterSpacing: '-0.02em' }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="text-[14px] mb-6 wrapped-fade-in"
          style={{ animationDelay: '0.1s', color: 'var(--slide-accent)', opacity: 0.5 }}
        >
          {subtitle}
        </p>
      )}
    </>
  );
}
