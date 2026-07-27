"use client";

import {useEffect, useRef, useState} from "react";
import {AlertCircle, Fingerprint, KeyRound, Loader2, LogIn} from "lucide-react";
import {toast} from "sonner";
import {useAuthStore} from "../store/auth.store";
import {markBiometricPromptEnded, markBiometricPromptStarting, readPasskeyDismissedOnDevice, useAppLockStore, writePasskeyDismissedOnDevice} from "../store/appLock.store";
import {usePasskeys, useLogout, useUnlockWithPasskey, useUnlockWithPin} from "../hooks/useAuth";
import {useWebAuthnSupport} from "../hooks/useWebAuthnSupport";
import {useIsNativePlatform, useNativeBiometricStatus} from "../hooks/useNativeBiometric";
import {BiometryErrorType, isBiometryError, verifyBiometric} from "../utils/nativeBiometric";
import {deriveLockoutState, type LockoutState} from "../utils/lockout";
import {LockoutBanner} from "./LockoutBanner";
import {BrandMark} from "@/components/icons/BrandMark";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {cn} from "@/lib/utils";

// Matches settings/security/page.tsx's pinSchema (`z.string().regex(/^[0-9]{4}$/)`) — every PIN
// created there is now fixed at 4 digits, so the cell row can render a fixed count and auto-submit
// the moment the 4th digit lands, instead of waiting on a manual "Unlock" tap. (A PIN set up before
// that change could still be 5-6 digits server-side, but this screen no longer has a way to type
// past 4 — see settings/security's own comment for why that tradeoff was accepted.)
const PIN_LENGTH = 4;

