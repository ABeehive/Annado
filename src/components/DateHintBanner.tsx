import { DateHint } from '../utils/detectDateHints';

interface DateHintBannerProps {
  hint: DateHint;
  onAccept: () => void;
  onDismiss: () => void;
}

export function DateHintBanner({ hint, onAccept, onDismiss }: DateHintBannerProps) {
  const icon = hint.type === 'deadline' ? '📅' : '💡';
  const prefix = hint.type === 'deadline' ? 'Deadline' : 'Start';

  return (
    <div className="flex items-center gap-2 px-5 py-1.5 pl-14 bg-amber-50 dark:bg-amber-950/20 text-[12px]">
      <span>{icon}</span>
      <span className="text-[#666] dark:text-[#999]">
        {prefix}{' '}
        <span className="font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">
          {hint.matchedPhrase}
        </span>
        ?
      </span>
      <button
        type="button"
        onClick={onAccept}
        className="px-2 py-0.5 text-[11px] bg-primary text-white rounded hover:bg-[#4A5AAF] transition-colors"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="text-[#AAA] hover:text-[#555] dark:hover:text-[#999] transition-colors text-[11px]"
      >
        Ignore
      </button>
    </div>
  );
}
