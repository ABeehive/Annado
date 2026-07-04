import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { WhenButton } from './WhenDatePicker';

describe('WhenButton placement', () => {
  it('opens the popover centered when placement="center"', () => {
    const { getByRole } = render(
      <WhenButton value="anytime" onChange={() => {}} placement="center" />
    );
    fireEvent.click(getByRole('button'));
    // The popover renders into document.body via a portal.
    const popover = document.body.querySelector('[data-picker-popover]') as HTMLElement;
    expect(popover).not.toBeNull();
    expect(popover.style.left).toBe('50%');
    expect(popover.style.transform).toContain('translate(-50%');
  });

  it('passes a calendar-picked date through onChange as a WhenValue', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <WhenButton value="anytime" onChange={onChange} placement="center" />
    );
    fireEvent.click(getByRole('button'));
    // First show the calendar by clicking the "Show calendar" button
    const showCalendarButton = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Show calendar'));
    expect(showCalendarButton).toBeDefined();
    fireEvent.click(showCalendarButton!);
    // Click a concrete calendar day (day buttons render their day number).
    const dayButton = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent === '15');
    expect(dayButton).toBeDefined();
    fireEvent.click(dayButton!);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
    );
  });
});

describe('WhenButton includeInbox', () => {
  it('renders no "Inbox" chip when includeInbox is not set', () => {
    const { getByRole } = render(
      <WhenButton value="anytime" onChange={() => {}} placement="center" />
    );
    fireEvent.click(getByRole('button'));
    const inboxChip = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Inbox'));
    expect(inboxChip).toBeUndefined();
  });

  it('calls onChange with "inbox" when the Inbox chip is clicked with includeInbox', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <WhenButton value="anytime" onChange={onChange} placement="center" includeInbox />
    );
    fireEvent.click(getByRole('button'));
    const inboxChip = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Inbox'));
    expect(inboxChip).toBeDefined();
    fireEvent.click(inboxChip!);
    expect(onChange).toHaveBeenCalledWith('inbox');
  });
});

describe('WhenButton variant', () => {
  it('uses dark toolbar chrome with variant="toolbar" and light chrome by default', () => {
    const { getByRole, unmount } = render(
      <WhenButton value="anytime" onChange={() => {}} variant="toolbar" />
    );
    expect(getByRole('button').className).toContain('bg-[#333]');
    unmount();

    const { getByRole: getDefault } = render(<WhenButton value="anytime" onChange={() => {}} />);
    expect(getDefault('button').className).toContain('bg-white');
  });
});
