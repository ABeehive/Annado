import { useState, useRef, useEffect } from 'react';

// Convert keybinding string to display format
function formatKeybinding(binding: string): string[] {
  const parts = binding.toLowerCase().split('+');
  return parts.map(part => {
    switch (part) {
      case 'meta': return '⌘';
      case 'shift': return '⇧';
      case 'ctrl': return '⌃';
      case 'alt': return '⌥';
      default: return part.toUpperCase();
    }
  });
}

interface KeybindingInputProps {
  value: string;
  onChange: (keys: string) => void;
}

export function KeybindingInput({ value, onChange }: KeybindingInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels recording
      if (e.key === 'Escape') {
        setIsRecording(false);
        return;
      }

      // Build the keybinding string
      const parts: string[] = [];
      if (e.metaKey) parts.push('meta');
      if (e.ctrlKey) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');

      // Don't record modifier-only presses
      const key = e.key.toLowerCase();
      if (['meta', 'control', 'alt', 'shift'].includes(key)) {
        return;
      }

      // Only allow keys that the Rust parser supports
      const SUPPORTED_KEYS = new Set([
        'a','b','c','d','e','f','g','h','i','j','k','l','m',
        'n','o','p','q','r','s','t','u','v','w','x','y','z',
        '0','1','2','3','4','5','6','7','8','9',
        ' ', 'enter', 'escape', 'backspace', 'tab',
      ]);
      if (!SUPPORTED_KEYS.has(key)) return;

      parts.push(key);
      onChange(parts.join('+'));
      setIsRecording(false);
    };

    const handleBlur = () => {
      setIsRecording(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    buttonRef.current?.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      buttonRef.current?.removeEventListener('blur', handleBlur);
    };
  }, [isRecording, onChange]);

  const displayKeys = formatKeybinding(value);

  return (
    <button
      ref={buttonRef}
      onClick={() => setIsRecording(true)}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
        isRecording
          ? 'bg-primary/15 ring-1.5 ring-primary/40'
          : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
      }`}
    >
      {isRecording ? (
        <span className="text-[11px] text-primary font-medium">Press keys...</span>
      ) : (
        displayKeys.map((key, index) => (
          <kbd
            key={index}
            className="min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-[10px] font-medium text-[#777] dark:text-[#999] bg-[#F5F5F5] dark:bg-[#333] rounded-[5px] border border-[#E0E0E0] dark:border-[#444]"
          >
            {key}
          </kbd>
        ))
      )}
    </button>
  );
}

export { KEYBINDING_DEFAULTS } from '../utils/keybindings';
