import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL auto-cleanup needs vitest globals; we don't use them, so register manually
afterEach(() => cleanup());

// jsdom has no ResizeObserver; components that observe element size (e.g. the
// collapsed task row's delete-button placement) need a no-op stub under test.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
    ResizeObserverStub;
}
