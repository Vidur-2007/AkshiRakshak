/**
 * localStorage that never throws (private mode, blocked storage, quota).
 * Falls back to an in-memory map so the app keeps working for the session.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createSafeStorage(getBacking: () => Storage | undefined): KeyValueStorage {
  const memory = new Map<string, string>();
  const backing = (): Storage | undefined => {
    try {
      return getBacking();
    } catch {
      return undefined;
    }
  };
  return {
    getItem(key) {
      try {
        const s = backing();
        if (s) return s.getItem(key);
      } catch {
        /* fall through */
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
      try {
        backing()?.setItem(key, value);
      } catch {
        /* memory copy is enough */
      }
    },
    removeItem(key) {
      memory.delete(key);
      try {
        backing()?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export const safeLocalStorage: KeyValueStorage = createSafeStorage(() =>
  typeof window === 'undefined' ? undefined : window.localStorage,
);

/** Clears every key in localStorage; used by "Delete everything". */
export function clearLocalStorage(): void {
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
}
