import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL auto-cleanup needs vitest globals; we don't use them, so register manually
afterEach(() => cleanup());

// Node 22+ ships a native `globalThis.localStorage` getter that returns
// `undefined` unless --localstorage-file is set, shadowing the working Storage
// of vitest's jsdom environment. Re-point it at jsdom's real Storage (fallback:
// a minimal in-memory mock) so store code that calls persist() works under test.
if (!globalThis.localStorage) {
  const dom = (globalThis as unknown as { jsdom?: { window: { localStorage: Storage } } }).jsdom;
  if (dom?.window.localStorage) {
    Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true });
  } else {
    const store: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      get length() { return Object.keys(store).length; },
      key: (index: number) => Object.keys(store)[index] ?? null,
    } as Storage;
  }
}

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
