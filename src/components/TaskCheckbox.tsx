interface TaskCheckboxProps {
  completed: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onChange?: () => void;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

const SIZES = {
  sm: { box: 'w-3.5 h-3.5', check: 'w-2 h-2' },
  md: { box: 'w-4 h-4', check: 'w-2.5 h-2.5' },
  lg: { box: 'w-5 h-5', check: 'w-2.5 h-2.5' },
};

export function TaskCheckbox({
  completed,
  onClick,
  onChange,
  size = 'md',
  color,
  className = '',
}: TaskCheckboxProps) {
  const { box, check } = SIZES[size];

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (onClick) {
      onClick(e);
    } else {
      onChange?.();
    }
  };

  // When a custom color is provided, use inline styles; otherwise use Tailwind classes for dark mode support
  const colorClasses = color
    ? ''
    : completed
      ? 'bg-primary border-primary'
      : 'border-black/20 dark:border-white/25';

  return (
    <button
      onClick={handleClick}
      className={`${box} rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center transition-colors ${colorClasses} ${className}`}
      style={color ? {
        borderColor: completed ? color : `${color}80`,
        backgroundColor: completed ? color : undefined,
      } : undefined}
    >
      {completed && (
        <svg className={`${check} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}
