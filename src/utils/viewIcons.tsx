import { ReactNode } from 'react';
import { ViewType } from '../types/task';

type IconSize = 'sm' | 'lg';

const VIEW_COLORS: Partial<Record<ViewType, string>> = {
  inbox: '#1E88E5',
  today: '#F5C000',
  upcoming: '#E53935',
  anytime: '#43A047',
  someday: '#8E6AC8',
  logbook: '#78909C',
  recurring: '#43A047',
  wrapped: '#5A9BDB',
  agenda: '#00ACC1',
  'added-today': '#FF7043',
  'smart-list': '#5C6BC0',
  review: '#5C6BC0',
};

function sz(size: IconSize) {
  return size === 'sm' ? 'w-5 h-5' : 'w-8 h-8';
}

export function getViewIcon(view: ViewType, size: IconSize = 'sm', active = false): ReactNode {
  const c = active ? 'currentColor' : (VIEW_COLORS[view] ?? 'currentColor');
  const s = sz(size);

  switch (view) {
    case 'inbox':
      return (
        <svg className={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 12h5l2 2h4l2-2h5" />
        </svg>
      );
    case 'today':
      return (
        <svg className={s} viewBox="0 0 24 24" fill={c}>
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
      );
    case 'upcoming':
      return (
        <svg className={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path d="M8 14h2v2H8z" fill={c} stroke="none" />
        </svg>
      );
    case 'anytime':
      return (
        <svg className={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'someday':
      return (
        <svg className={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
          <path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9" />
          <path d="M18.5 5.5L12 12" strokeLinecap="round" />
          <circle cx="20" cy="4" r="2" fill={c} stroke="none" />
        </svg>
      );
    case 'logbook':
      return (
        <svg className={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          <path d="M9 7h6M9 11h6" strokeLinecap="round" />
        </svg>
      );
    case 'recurring':
      return (
        <svg className={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'wrapped':
      return (
        <svg className={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
          <path d="M12 3l1.5 3.2 3.5.5-2.5 2.5.6 3.5L12 11l-3.1 1.7.6-3.5L7 6.7l3.5-.5L12 3z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 16l1 2.1 2.3.3-1.7 1.6.4 2.3L5 21l-2 1.3.4-2.3L1.7 18.4l2.3-.3L5 16z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 16l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.3-2 1.3.4-2.3-1.7-1.6 2.3-.3L19 16z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'agenda':
      return (
        <svg className={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 12h1M20 12h1M12 3v1M12 20v1" strokeLinecap="round" />
        </svg>
      );
    case 'added-today':
      return (
        <svg className={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path d="M12 14v4M10 16h4" strokeLinecap="round" />
        </svg>
      );
    case 'smart-list':
      return (
        <svg className={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
          <path d="M3 6h18M7 12h10M11 18h4" strokeLinecap="round" />
        </svg>
      );
    case 'review':
      return (
        <svg className={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

const VIEW_TYPES: ViewType[] = [
  'inbox', 'today', 'upcoming', 'anytime', 'someday', 'logbook',
  'recurring', 'wrapped', 'agenda', 'added-today', 'smart-list', 'review',
];

export const viewIcons: Record<ViewType, ReactNode> = Object.fromEntries(
  VIEW_TYPES.map(v => [v, getViewIcon(v, 'lg')])
) as Record<ViewType, ReactNode>;

export const viewIconsSmall: Record<ViewType, ReactNode> = Object.fromEntries(
  VIEW_TYPES.map(v => [v, getViewIcon(v, 'sm')])
) as Record<ViewType, ReactNode>;

export function PersonIcon({ className, stroke = 'currentColor', strokeWidth = 1.5 }: { className?: string; stroke?: string; strokeWidth?: number | string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function TagIcon({ className, stroke = 'currentColor', circleFill = 'none' }: { className?: string; stroke?: string; circleFill?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill={circleFill} stroke="none" />
    </svg>
  );
}
