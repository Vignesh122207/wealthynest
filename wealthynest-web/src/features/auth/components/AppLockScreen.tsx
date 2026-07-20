"use client";

import {useState} from "react";
import {Fingerprint, KeyRound, Loader2} from "lucide-react";
import {toast} from "sonner";
import {useAuthStore} from "../store/auth.store";
import {useAppLockStore} from "../store/appLock.store";
import {usePasskeys, useLogout, useUnlockWithPasskey, useUnlockWithPin} from "../hooks/useAuth";
import {useNativeBiometricStatus} from "../hooks/useNativeBiometric";
import {BiometryErrorType, isBiometryError, retrievePinViaBiometric} from "../utils/nativeBiometric";
import {isWebAuthnSupported} from "../utils/webauthn";
import {BrandMark} from "@/components/icons/BrandMark";

// Gated to PIN/passkey users only (see useAppLockTrigger) — a password-only account never sees
// this, since forcing a full password retype on every tab-switch would be worse UX for no real
// security gain over today's behavior. The session underneath stays fully valid the whole time;
// this only blocks the UI until PIN/passkey clears it, mirroring how a banking app's Face ID
// relock works — not a logout, just a local re-proof.
export function AppLockScreen() {
  const { user, refreshToken } = useAuthStore();
  const unlock = useAppLockStore((s) => s.unlock);
  const [pin, setPin] = useState("");

  const { mutate: unlockWithPin, isPending: pinPending } = useUnlockWithPin();
  const { mutate: unlockWithPasskey, isPending: passkeyPending } = useUnlockWithPasskey();
  const { mutate: logout, isPending: loggingOut } = useLogout();
  const { data: passkeys } = usePasskeys();
  const { data: nativeBiometric } = useNativeBiometricStatus();
  const [biometricPending, setBiometricPending] = useState(false);

  if (!user) return null;

  // Same "what does this account actually have" check useAppLockTrigger uses to decide whether to
  // arm at all — mirrored here so the screen only offers a method the user really configured,
  // instead of always showing a PIN box that fails for passkey-only accounts (and vice versa, a
  // passkey button gated purely on browser support with zero registered credentials behind it).
  const pinAvailable = user.pinEnabled;
  const passkeyAvailable = isWebAuthnSupported() && (passkeys?.length ?? 0) > 0;
  const biometricAvailable = pinAvailable && !!nativeBiometric?.available && !!nativeBiometric?.pinStored;

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refreshToken || pin.length < 4) return;
    unlockWithPin({ refreshToken, pin }, { onSuccess: () => { unlock(); setPin(""); } });
  };

  const handlePasskeyUnlock = () => {
    unlockWithPasskey(false, { onSuccess: unlock });
  };

  // Biometric success only proves "this device" — the retrieved PIN still goes through the same
  // server-verified unlock a typed PIN would, so an out-of-sync/stale stored PIN just fails there
  // with the usual "Incorrect PIN" toast rather than silently admitting anyone.
  const handleBiometricUnlock = async () => {
    if (!refreshToken) return;
    setBiometricPending(true);
    try {
      const storedPin = await retrievePinViaBiometric();
      unlockWithPin({ refreshToken, pin: storedPin }, { onSuccess: unlock, onSettled: () => setBiometricPending(false) });
    } catch (e) {
      setBiometricPending(false);
      if (isBiometryError(e) && (e.code === BiometryErrorType.userCancel || e.code === BiometryErrorType.appCancel)) return; // cancelled — silent
      toast.error("Fingerprint unlock failed");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unlock WealthyNest"
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl"
    >
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="flex flex-col items-center mb-7 text-center">
          <BrandMark boxClassName="w-12 h-12 mb-4" iconClassName="w-7 h-7" />
          <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back, {user.fullName.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm">Unlock to continue where you left off</p>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/40 p-6 space-y-4">
          {pinAvailable && (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                data-testid="applock-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                autoComplete="off"
                aria-label="PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="••••"
                className="w-full h-14 px-4 rounded-xl text-center text-2xl tracking-[0.5em] outline-none transition-all
                  bg-background border border-border text-foreground placeholder:text-muted-foreground
                  focus:border-[#c2703d] focus:ring-2 focus:ring-[#c2703d]/25"
              />
              <button
                data-testid="applock-pin-submit"
                type="submit"
                disabled={pinPending || pin.length < 4}
                className="w-full h-11 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                  bg-[#a85f30] hover:bg-[#c2703d] text-white shadow-lg shadow-[#c2703d]/30
                  hover:shadow-xl hover:shadow-[#c2703d]/40 hover:-translate-y-0.5
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {pinPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {pinPending ? "Verifying…" : "Unlock"}
              </button>
            </form>
          )}

          {passkeyAvailable && (
            <button
              data-testid="applock-passkey-button"
              type="button"
              onClick={handlePasskeyUnlock}
              disabled={passkeyPending}
              className="w-full h-11 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2
                bg-muted hover:bg-muted/80 text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {passkeyPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
              {passkeyPending ? "Follow your device's prompt…" : "Unlock with a passkey"}
            </button>
          )}

          {biometricAvailable && (
            <button
              data-testid="applock-biometric-button"
              type="button"
              onClick={handleBiometricUnlock}
              disabled={biometricPending}
              className="w-full h-11 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2
                bg-muted hover:bg-muted/80 text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {biometricPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
              {biometricPending ? "Follow your device's prompt…" : "Unlock with fingerprint"}
            </button>
          )}
        </div>

        <button
          data-testid="applock-sign-out"
          onClick={() => logout()}
          disabled={loggingOut}
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
        >
          Not you? Sign out
        </button>
      </div>
    </div>
  );
}
