import {create} from "zustand";

const HIDDEN_AT_STORAGE_KEY = "wealthynest:applock:hiddenAt";

/** When the tab/app last went to background, in a form that survives the JS context dying —
 * unlike useAppLockTrigger's own in-memory ref, and unlike isLocked below. Two real bugs share
 * this one root cause: (1) fully closing the tab/app and reopening it left nothing to compare
 * "how long were we gone" against, so the lock never fired on a cold start; (2) since isLocked
 * itself isn't persisted, a plain browser refresh *while already locked* silently cleared the
 * lock and let the user straight back in. Both are fixed by re-deriving the lock decision from
 * this on every mount, not just from the one-time backgrounding event that caused it. */
export function readPersistedHiddenAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(HIDDEN_AT_STORAGE_KEY);
  return raw ? Number(raw) : null;
}

export function writePersistedHiddenAt(value: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HIDDEN_AT_STORAGE_KEY, String(value));
}

export function clearPersistedHiddenAt(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HIDDEN_AT_STORAGE_KEY);
}

/** Whether the dashboard is currently gated behind the lock screen. Deliberately NOT persisted —
 * same reasoning as vaultTrust.store: a page reload already re-mounts the whole app fresh, so
 * there's nothing to carry over, and persisting this would risk it surviving in a stale, wrong
 * state across tabs. The underlying JWT/refresh-token session is untouched by this — this is a
 * pure UI gate, not a logout. See useAppLockTrigger for what sets isLocked=true — including
 * re-deriving it from readPersistedHiddenAt on a fresh mount. */
interface AppLockState {
  isLocked: boolean;
  lock:   () => void;
  unlock: () => void;
}

export const useAppLockStore = create<AppLockState>((set) => ({
  isLocked: false,
  lock:   () => set({ isLocked: true }),
  // Only a real unlock clears the persisted marker — a mount that finds it still stale (e.g. a
  // refresh while the lock screen is up, before the user has actually unlocked) must keep
  // re-locking, not just once.
  unlock: () => { clearPersistedHiddenAt(); set({ isLocked: false }); },
}));
