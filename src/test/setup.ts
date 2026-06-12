import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL auto-cleanup needs vitest globals; we don't use them, so register manually
afterEach(() => cleanup());
