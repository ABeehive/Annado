import React from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ProjectInfo } from '../types/task';
import { getProjectColor } from './projectColors';
import { getObsidianNoteUrl } from './obsidian';
import { useTaskStore } from '../stores/taskStore';
import { PersonIcon } from './viewIcons';

const BLOCKED_URL_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'blob:'];

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return !BLOCKED_URL_SCHEMES.some(s => parsed.protocol === s);
  } catch {
    // URL without scheme (e.g. "www.example.com") — still block dangerous schemes
    const lower = url.trim().toLowerCase();
    return !BLOCKED_URL_SCHEMES.some(s => lower.startsWith(s));
  }
}

// Combined regex to match both wiki-links [[...]] and markdown links [text](url)
export const COMBINED_LINK_REGEX = /\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)/g;

// Same plus bare URLs (used in notes contexts where pasted links should be clickable)
export const NOTES_LINK_REGEX = /\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s<>")\]]+)/g;

// Render a markdown link as clickable
export function MarkdownLink({ text, url }: { text: string; url: string }) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isSafeUrl(url)) return;
    // Bare absolute paths ("/Users/…/file.pdf") aren't valid URLs for the
    // opener — convert to a file:// URL (encodeURI handles the spaces).
    const target = url.startsWith('/') ? 'file://' + encodeURI(url) : url;
    openUrl(target).catch((err) => console.warn('Failed to open link:', target, err));
  };

  return (
    <button
      onClick={handleClick}
      className="text-primary dark:text-primary-light hover:underline"
    >
      {text}
    </button>
  );
}

// Render an unknown wiki-link as a link that opens the note in Obsidian.
// Right-click keeps the Create Person/Project menu reachable.
function ObsidianNoteLink({
  name,
  vaultPath,
  onContextMenu,
}: {
  name: string;
  vaultPath: string;
  onContextMenu?: (x: number, y: number) => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openUrl(getObsidianNoteUrl(vaultPath, name));
      }}
      onContextMenu={onContextMenu ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e.clientX, e.clientY);
      } : undefined}
      title={`Open "${name}" in Obsidian — right-click for more`}
      className="inline-flex items-center gap-0.5 text-primary dark:text-primary-light hover:underline"
    >
      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
      </svg>
      <span className="text-[13px]">{name}</span>
    </button>
  );
}

// Render a person wiki-link with icon and styling
export function PersonLink({ name, onClick, onRemove }: { name: string; onClick: () => void; onRemove?: () => void }) {
  return (
    <span className="relative inline-flex group/chip">
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#E8F0FE] dark:bg-[#2D3A4F] text-primary dark:text-primary-light hover:bg-[#D4E4FA] dark:hover:bg-[#3D4A5F] transition-colors"
      >
        <PersonIcon className="w-3 h-3" strokeWidth="2" />
        <span className="text-[12px] font-medium">{name}</span>
      </button>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(); }}
          className="absolute -top-1 -right-1 hidden group-hover/chip:flex w-3.5 h-3.5 rounded-full bg-[#888] text-white items-center justify-center text-[9px] leading-none hover:bg-danger transition-colors z-10"
        >×</button>
      )}
    </span>
  );
}

// Render a project wiki-link with icon and styling
export function ProjectLink({ name, color, onClick, onRemove }: { name: string; color?: string; onClick: () => void; onRemove?: () => void }) {
  return (
    <span className="relative inline-flex group/chip">
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-colors max-w-[200px]"
        style={{ backgroundColor: color ? `${color}20` : '#F0F0F0', color: color || '#666' }}
        title={name}
      >
        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="4" />
        </svg>
        <span className="text-[12px] font-medium truncate">{name}</span>
      </button>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(); }}
          className="absolute -top-1 -right-1 hidden group-hover/chip:flex w-3.5 h-3.5 rounded-full bg-[#888] text-white items-center justify-center text-[9px] leading-none hover:bg-danger transition-colors z-10"
        >×</button>
      )}
    </span>
  );
}

