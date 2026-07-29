"use client";

import {useRouter} from "next/navigation";
import {AlertCircle, ArrowLeft, KeyRound, X} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {AuthCard} from "@/features/auth/components/AuthCard";
import {PinCells, Keypad} from "@/features/auth/components/PinKeypad";
import {useEnablePin} from "@/features/auth/hooks/useAuth";
import {usePinEntryFlow} from "@/features/auth/hooks/usePinEntryFlow";
import {useIsNativePlatform} from "@/features/auth/hooks/useNativeBiometric";

// Dedicated screen (not an inline settings-card form — setting up quick unlock is deliberate
// enough to warrant its own page): choose a PIN, confirm it, done — no password step (see
// AuthServiceImpl#enablePin's own comment for why that's a deliberate call).
//
// Native only reaches this route (PinRow on settings/security pushes here); on web, PinRow now
// opens PinSetupModal in place instead of navigating — this page stays reachable there too
// (direct URL/back-forward/bookmarks), just no longer the primary path.
export default function SetupPinPage() {
  const router = useRouter();
  const isNative = useIsNativePlatform();
  const { mutate: enablePin, isPending } = useEnablePin();
  const close = () => router.push("/settings/security");

  const { step, value, mismatch, startOver, handleDigit, handleBackspace } = usePinEntryFlow({
    isPending,
    onConfirmed: (pin, { onError }) => enablePin(pin, { onSuccess: close, onError }),
  });

  // Start-over (only once there's a chosen PIN to redo) on the left, a plain close on the right —
  // replaces the old "← Security" text link, which read as a second, confusing way back on top of
  // whatever nav the shell around this page already provides (dashboard sidebar on web; nothing at
  // all in the native full-screen variant below, where this is the only way out).
  const topBar = (
    <div className="flex items-center justify-between">
      {step === "confirm" ? (
        <button onClick={startOver} data-testid="pin-setup-start-over"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Start over
        </button>
      ) : <span aria-hidden />}
      <button onClick={close} aria-label="Close" data-testid="pin-setup-close"
        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const card = (
    <AuthCard>
      <div className="mb-7 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-6 h-6 text-brand-500" />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-foreground mb-1">
          {step === "choose" ? "Choose your PIN" : "Confirm your PIN"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {step === "choose"
            ? "Pick 4 digits to unlock WealthyNest quickly on this device. Tap below — no keyboard needed."
            : "Enter your PIN again to confirm."}
        </p>
      </div>

      {mismatch && (
        <p className="mb-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5" /> PINs didn&apos;t match — try again
        </p>
      )}

      <PinCells value={value} error={mismatch} />

      <div className="mt-8">
        <Keypad onDigit={handleDigit} onBackspace={handleBackspace} disabled={isPending} />
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground/70">
        {isPending ? "Setting up…" : "Continues automatically once you've entered 4 digits"}
      </p>
    </AuthCard>
  );

  // Native (Capacitor) app: full screen, no dashboard chrome at all — this is the only thing on
  // screen while setting up a PIN, matching how AppLockScreen itself takes over the whole viewport
  // (`fixed inset-0 z-[100]`) rather than living inside the normal page layout.
  if (isNative) {
    return (
      <div data-testid="pin-setup-fullscreen" className="fixed inset-0 z-[100] flex flex-col bg-background">
        <div className="px-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
          {topBar}
        </div>
        <div className="flex-1 overflow-y-auto flex items-center justify-center px-6"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
          <div className="w-full max-w-md">{card}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Set up PIN" subtitle="A quick 4-digit unlock for this device" />
      <PageWrapper>
        <div className="max-w-lg mx-auto space-y-6">
          {topBar}
          {card}
        </div>
      </PageWrapper>
    </div>
  );
}
