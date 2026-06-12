export function persist(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Sets error on store state, then re-throws. Return type `never` tells TypeScript
// that execution stops here — callers don't need a `return` after a catch block.
// The `never` parameter type accepts any store's set() without a cast at the
// call site; the one controlled cast lives here.
export function storeError(set: (partial: never) => void, error: unknown, extra: Record<string, unknown> = {}): never {
  (set as (partial: Record<string, unknown>) => void)({ error: String(error), ...extra });
  throw error;
}