// Shared between the full card's inline PIN section and the minimal native PIN-fallback screen
// below — same cell treatment (filled/active/error, shake on mismatch), just two places to mount
// it now instead of one.
function PinCells({ pin, pinError }: { pin: string; pinError: boolean }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 pointer-events-none", pinError && "animate-shake")}>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => {
        const filled = i < pin.length;
        const active = i === pin.length;
        return (
          <div key={i} data-testid="applock-pin-cell" className={cn(
            "w-full max-w-11 h-[52px] rounded-[13px] border-[1.5px] flex items-center justify-center transition-all",
            pinError ? "border-red-500 bg-red-500/10"
              : filled ? "border-brand-500 bg-card"
              : active ? "border-brand-300 ring-[3px] ring-brand-500/20"
              : "bg-muted/40 border-border"
          )}>
            {filled && (
              <span className={cn("w-2.5 h-2.5 rounded-full", pinError ? "bg-red-500" : "bg-brand-500")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Gated to PIN/fingerprint users only (see useAppLockTrigger) — a password-only account never
// sees this, since forcing a full password retype on every tab-switch would be worse UX for no
// real security gain over today's behavior. The session underneath stays fully valid the whole
// time; this only blocks the UI until PIN/fingerprint clears it, mirroring how a banking app's
// Face ID relock works — not a logout, just a local re-proof.
//
// Two independent unlock methods, split by platform: PIN (typed, both platforms) and fingerprint
// — on native, a bare BiometricPrompt check with nothing stored behind it (see nativeBiometric.ts
// for why a local re-proof doesn't need a server-verifiable credential); on web/desktop, a passkey
// (WebAuthn) plays the same "standalone fingerprint/face" role, since native's plain BiometricPrompt
// API doesn't exist there. Never both on the same platform — see settings/security/page.tsx for
// the matching setup UI split.
export function AppLockScreen() {
  const { user } = useAuthStore();
  const unlock = useAppLockStore((s) => s.unlock);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [lockout, setLockout] = useState<LockoutState | null>(null);
  const [biometricPending, setBiometricPending] = useState(false);
  // Starts false on every render, same SSR/first-paint-safety reasoning as the hydrated flags
  // elsewhere in this feature — localStorage isn't available server-side, and a synchronous read
  // here would render differently than the client's first real paint.
  const [passkeyDismissed, setPasskeyDismissed] = useState(false);
  const [passkeyFailed, setPasskeyFailed] = useState(false);
  useEffect(() => { setPasskeyDismissed(readPasskeyDismissedOnDevice()); }, []);
  // Native fingerprint only (see the minimal-screen branch below) — starts on the fingerprint
  // face since that's the one that auto-fires; "Enter PIN instead" is an explicit opt-in, not a
  // form that's just sitting there unused the way the full card's always-visible PIN section is.
  const [nativeMode, setNativeMode] = useState<"biometric" | "pin">("biometric");
  // "Sign out & use password" is really "sign out, then log back in with a password" — logout()
  // has no undo (refresh token is revoked server-side the instant it's called, see useLogout). The
  // label says "sign out" up front so it's not a surprise once the confirm dialog below explains
  // the consequence. This is now the single sign-out path off this screen — there used to be a
  // second, ungated "Not you? Sign out" link, but it did the exact same thing under different
  // wording, so it was removed rather than kept as a redundant shortcut.
  const [confirmUsePassword, setConfirmUsePassword] = useState(false);

  const { mutate: unlockWithPin, isPending: pinPending } = useUnlockWithPin();
  const { mutate: unlockWithPasskey, isPending: passkeyPending } = useUnlockWithPasskey();
  const { mutate: logout, isPending: loggingOut } = useLogout();
  const { data: passkeys } = usePasskeys();
  const webAuthnSupported = useWebAuthnSupport();
  const isNative = useIsNativePlatform();
  const { data: nativeBiometric } = useNativeBiometricStatus();

  // Same "what does this account actually have" check useAppLockTrigger uses to decide whether to
  // arm at all — mirrored here so the screen only offers a method the user really configured,
  // instead of always showing a PIN box that fails for passkey-only accounts (and vice versa, a
  // fingerprint button gated purely on capability with nothing behind it). Uses `user?.` (not the
  // `!user` guard below) because these, and the hooks that follow, must stay above that guard — an
  // early return before a hook call is only safe when it can never execute after that hook has
  // already run once, and `logout()` flips `user` to null on an already-mounted instance of this
  // component, which would otherwise change the hook count between renders.
  const pinAvailable = !!user?.pinEnabled;
  // passkeys is the ACCOUNT's server-side credential list (true the moment ANY device has ever
  // registered one), not this device's — WebAuthn has no API to check "is one of these actually
  // enrolled in this browser's platform authenticator" without attempting the real ceremony, so a
  // Touch ID/Windows Hello-capable device with no locally matching passkey still passes this
  // check and only finds out on a real attempt (see the dismiss link below for the fallback once
  // it does).
  const passkeyAvailable = !isNative && webAuthnSupported && (passkeys?.length ?? 0) > 0 && !passkeyDismissed;
  const nativeBiometricAvailable = isNative && !!nativeBiometric?.available && !!nativeBiometric?.enabled;
  const fingerprintAvailable = passkeyAvailable || nativeBiometricAvailable;

  const handleFingerprintUnlock = () => {
    if (nativeBiometricAvailable) {
      setBiometricPending(true);
      // See appLock.store's own comment: showing the native BiometricPrompt pauses the hosting
      // Activity, so useAppLockTrigger's pause/resume bridge needs to know this particular
      // pause/resume is our own ceremony, not the user actually leaving the app — otherwise a
      // successful unlock immediately re-locked and re-fired this same auto-triggering prompt.
      markBiometricPromptStarting();
      verifyBiometric()
        .then(unlock)
        .catch((e: unknown) => {
          if (isBiometryError(e) && (e.code === BiometryErrorType.userCancel || e.code === BiometryErrorType.appCancel)) return; // cancelled — silent
          toast.error("Fingerprint unlock failed");
        })
        .finally(() => {
          setBiometricPending(false);
          markBiometricPromptEnded();
        });
      return;
    }
    // Same reasoning as the native branch above — some browsers blur/hide the tab for the
    // WebAuthn platform-authenticator sheet too.
    markBiometricPromptStarting();
    unlockWithPasskey(false, {
      onSuccess: unlock,
      // Same lockout banner PIN gets — passkey unlock itself can't be rate-limited/locked, but the
      // shared /auth/webauthn/login/* endpoints still sit behind RateLimitFilter. Also surfaces the
      // dismiss link below — WebAuthn can't distinguish "no matching passkey on this device" from
      // a plain user cancel (both throw the same NotAllowedError, by spec, so a picker can't leak
      // credential existence), so any failure here is treated the same: maybe it just didn't work
      // on this device, offer the opt-out.
      onError: (e) => { setLockout(deriveLockoutState(e)); setPasskeyFailed(true); },
      onSettled: () => markBiometricPromptEnded(),
    });
  };

  const dismissPasskeyOnDevice = () => {
    writePasskeyDismissedOnDevice();
    setPasskeyDismissed(true);
  };

  // Auto-fires ONLY the native bare-biometric check, never the passkey one — deliberately
  // asymmetric. Native biometric enablement is a per-device preference we set ourselves
  // (nativeBiometric.ts's stored flag), so "available" here really does mean "this device is
  // ready to go." Passkey availability, by contrast, is read from the account's server-side
  // credential list — true the moment ANY device has ever registered one, including devices that
  // never touched this one. Auto-*attempting* a WebAuthn ceremony still surfaces real system UI
  // (a picker, or "no passkey found") even when nothing local matches, so auto-firing it here
  // would pop that UI on every device tied to the account, not just the one it was set up on —
  // exactly the unsolicited "why is it asking me for a passkey I never set up here" experience
  // this is avoiding. Passkey stays available as the tappable button below instead — a deliberate
  // user action, never a surprise.
  const autoTriggeredRef = useRef(false);
  useEffect(() => {
    if (!user || !nativeBiometricAvailable || autoTriggeredRef.current) return;
    autoTriggeredRef.current = true;
    handleFingerprintUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, nativeBiometricAvailable]);

  const submitPin = () => {
    if (pin.length !== PIN_LENGTH) return;
    unlockWithPin(pin, {
      onSuccess: () => { unlock(); setPin(""); },
      // useUnlockWithPin's own onError already toasts the server message for anything that isn't
      // a lockout — this drives the cell row's red/shake state (local-only UI feedback the toast
      // can't express) plus the LockoutBanner for PIN_LOCKED/RATE_LIMIT_EXCEEDED specifically.
      onError: (e) => { setPinError(true); setPin(""); setLockout(deriveLockoutState(e)); },
    });
  };

  // Auto-submits the instant the 4th digit lands — a fixed 4-digit PIN doesn't need a "did you
  // mean to stop here?" confirmation step the way a variable-length one did. Guarded on
  // `!pinPending` so a slow request settling after the user has already backspaced/retried can't
  // double-fire; guarded on `user` (not just the early return below) because this runs every
  // render before that return, same reasoning as the fingerprint auto-trigger effect above.
  useEffect(() => {
    if (!user || pin.length !== PIN_LENGTH || pinPending) return;
    submitPin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, user]);

  if (!user) return null;

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPin();
  };

  const fingerprintPending = nativeBiometricAvailable ? biometricPending : passkeyPending;

  // GPay-style minimal re-entry screen — native fingerprint only. The passkey (web) path stays on
  // the full card below: it never auto-fires (see the effect's own comment on why), so a bare
  // "expecting a system prompt" screen would just sit there with nothing happening until tapped,
  // which doesn't read the same way a native BiometricPrompt landing on top of it does.
  if (nativeBiometricAvailable) {
    const backToBiometric = () => { setNativeMode("biometric"); setPin(""); setPinError(false); setLockout(null); };
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Unlock WealthyNest"
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-2 bg-background p-6"
        style={{paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)"}}
      >
        <BrandMark boxClassName="mb-8 w-16 h-16" iconClassName="w-11 h-11" roundedClassName="rounded-2xl" />

        {nativeMode === "biometric" ? (
          <>
            <button
              data-testid="applock-fingerprint-button"
              type="button"
              onClick={handleFingerprintUnlock}
              disabled={biometricPending}
              aria-label={biometricPending ? "Follow your device's prompt" : "Unlock with fingerprint"}
              className="w-24 h-24 rounded-full flex items-center justify-center transition-transform active:scale-95
                bg-gradient-to-br from-brand-600 to-brand-500 text-white
                shadow-[0_16px_36px_-12px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)]
                disabled:opacity-80"
            >
              {biometricPending
                ? <Loader2 className="w-9 h-9 animate-spin" />
                : <Fingerprint className="w-9 h-9 animate-pulse" />}
            </button>
            <p className="mt-5 text-sm text-muted-foreground text-center max-w-[220px]">
              {biometricPending ? "Follow your device's prompt…" : "Tap to unlock with fingerprint"}
            </p>
          </>
        ) : (
          <form onSubmit={handlePinSubmit} className="w-full max-w-[280px] space-y-3">
            {lockout && <LockoutBanner message={lockout.message} retryAt={lockout.retryAt} />}
            <p className="text-sm font-medium text-foreground text-center">Enter your PIN</p>
            <div className="relative h-[52px]">
              <input
                data-testid="applock-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={PIN_LENGTH}
                autoFocus
                autoComplete="off"
                aria-label="PIN"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/[^0-9]/g, ""));
                  if (pinError) setPinError(false);
                  if (lockout) setLockout(null);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-text"
              />
              <PinCells pin={pin} pinError={pinError} />
            </div>
            {pinError && (
              <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                <AlertCircle className="w-3.5 h-3.5" /> Incorrect PIN — try again
              </p>
            )}
            <button
              data-testid="applock-pin-submit"
              type="submit"
              disabled={pinPending || pin.length !== PIN_LENGTH}
              className="w-full h-11 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                bg-gradient-to-br from-brand-600 to-brand-500 text-white
                shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)]
                hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5
                disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {pinPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {pinPending ? "Verifying…" : "Unlock"}
            </button>
          </form>
        )}

        <div className="flex flex-col items-center gap-3 mt-8">
          {nativeMode === "biometric" && pinAvailable && (
            <button
              data-testid="applock-show-pin"
              type="button"
              onClick={() => setNativeMode("pin")}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" /> Enter PIN instead
            </button>
          )}
          {nativeMode === "pin" && (
            <button
              data-testid="applock-back-to-fingerprint"
              type="button"
              onClick={backToBiometric}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Fingerprint className="w-3.5 h-3.5" /> Use fingerprint instead
            </button>
          )}
          <button
            data-testid="applock-use-password"
            type="button"
            onClick={() => setConfirmUsePassword(true)}
            className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" /> Sign out &amp; use password
          </button>
        </div>

        <ConfirmDialog
          open={confirmUsePassword}
          title="Sign out & use password?"
          description="You'll be signed out on this device. Sign back in with your password to continue."
          confirmLabel="Sign out"
          danger
          loading={loggingOut}
          onConfirm={() => logout()}
          onCancel={() => setConfirmUsePassword(false)}
        />
      </div>
    );
  }

  // Chrome-less, matching the native branch above instead of wrapping everything in AuthCard's
  // bordered/shadowed card (a bottom sheet on mobile, a floating card from sm up, in the previous
  // version) — the lock screen is always a small, momentary overlay, never a full-page destination
  // the way login/signup/forgot/reset are, so it doesn't need AuthCard's weight. Unlike the native
  // branch, fingerprint/passkey and PIN can both be visible at once here (passkey never auto-fires
  // — see the effect above — so there's no single "face" to switch away from the way native's
  // biometric/pin toggle has one).
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unlock WealthyNest"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-2 bg-background p-6"
      style={{paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)"}}
    >
      {/* No name/greeting here on purpose — a lock screen is exactly the moment a phone might be
          in someone else's hands; showing icon + brand, not "Welcome back, {name}", matches how
          other apps (Face ID / passcode lock screens) treat this same moment. */}
      <BrandMark boxClassName="mb-6 w-16 h-16" iconClassName="w-11 h-11" roundedClassName="rounded-2xl" />
      <h2 className="font-serif text-2xl font-semibold text-foreground text-center mb-1.5">Verify it&apos;s you</h2>
      <p className="text-muted-foreground text-[13px] text-center leading-relaxed max-w-[260px] mb-6">
        Your session is protected while WealthyNest is in the background.
      </p>

      <div className="w-full max-w-[280px] space-y-4">
        {lockout && <LockoutBanner message={lockout.message} retryAt={lockout.retryAt} />}

        {/* Listed first when available. On native this is the retry button for the check that's
            already auto-firing above (a cancel/failure); on web/passkey it's the primary
            entry point itself, since passkey deliberately never auto-fires (see the effect
            above). Either way, the PIN form below it is the fallback, not a competing action.
            Same circular treatment as the native branch's fingerprint button — one consistent
            "biometric" shape regardless of platform. */}
        {fingerprintAvailable && (
          <div className="flex flex-col items-center gap-3">
            <button
              data-testid="applock-fingerprint-button"
              type="button"
              onClick={handleFingerprintUnlock}
              disabled={fingerprintPending}
              aria-label={fingerprintPending ? "Follow your device's prompt" : "Unlock with fingerprint"}
              className="w-24 h-24 rounded-full flex items-center justify-center transition-transform active:scale-95
                bg-gradient-to-br from-brand-600 to-brand-500 text-white
                shadow-[0_16px_36px_-12px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)]
                disabled:opacity-80"
            >
              {fingerprintPending
                ? <Loader2 className="w-9 h-9 animate-spin" />
                : <Fingerprint className="w-9 h-9 animate-pulse" />}
            </button>
            <p className="text-sm text-muted-foreground text-center">
              {fingerprintPending ? "Follow your device's prompt…" : "Unlock with fingerprint"}
            </p>

            {/* Only the passkey (web) path can hit this — native's fingerprint availability is
                already a per-device flag (see nativeBiometric.ts), so it doesn't have this
                account-vs-device mismatch to opt out of. */}
            {!nativeBiometricAvailable && passkeyFailed && (
              <button
                type="button"
                data-testid="applock-dismiss-passkey"
                onClick={dismissPasskeyOnDevice}
                className="text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Didn&apos;t work? Don&apos;t show this on this device again
              </button>
            )}
          </div>
        )}

        {pinAvailable && (
          <form onSubmit={handlePinSubmit} className="space-y-3">
            {fingerprintAvailable && (
              <div className="flex items-center gap-3" aria-hidden>
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground/70">OR ENTER PIN</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            {/* Real input captures typing/paste/mobile keyboard and stays screen-reader-visible;
                it's opacity-0 (not display:none) so it remains a valid focus/fill target for
                both a tap on the cells below and Playwright's .fill() — the cell divs after it
                are purely decorative, driven by this input's value. */}
            <div className="relative h-[52px]">
              <input
                data-testid="applock-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={PIN_LENGTH}
                autoFocus={!fingerprintAvailable}
                autoComplete="off"
                aria-label="PIN"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/[^0-9]/g, ""));
                  if (pinError) setPinError(false);
                  if (lockout) setLockout(null);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-text"
              />
              <PinCells pin={pin} pinError={pinError} />
            </div>

            {pinError && (
              <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                <AlertCircle className="w-3.5 h-3.5" /> Incorrect PIN — try again
              </p>
            )}

            <button
              data-testid="applock-pin-submit"
              type="submit"
              disabled={pinPending || pin.length !== PIN_LENGTH}
              className={
                fingerprintAvailable
                  ? "w-full h-11 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                  : "w-full h-11 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              }
            >
              {pinPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {/* "OR ENTER PIN" above already says what this is — repeating "Use PIN instead"
                  on the button itself was redundant. */}
              {pinPending ? "Verifying…" : "Unlock"}
            </button>
          </form>
        )}
      </div>

      {/* Demoted to a text link — with the fingerprint/PIN action already carrying full visual
          weight above, a second stacked button would read as a competing primary action rather
          than a clear fallback. The single sign-out path off this screen, framed as a peer unlock
          option rather than a dead end — for whoever's PIN/fingerprint isn't cooperating right
          now (their own device) or doesn't recognize the session at all (someone else's). */}
      <button
        data-testid="applock-use-password"
        onClick={() => setConfirmUsePassword(true)}
        className="mt-8 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" />
        Sign out &amp; use password
      </button>

      <ConfirmDialog
        open={confirmUsePassword}
        title="Sign out & use password?"
        description="You'll be signed out on this device. Sign back in with your password to continue."
        confirmLabel="Sign out"
        danger
        loading={loggingOut}
        onConfirm={() => logout()}
        onCancel={() => setConfirmUsePassword(false)}
      />
    </div>
  );
}
