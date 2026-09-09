const PREFIX = "glsc-atlas:";

/** The app was called Soma Atlas before. Anything it saved lives under this. */
const LEGACY_PREFIX = "soma-atlas:";

/**
 * Carry saved state across the rename.
 *
 * Without this the rename would silently look like data loss: a student's
 * pasted Groq key, their bookmarks and their theme all live in localStorage
 * under the old prefix. Runs once, on first import.
 */
function migrateLegacyKeys() {
  if (typeof window === "undefined") return;
  try {
    const store = window.localStorage;

    // Collect first. Writing to localStorage while walking it by index
    // renumbers the remaining keys, which silently skipped entries.
    const legacy: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(LEGACY_PREFIX)) legacy.push(key);
    }

    for (const key of legacy) {
      const suffix = key.slice(LEGACY_PREFIX.length);
      const value = store.getItem(key);
      // Never overwrite something already saved under the new name.
      if (value !== null && store.getItem(PREFIX + suffix) === null) {
        store.setItem(PREFIX + suffix, value);
      }
      store.removeItem(key);
    }
  } catch {
    /* private mode, quota, or storage disabled */
  }
}

migrateLegacyKeys();

export function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota or private mode */
  }
}

export function removeLocal(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* private mode */
  }
}
