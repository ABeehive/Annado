import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkdownNotesRenderer } from './MarkdownNotesRenderer';
import { useTaskStore } from '../stores/taskStore';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(() => Promise.resolve()),
}));
import { openUrl } from '@tauri-apps/plugin-opener';

const baseProps = {
  personNames: new Set<string>(),
  projectNames: new Set<string>(),
  onPersonClick: vi.fn(),
  onProjectClick: vi.fn(),
  projectColors: {},
  availableProjects: [],
  isObsidianVault: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  useTaskStore.setState({ vaultPath: '/Users/demo/Vault' });
});

describe('markdown links survive emphasis tokenization', () => {
  it('renders a file link with underscores and spaces as one clickable link', () => {
    // Real-world case: link text and absolute path full of underscores/spaces
    const notes =
      '[Yearly_Progress_Report_2025-2026_v2_ final_ rev](/Users/demo/Dropbox/Apps/Reader-Sync/Yearly_Progress_Report_2025-2026_v2_ final_ rev.pdf)';
    render(<MarkdownNotesRenderer {...baseProps} notes={notes} />);

    const link = screen.getByRole('button', {
      name: 'Yearly_Progress_Report_2025-2026_v2_ final_ rev',
    });
    fireEvent.click(link);
    expect(openUrl).toHaveBeenCalledWith(
      'file:///Users/demo/Dropbox/Apps/Reader-Sync/Yearly_Progress_Report_2025-2026_v2_%20final_%20rev.pdf'
    );
  });

  it('keeps bare URLs with underscores intact', () => {
    render(<MarkdownNotesRenderer {...baseProps} notes="see https://en.wikipedia.org/wiki/Foo_bar today" />);
    fireEvent.click(screen.getByRole('button', { name: 'https://en.wikipedia.org/wiki/Foo_bar' }));
    expect(openUrl).toHaveBeenCalledWith('https://en.wikipedia.org/wiki/Foo_bar');
  });

  it('still italicizes underscore emphasis outside links', () => {
    render(<MarkdownNotesRenderer {...baseProps} notes="this is _important_ stuff" />);
    const em = screen.getByText('important');
    expect(em.closest('em')).not.toBeNull();
  });

  it('still bolds text around a link', () => {
    render(
      <MarkdownNotesRenderer {...baseProps} notes="**read** [doc](/Users/demo/doc.pdf) now" />
    );
    expect(screen.getByText('read').closest('strong')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'doc' })).toBeInTheDocument();
  });
});

describe('==highlight== rendering', () => {
  it('renders ==text== as a mark without the delimiters', () => {
    render(<MarkdownNotesRenderer {...baseProps} notes="dit is ==PRIVACY== gevoelig" />);
    expect(screen.getByText('PRIVACY').closest('mark')).not.toBeNull();
    expect(screen.queryByText(/==/)).toBeNull();
  });

  it('highlights text next to a link', () => {
    render(
      <MarkdownNotesRenderer {...baseProps} notes="==read== [doc](/Users/demo/doc.pdf) now" />
    );
    expect(screen.getByText('read').closest('mark')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'doc' })).toBeInTheDocument();
  });

  it('leaves an unpaired == as plain text', () => {
    render(<MarkdownNotesRenderer {...baseProps} notes="check a == b vandaag" />);
    expect(screen.getByText('check a == b vandaag')).toBeInTheDocument();
    expect(document.querySelector('mark')).toBeNull();
  });
});
