interface ToggleProps {
  checked: boolean;
  onChange?: (v: boolean) => void;
  onClick?: () => void;
  title?: string;
}

export function Toggle({ checked, onChange, onClick, title }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onClick ? onClick() : onChange?.(!checked)}
      title={title}
      className={`relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-primary' : 'bg-[#D8D8D8] dark:bg-[#444]'
      }`}
    >
      <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-[14px]' : 'translate-x-[2px]'
      }`} />
    </button>
  );
}
