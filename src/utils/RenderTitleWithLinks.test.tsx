import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RenderTitleWithLinks } from './RenderTitleWithLinks';
import { useTaskStore } from '../stores/taskStore';

vi.mock('@tauri-apps/plugin-opener', () => ({
  // Real openUrl returns Promise<void>; the source calls .catch() on it, so the
  // mock must resolve a promise (a bare vi.fn() returns undefined → unhandled
  // ".catch of undefined" rejection that fails the run).
  openUrl: vi.fn().mockResolvedValue(undefined),
}));
import { openUrl } from '@tauri-apps/plugin-opener';

const baseProps = {
  personNames: new Set(['Lena Hartmann']),
  projectNames: new Set(['Brand Refresh']),
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

describe('bare URL autolinking', () => {
  it('renders bare URLs as links only when autolinkUrls is set', () => {
    const { rerender } = render(
      <RenderTitleWithLinks {...baseProps} title="see https://example.com today" />
    );
    expect(screen.queryByRole('button', { name: 'https://example.com' })).toBeNull();

    rerender(
      <RenderTitleWithLinks {...baseProps} title="see https://example.com today" autolinkUrls />
    );
    const link = screen.getByRole('button', { name: 'https://example.com' });
    fireEvent.click(link);
    expect(openUrl).toHaveBeenCalledWith('https://example.com');
  });

  it('excludes trailing punctuation from the link', () => {
    render(<RenderTitleWithLinks {...baseProps} title="go to https://example.com/a." autolinkUrls />);
    fireEvent.click(screen.getByRole('button', { name: 'https://example.com/a' }));
    expect(openUrl).toHaveBeenCalledWith('https://example.com/a');
  });
});

describe('unknown wikilinks in notes mode', () => {
  it('opens the note in Obsidian when openUnknownWikilinks is set', () => {
    render(<RenderTitleWithLinks {...baseProps} title="check [[Some Note]]" openUnknownWikilinks />);
    fireEvent.click(screen.getByRole('button', { name: /Some Note/ }));
    expect(openUrl).toHaveBeenCalledWith('obsidian://open?vault=Vault&file=Some%20Note');
  });

  it('keeps the create menu reachable via right-click', () => {
    const onUnknownLinkClick = vi.fn();
    render(
      <RenderTitleWithLinks
        {...baseProps}
        title="check [[Some Note]]"
        openUnknownWikilinks
        onUnknownLinkClick={onUnknownLinkClick}
      />
    );
    fireEvent.contextMenu(screen.getByRole('button', { name: /Some Note/ }));
    expect(onUnknownLinkClick).toHaveBeenCalledWith('Some Note', expect.any(Number), expect.any(Number));
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('does not affect known person/project wikilinks', () => {
    render(
      <RenderTitleWithLinks
        {...baseProps}
        title="[[Lena Hartmann]] and [[Brand Refresh]]"
        openUnknownWikilinks
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Lena Hartmann/ }));
    expect(baseProps.onPersonClick).toHaveBeenCalledWith('Lena Hartmann');
    fireEvent.click(screen.getByRole('button', { name: /Brand Refresh/ }));
    expect(baseProps.onProjectClick).toHaveBeenCalledWith('Brand Refresh');
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('falls back to plain text without the flag and without a click handler', () => {
    render(<RenderTitleWithLinks {...baseProps} title="check [[Some Note]]" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Some Note/)).toBeInTheDocument();
  });
});
