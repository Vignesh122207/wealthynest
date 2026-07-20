import {create} from "zustand";

/** Whether the dashboard is currently gated behind the lock screen. Deliberately NOT persisted —
 * same reasoning as vaultTrust.store: a page reload already re-mounts the whole app fresh, so
 * there's nothing to carry over, and persisting this would risk it surviving in a stale, wrong
 * state across tabs. The underlying JWT/refresh-token session is untouched by this — this is a
 * pure UI gate, not a logout. See useAppLockTrigger for what sets isLocked=true. */
interface AppLockState {
  isLocked: boolean;
  lock:   () => void;
  unlock: () => void;
}

export const useAppLockStore = create<AppLockState>((set) => ({
  isLocked: false,
  lock:   () => set({ isLocked: true }),
  unlock: () => set({ isLocked: false }),
}));
