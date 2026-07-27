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

const PASSKEY_DISMISSED_STORAGE_KEY = "wealthynest:applock:passkeyDismissed";

/** Per-device, not per-account: passkeys are listed account-wide (registered on any device), but
 * WebAuthn gives no API to ask "does *this* browser already have one of them" without attempting
 * the real ceremony — so a device with platform-authenticator hardware but no locally enrolled
 * credential for this account still shows the button as if it would work. Rather than guess, this
 * remembers a manual "don't show this on this device again" the user reaches for once they've
 * actually seen it fail here — see AppLockScreen's own dismiss link. Deliberately local, not
 * synced to the account: the whole point is that availability differs device to device. */
export function readPasskeyDismissedOnDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PASSKEY_DISMISSED_STORAGE_KEY) === "true";
}

export function writePasskeyDismissedOnDevice(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PASSKEY_DISMISSED_STORAGE_KEY, "true");
}

/** Registering a passkey from this browser proves it now has a real, working credential store —
 * whatever "doesn't work here" was recorded before is stale the moment that succeeds, so
 * useRegisterPasskey's onSuccess clears it automatically instead of leaving the app-lock button
 * hidden with no way back short of clearing site data. */
export function clearPasskeyDismissedOnDevice(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PASSKEY_DISMISSED_STORAGE_KEY);
}

// In-memory only (module-level, not persisted or in the store) — this only ever needs to survive
// a single synchronous ceremony within one already-running JS context, never a reload/process
// restart the way the hidden-at marker above does.
let biometricPromptActiveUntilMs = 0;

/** Marks a native BiometricPrompt (or WebAuthn) ceremony as starting — see isBiometricPromptActive
 * for why this exists. Called right before invoking the platform biometric API. */
export function markBiometricPromptStarting(): void {
  biometricPromptActiveUntilMs = Infinity;
}

/** Marks a just-finished ceremony, active for a further grace window (not immediately false) —
 * see isBiometricPromptActive for why. Called in a `.finally()` after the platform biometric call
 * settles, success or failure. */
export function markBiometricPromptEnded(): void {
  biometricPromptActiveUntilMs = Date.now() + 1500;
}

/** True while a biometric/passkey ceremony we ourselves triggered is in flight, or just finished
 * within the last ~1.5s. Real bug this fixes: showing the native BiometricPrompt pauses the
 * hosting Activity (it's system UI taking focus, the same as any dialog would), so Capacitor's
 * `pause`→`resume` bridge fires around our OWN fingerprint prompt, not just around the user
 * actually leaving the app. Combined with useAppLockTrigger's zero-grace policy, that pause/resume
 * blip alone was enough to re-lock the instant the prompt succeeded — re-triggering the very same
 * auto-firing prompt on the newly-shown lock screen, forever. The 1.5s tail after the ceremony
 * ends covers the resume event landing a beat after the plugin's own promise settles, which is the
 * more common ordering in practice — without it, a resume arriving just after `.finally()` would
 * still slip through and re-lock. */
export function isBiometricPromptActive(): boolean {
  return Date.now() < biometricPromptActiveUntilMs;
}

/** Test-only escape hatch: forces the flag off immediately, with no time math. The 1.5s tail above
 * is an absolute timestamp computed from whichever clock (real or a test's faked one) was active
 * when it was set — advancing fake timers past it and then switching back to real timers doesn't
 * reliably clear it (real Date.now() may still read earlier than that stored value), so tests need
 * a direct, deterministic reset rather than trying to "wait it out". */
export function __resetBiometricPromptStateForTests(): void {
  biometricPromptActiveUntilMs = 0;
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
