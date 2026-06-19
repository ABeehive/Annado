import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
  it('portals an overlay marked [data-picker-portal] into document.body', () => {
    // The marker is load-bearing: the expanded task card collapses on any
    // mousedown outside its own DOM, and exempts [data-picker-portal]. Without
    // it, clicking this portaled dialog collapses the card and unmounts the
    // dialog before the confirm click can fire (the expanded-view delete bug).
    render(<ConfirmModal open message="Delete this task?" onConfirm={() => {}} onCancel={() => {}} />);
    const overlay = document.querySelector('[data-picker-portal]');
    expect(overlay).not.toBeNull();
    expect(document.body.contains(overlay)).toBe(true);
  });

  it('fires onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal open message="Delete this task?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={() => {}} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    render(<ConfirmModal open={false} message="x" onConfirm={() => {}} onCancel={() => {}} />);
    expect(document.querySelector('[data-picker-portal]')).toBeNull();
  });
});
