import {create} from "zustand";

const IDLE_LIMIT_MS = 2 * 60_000;

/** "Trust this device" for vault reveals (Phase 5, opt-in, default off). Deliberately NOT
 * persisted (no zustand/middleware persist) — a page refresh must already clear it, since this
 * trades away the reveal step-up's security benefit and must never survive beyond the current
 * tab session. Read across RevealSecretModal, VaultItemRow's reveal action, and ExportVaultModal. */
interface VaultTrustState {
  token: string | null;
  expiresAt: number | null;
  lastActivityAt: number | null;
  trust: (token: string, ttlMinutes: number) => void;
  recordActivity: () => void;
  clear: () => void;
  isTrusted: () => boolean;
}

export const useVaultTrustStore = create<VaultTrustState>((set, get) => ({
  token: null,
  expiresAt: null,
  lastActivityAt: null,

  trust: (token, ttlMinutes) => {
    const now = Date.now();
    set({ token, expiresAt: now + ttlMinutes * 60_000, lastActivityAt: now });
  },

  recordActivity: () => {
    if (get().token) set({ lastActivityAt: Date.now() });
  },

  clear: () => set({ token: null, expiresAt: null, lastActivityAt: null }),

  isTrusted: () => {
    const { token, expiresAt, lastActivityAt } = get();
    if (!token || !expiresAt || !lastActivityAt) return false;
    const now = Date.now();
    if (now >= expiresAt || now - lastActivityAt >= IDLE_LIMIT_MS) {
      set({ token: null, expiresAt: null, lastActivityAt: null });
      return false;
    }
    return true;
  },
}));
