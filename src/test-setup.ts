// SPDX-License-Identifier: AGPL-3.0-or-later
import '@testing-library/jest-dom/vitest';

// jsdom (Vitest 3) sometimes ships without a usable localStorage when
// `--localstorage-file` is not supplied; provide a minimal in-memory
// polyfill so stores that read on module-init don't blow up at import.
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
  const mem = new Map<string, string>();
  const storage: Storage = {
    get length() { return mem.size; },
    clear: () => mem.clear(),
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    key: (i: number) => Array.from(mem.keys())[i] ?? null,
    removeItem: (k: string) => { mem.delete(k); },
    setItem: (k: string, v: string) => { mem.set(k, String(v)); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}

export {};
