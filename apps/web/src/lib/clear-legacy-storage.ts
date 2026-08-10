const LEGACY_KEYS = [
  "aii-a2a-v4",
  "aii-a2a-v5",
  "aii-a2a-v6",
  "aii-ui",
];

/**
 * Removes obsolete Zustand persist keys that previously held business data
 * in localStorage. Safe to call on every app boot.
 */
export function clearLegacyLocalStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore quota / privacy mode errors
    }
  }
}
