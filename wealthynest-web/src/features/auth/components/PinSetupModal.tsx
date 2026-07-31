"use client";

import {AlertCircle, ArrowLeft, KeyRound, X} from "lucide-react";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {AuthCard} from "./AuthCard";
import {PinCells, Keypad} from "./PinKeypad";
import {useEnablePin} from "../hooks/useAuth";
import {usePinEntryFlow} from "../hooks/usePinEntryFlow";

// Web's PIN setup surface — a popup on top of Security, not the full-page navigation the native
// app still uses (see settings/security/pin/page.tsx's own comment: that route stays native's
// path and web's fallback, this is web's primary one now). Same choose/confirm flow and keypad,
// just different chrome — TransactionModalOverlay's own backdrop/focus-trap/Escape handling
// instead of a dedicated route.
//
// Close/start-over sit inside the card's own corners (same convention as FormModalHeader/
// VaultModalHeader — every other modal in the app puts its close control on the card itself, not
// floating in a separate row above it) and everything below is deliberately smaller than the
// native full-page version: a popup has to fit inside a viewport it's borrowing, not a whole
// screen, so `compact` keeps the keypad tappable while the card comfortably fits without
// TransactionModalOverlay ever needing to fall back to its own scroll.
export function PinSetupModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { mutate: enablePin, isPending } = useEnablePin();
  const { step, value, mismatch, startOver, handleDigit, handleBackspace } = usePinEntryFlow({
    isPending,
    onConfirmed: (pin, { onError }) => enablePin(pin, { onSuccess, onError }),
  });

  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-[360px]">
      <AuthCard animation="scale-in" className="px-5 pt-5 pb-6">
        {step === "confirm" ? (
          <button onClick={startOver} data-testid="pin-setup-start-over" aria-label="Start over"
            className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : null}
        <button onClick={onClose} aria-label="Close" data-testid="pin-setup-close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5 pt-2 text-center">
          <div className="w-11 h-11 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-5 h-5 text-brand-500" />
          </div>
          <h2 className="font-serif text-lg font-semibold text-foreground mb-1">
            {step === "choose" ? "Choose your PIN" : "Confirm your PIN"}
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {step === "choose"
              ? "Pick 4 digits to unlock WealthyNest quickly on this device."
              : "Enter your PIN again to confirm."}
          </p>
        </div>

        {mismatch && (
          <p className="mb-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5" /> PINs didn&apos;t match — try again
          </p>
        )}

        <PinCells value={value} error={mismatch} compact />

        <div className="mt-5">
          <Keypad onDigit={handleDigit} onBackspace={handleBackspace} disabled={isPending} compact />
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
          {isPending ? "Setting up…" : "Continues automatically once you've entered 4 digits"}
        </p>
      </AuthCard>
    </TransactionModalOverlay>
  );
}
