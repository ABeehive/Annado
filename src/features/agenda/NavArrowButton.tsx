interface NavArrowButtonProps {
  direction: 'prev' | 'next';
  onClick: () => void;
  className?: string;
  iconClassName?: string;
}

export function NavArrowButton({
  direction,
  onClick,
  className = 'p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#888] dark:text-[#666]',
  iconClassName = 'w-4 h-4',
}: NavArrowButtonProps) {
  const d = direction === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';

  return (
    <button onClick={onClick} className={className}>
      <svg className={iconClassName} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d={d} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
