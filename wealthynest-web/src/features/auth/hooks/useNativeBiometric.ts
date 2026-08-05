"use client";
import {useEffect, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {
  BiometryErrorType,
  disableBiometricUnlock,
  enableBiometricUnlock,
  isBiometricHardwareAvailable,
  isBiometricUnlockEnabled,
  isBiometryError,
  isNativePlatform,
} from "../utils/nativeBiometric";
import {isWebAuthnSupported} from "../utils/webauthn";
import {markBiometricPromptEnded, markBiometricPromptStarting} from "../store/appLock.store";
import {usePasskeys, useRegisterPasskey} from "./useAuth";

const NATIVE_BIOMETRIC_QUERY_KEY = ["auth", "nativeBiometric"];

/** Starts `false` on every render until a client-side effect resolves the real platform, same
 * SSR/first-paint safety reasoning as useWebAuthnSupport — a synchronous check here would render
 * differently on the server (no window.Capacitor) than on a native client's first paint, which
 * React would flag as a hydration mismatch. Used to hide the passkey option on native (see
 * settings/security/page.tsx and AppLockScreen — passkeys are the web/desktop biometric option;
 * native gets the bare fingerprint toggle below instead, not both). */
export function useIsNativePlatform(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => { setNative(isNativePlatform()); }, []);
  return native;
}

/** Whether this device can offer bare fingerprint app-lock right now: running inside the native
 * shell, with enrolled biometrics, and the user has turned it on. */
export function useNativeBiometricStatus() {
  return useQuery({
    queryKey: NATIVE_BIOMETRIC_QUERY_KEY,
    queryFn: async () => {
      if (!isNativePlatform()) return { available: false, enabled: false };
      const [available, enabled] = await Promise.all([isBiometricHardwareAvailable(), isBiometricUnlockEnabled()]);
      return { available, enabled };
    },
    // Default staleTime (0) meant every single AppLockScreen mount — i.e. every time the app
    // re-locks — re-ran both native plugin calls (a BiometricManager check plus a Keystore-backed
    // SecureStoragePlugin read) before the fingerprint option could even appear, which is what
    // made it feel slow to "arrive" next to the PIN form. Neither underlying value can change
    // except through the two mutations below, which already invalidate this key explicitly on
    // success — so there's no external event a background refetch could ever catch that those
    // don't already cover. Safe to treat as never-stale and let useAppLockTrigger's warm call
    // (mounted well before any lock ever fires) be the only real fetch of the session.
    staleTime: Infinity,
  });
}

/** Enabling local fingerprint app-lock also provisions the real WebAuthn credential Vault
 * reveal/export requires (VaultServiceImpl's own class comment explains why the bare check above
 * can't stand in for it — it proves nothing to the server). Without this, "Fingerprint & face
 * unlock" would arm app-lock but silently leave Vault fingerprint unlock demanding a second,
 * separate "enable passkey" tap for the exact same sensor a moment later — the redundant setup
 * flow this replaces. Best-effort and silent: skipped when a passkey already exists or this device
 * can't run a passkey ceremony, and a declined/failed ceremony still leaves local biometric app-lock
 * enabled (SecurityPage's passkey row offers a manual retry either way).
 *
 * markBiometricPromptStarting/Ended brackets the passkey step too, not just enableBiometricUnlock's
 * own internal ceremony — see that function's own comment for the underlying bug this pattern
 * fixes. Android's Credential Manager sheet pauses the hosting Activity exactly like BiometricPrompt
 * does, and useNativeBiometricStatus only gets invalidated (flipping `armed` false→true for a user
 * with no other unlock method yet) after this WHOLE mutationFn resolves — i.e. after both ceremonies
 * — so enableBiometricUnlock's own 1.5s grace tail would already have expired by the time
 * useAppLockTrigger's effect mounts and does its zero-grace check. Without re-marking the ceremony
 * active around the passkey step too, that mount-time check would see the Credential Manager
 * sheet's own pause as a real backgrounding and lock immediately — popping the lock screen (and its
 * own auto-firing fingerprint prompt) right in the middle of this setup flow. */
export function useEnableBiometricUnlock() {
  const qc = useQueryClient();
  const { data: passkeys } = usePasskeys();
  const { mutateAsync: registerPasskey } = useRegisterPasskey();
  return useMutation({
    mutationFn: async () => {
      await enableBiometricUnlock();
      if (!passkeys?.length && await isWebAuthnSupported()) {
        markBiometricPromptStarting();
        try {
          await registerPasskey("This device"); // useRegisterPasskey already toasts its own failure
        } catch {
          // swallow — local biometric app-lock is already enabled either way; see this function's own comment
        } finally {
          markBiometricPromptEnded();
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NATIVE_BIOMETRIC_QUERY_KEY }),
    onError: (e: unknown) => {
      if (isBiometryError(e) && e.code === BiometryErrorType.userCancel) return; // user cancelled — silent
      toast.error("Couldn't enable fingerprint unlock");
    },
  });
}

export function useDisableBiometricUnlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: disableBiometricUnlock,
    onSuccess: () => qc.invalidateQueries({ queryKey: NATIVE_BIOMETRIC_QUERY_KEY }),
    // The toggle in NativeBiometricRow is driven by useNativeBiometricStatus's own query data, not
    // local state, so a failure here can't leave the switch showing the wrong position — but
    // without this, the user still got zero feedback that flipping it did nothing.
    onError: () => toast.error("Couldn't disable fingerprint unlock"),
  });
}
