const BAR_COLORS = ['#5C6BC0', '#1E88E5', '#43A047', '#F5C000', '#8E6AC8', '#E53935', '#78909C'];

interface AnimatedBarProps {
  height: number; // percentage 0-100
  color?: string;
  label: string;
  value: number;
  index: number;
  active: boolean;
  maxHeight?: number;
  peak?: boolean;
}

export function AnimatedBar({ height, color, label, value, index, active, maxHeight = 160, peak }: AnimatedBarProps) {
  const barHeight = Math.max(4, (height / 100) * maxHeight);
  const barColor = color || BAR_COLORS[index % BAR_COLORS.length];

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <div className="flex flex-col items-center justify-end" style={{ height: maxHeight }}>
        {value > 0 && (
          <span
            className="font-semibold mb-1"
            style={{
              fontSize: peak ? 22 : 13,
              fontWeight: peak ? 800 : 600,
              color: 'var(--slide-accent)',
              opacity: active ? (peak ? 1 : 0.6) : 0,
              transition: `opacity 0.3s ease ${0.3 + index * 0.05}s`,
            }}
          >
            {value}
          </span>
        )}
        <div
          className="wrapped-bar-grow"
          style={{
            width: peak ? '120%' : '100%',
            height: barHeight,
            background: peak
              ? `linear-gradient(to top, ${barColor}, ${barColor}D0)`
              : `${barColor}22`,
            borderRadius: 10,
            animationDelay: active ? `${0.1 + index * 0.05}s` : '0s',
            animationPlayState: active ? 'running' : 'paused',
            opacity: active ? 1 : 0,
          }}
        />
      </div>
      <span
        className="font-medium"
        style={{
          fontSize: peak ? 14 : 12,
          fontWeight: peak ? 700 : 400,
          color: 'var(--slide-accent)',
          opacity: peak ? 1 : 0.4,
        }}
      >
        {label}
      </span>
    </div>
  );
}
