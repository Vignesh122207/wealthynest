import "@testing-library/jest-dom/vitest";

// Node 22+'s own built-in (flag-gated, disabled-by-default) global `localStorage` shadows
// jsdom's window.localStorage in this environment, leaving it undefined. A minimal in-memory
// Storage polyfill sidesteps the version-specific quirk entirely.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", { value: new MemoryStorage(), configurable: true });
}
