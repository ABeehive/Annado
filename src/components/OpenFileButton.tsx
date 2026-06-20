import { useState } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { ContextMenu } from './ContextMenu';
import { buildOpenMenuItems } from '../utils/openMenuItems';
import { openEntityFile, openLabel } from '../utils/pathOpener';

interface OpenFileButtonProps {
  path: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function OpenFileButton({
  path,
  showLabel = false,
  size = 'sm',
  className = '',
}: OpenFileButtonProps) {
  const pathOpeners = useTaskStore((s) => s.pathOpeners);
  const openerPrefs = useTaskStore((s) => s.openerPrefs);
  const isObsidianVault = useTaskStore((s) => s.isObsidianVault);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  const buttonClassName = `inline-flex shrink-0 items-center justify-center gap-1 text-[#ADADB8] hover:text-primary dark:hover:text-primary-light transition duration-[120ms] ${className}`;

  return (
    <>
      <button
        type="button"
        title={openLabel(path, pathOpeners, openerPrefs, isObsidianVault)}
        onClick={(e) => {
          e.stopPropagation();
          void openEntityFile(path, pathOpeners, openerPrefs, isObsidianVault).catch(console.error);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        className={buttonClassName}
      >
        <svg
          className={`${iconSize} block`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        {showLabel && (
          <span className="text-[11px]">{openLabel(path, pathOpeners, openerPrefs, isObsidianVault)}</span>
        )}
      </button>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildOpenMenuItems(path, pathOpeners, openerPrefs, isObsidianVault)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
