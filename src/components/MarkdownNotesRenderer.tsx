import { ProjectInfo } from '../types/task';
import { WikilinkRenderer } from './WikilinkRenderer';
import { NOTES_LINK_REGEX } from '../utils/RenderTitleWithLinks';

interface MarkdownNotesRendererProps {
  notes: string;
  personNames: Set<string>;
  projectNames: Set<string>;
  onPersonClick: (name: string) => void;
  onProjectClick: (name: string) => void;
  onRemoveLink?: (rawWikitext: string) => void;
  projectColors: Record<string, string>;
  availableProjects: ProjectInfo[];
  isObsidianVault?: boolean;
}

// Wikilink/link context shared by every inline markdown render (notes, subtasks, …).
export type WikilinkProps = Omit<MarkdownNotesRendererProps, 'notes'>;

// Inline token types produced by tokenizeInline()
type InlineToken =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'code'; content: string }
  | { type: 'strikethrough'; content: string }
  | { type: 'highlight'; content: string };

// Split a line's text into inline markdown tokens.
// Bold/italic regex is ordered so ** is checked before * to avoid consuming one star at a time.
const INLINE_RE = /\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|==(.+?)==|`([^`]+)`|\*([^*\n]+)\*|_([^_\n]+)_/g;

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;

  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ type: 'text', content: text.slice(last, m.index) });
    }
    if (m[1] !== undefined || m[2] !== undefined) {
      tokens.push({ type: 'bold', content: m[1] ?? m[2] });
    } else if (m[3] !== undefined) {
      tokens.push({ type: 'strikethrough', content: m[3] });
    } else if (m[4] !== undefined) {
      tokens.push({ type: 'highlight', content: m[4] });
    } else if (m[5] !== undefined) {
      tokens.push({ type: 'code', content: m[5] });
    } else if (m[6] !== undefined || m[7] !== undefined) {
      tokens.push({ type: 'italic', content: m[6] ?? m[7] });
    }
    last = INLINE_RE.lastIndex;
  }

  if (last < text.length) {
    tokens.push({ type: 'text', content: text.slice(last) });
  }
  return tokens;
}

// Links ([[wiki]], [text](url), bare URLs) must survive emphasis tokenization:
// underscores/asterisks inside a link's text or URL would otherwise match the
// italic/bold rules and shred the link before it can be rendered. Extract links
// as atomic text tokens first; only the segments between them get emphasis
// parsing. (Tradeoff: a markdown link inside `backticks` renders as a link.)
function tokenizeInlineProtectingLinks(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const linkRegex = new RegExp(NOTES_LINK_REGEX.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = linkRegex.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push(...tokenizeInline(text.slice(last, m.index)));
    }
    tokens.push({ type: 'text', content: m[0] });
    last = m.index + m[0].length;
  }

  if (last < text.length) {
    tokens.push(...tokenizeInline(text.slice(last)));
  }
  return tokens;
}

// Render inline tokens for a single line, calling WikilinkRenderer for text content.
// Reused anywhere a single line of markdown needs rendering (notes lines, subtask titles).
export function InlineMarkdown({
  text,
  wikilinkProps,
  className,
}: {
  text: string;
  wikilinkProps: WikilinkProps;
  /** Wrap the rendered tokens in a styled span (e.g. task titles carry their own text styling). */
  className?: string;
}) {
  const tokens = tokenizeInlineProtectingLinks(text);
  const rendered = (
    <>
      {tokens.map((tok, i) => {
        // code is always literal — no wikilink processing inside backticks
        if (tok.type === 'code') {
          return (
            <code
              key={i}
              className="px-[5px] py-[1px] rounded text-[12px] font-mono bg-[#F0F0F0] dark:bg-[#333] text-[#C7254E] dark:text-[#F4929F]"
            >
              {tok.content}
            </code>
          );
        }

        const inner = (
          <WikilinkRenderer
            key={i}
            title={tok.content}
            personNames={wikilinkProps.personNames}
            projectNames={wikilinkProps.projectNames}
            onPersonClick={wikilinkProps.onPersonClick}
            onProjectClick={wikilinkProps.onProjectClick}
            onRemoveLink={wikilinkProps.onRemoveLink}
            projectColors={wikilinkProps.projectColors}
            availableProjects={wikilinkProps.availableProjects}
            isObsidianVault={wikilinkProps.isObsidianVault}
            autolinkUrls
          />
        );

        if (tok.type === 'bold') return <strong key={i} className="font-semibold">{inner}</strong>;
        if (tok.type === 'italic') return <em key={i}>{inner}</em>;
        if (tok.type === 'strikethrough') return <s key={i} className="text-[#AAA] dark:text-[#666]">{inner}</s>;
        // <mark> defaults to black-on-yellow UA styling, which breaks dark mode — inherit text color instead
        if (tok.type === 'highlight') return <mark key={i} className="bg-[#FFF3A3] dark:bg-[#5C5320] text-inherit rounded-[2px] px-px">{inner}</mark>;
        return inner; // 'text'
      })}
    </>
  );

  return className ? <span className={className}>{rendered}</span> : rendered;
}

export function MarkdownNotesRenderer(props: MarkdownNotesRendererProps) {
  const { notes, ...wikilinkProps } = props;
  const lines = notes.split('\n');

  return (
    <>
      {lines.map((line, i) => {
        // Empty line → small vertical gap
        if (line === '') {
          return <div key={i} className="h-2" />;
        }

        // Headings
        if (line.startsWith('### ')) {
          return (
            <div key={i} className="text-[13px] font-semibold text-[#444] dark:text-[#CCC] mt-2 mb-0.5">
              <InlineMarkdown text={line.slice(4)} wikilinkProps={wikilinkProps} />
            </div>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <div key={i} className="text-[14px] font-semibold text-[#333] dark:text-[#DDD] mt-2.5 mb-0.5">
              <InlineMarkdown text={line.slice(3)} wikilinkProps={wikilinkProps} />
            </div>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <div key={i} className="text-[15px] font-bold text-[#222] dark:text-[#EEE] mt-3 mb-1">
              <InlineMarkdown text={line.slice(2)} wikilinkProps={wikilinkProps} />
            </div>
          );
        }

        // Blockquote
        if (line.startsWith('> ')) {
          return (
            <div key={i} className="pl-3 border-l-2 border-[#D0D0D0] dark:border-[#555] text-[#888] dark:text-[#888] italic leading-relaxed">
              <InlineMarkdown text={line.slice(2)} wikilinkProps={wikilinkProps} />
            </div>
          );
        }

        // Checklist lines are rendered separately in ChecklistItemRow — skip here
        if (/^- \[[ xX]\] /.test(line.trim())) {
          return null;
        }

        // Unordered list item (- or *)
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-2 leading-relaxed">
              <span className="mt-[3px] text-[10px] text-[#888] dark:text-[#666] flex-shrink-0">●</span>
              <span>
                <InlineMarkdown text={line.slice(2)} wikilinkProps={wikilinkProps} />
              </span>
            </div>
          );
        }

        // Plain paragraph
        return (
          <div key={i} className="leading-relaxed">
            <InlineMarkdown text={line} wikilinkProps={wikilinkProps} />
          </div>
        );
      })}
    </>
  );
}