// Parse title and render wiki-links and markdown links with appropriate styling
export function RenderTitleWithLinks({
  title,
  personNames,
  projectNames,
  onPersonClick,
  onProjectClick,
  onUnknownLinkClick,
  onRemoveLink,
  projectColors,
  availableProjects,
  className,
  isObsidianVault = true,
  autolinkUrls = false,
  openUnknownWikilinks = false,
}: {
  title: string;
  personNames: Set<string>;
  projectNames: Set<string>;
  onPersonClick: (name: string) => void;
  onProjectClick: (name: string) => void;
  onUnknownLinkClick?: (name: string, x: number, y: number) => void;
  onRemoveLink?: (rawWikitext: string) => void;
  projectColors: Record<string, string>;
  availableProjects: ProjectInfo[];
  className?: string;
  isObsidianVault?: boolean;
  /** Also render bare https?:// URLs as clickable links (notes contexts) */
  autolinkUrls?: boolean;
  /** Unknown [[wikilinks]] open the note in Obsidian instead of the create menu (notes contexts) */
  openUnknownWikilinks?: boolean;
}) {
  const vaultPath = useTaskStore((s) => s.vaultPath);
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  // Fresh regex instance per render: no shared lastIndex state to reset
  const linkRegex = new RegExp((autolinkUrls ? NOTES_LINK_REGEX : COMBINED_LINK_REGEX).source, 'g');

  while ((match = linkRegex.exec(title)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(title.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      // Wiki-link: [[linkName]]
      const linkName = match[1];

      if (personNames.has(linkName)) {
        parts.push(<PersonLink key={`person-${keyIndex++}`} name={linkName} onClick={() => onPersonClick(linkName)} onRemove={onRemoveLink ? () => onRemoveLink(`[[${linkName}]]`) : undefined} />);
      } else if (projectNames.has(linkName)) {
        const projectInfo = availableProjects.find(p => p.name === linkName);
        const color = getProjectColor(linkName, projectInfo?.parentFolder, projectColors);
        parts.push(<ProjectLink key={`project-${keyIndex++}`} name={linkName} color={color} onClick={() => onProjectClick(linkName)} onRemove={onRemoveLink ? () => onRemoveLink(`[[${linkName}]]`) : undefined} />);
      } else if (openUnknownWikilinks && isObsidianVault && vaultPath) {
        parts.push(
          <ObsidianNoteLink
            key={`note-${keyIndex++}`}
            name={linkName}
            vaultPath={vaultPath}
            onContextMenu={onUnknownLinkClick ? (x, y) => onUnknownLinkClick(linkName, x, y) : undefined}
          />
        );
      } else if (onUnknownLinkClick) {
        const k = keyIndex++;
        parts.push(
          <button
            key={`unknown-${k}`}
            onClick={(e) => {
              e.stopPropagation();
              onUnknownLinkClick(linkName, e.clientX, e.clientY);
            }}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-dashed border-[#AAA] dark:border-[#666] text-[#888] dark:text-[#999] hover:border-primary hover:text-primary dark:hover:border-primary-light dark:hover:text-primary-light transition-colors cursor-pointer"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
            <span className="text-[12px]">{linkName}</span>
          </button>
        );
      } else if (!isObsidianVault) {
        // Non-Obsidian unknown link without handler: muted plain text
        parts.push(<span key={`plain-${keyIndex++}`} className="opacity-70">{linkName}</span>);
      } else {
        // Unknown wiki-link - keep as plain text without brackets
        parts.push(linkName);
      }
    } else if (match[2] !== undefined && match[3] !== undefined) {
      // Markdown link: [text](url)
      const linkText = match[2];
      const linkUrl = match[3];
      parts.push(<MarkdownLink key={`mdlink-${keyIndex++}`} text={linkText} url={linkUrl} />);
    } else if (match[4] !== undefined) {
      // Bare URL — exclude trailing punctuation from the link
      let url = match[4];
      const trimmed = url.replace(/[.,;:!?]+$/, '');
      const trailing = url.slice(trimmed.length);
      url = trimmed;
      parts.push(<MarkdownLink key={`url-${keyIndex++}`} text={url} url={url} />);
      if (trailing) parts.push(trailing);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < title.length) {
    parts.push(title.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}
