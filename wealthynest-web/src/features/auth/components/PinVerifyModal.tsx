"use client";

import {useState} from "react";
import {AlertCircle, KeyRound, X} from "lucide-react";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {AuthCard} from "./AuthCard";
import {PinCells, Keypad} from "./PinKeypad";
import {LockoutBanner} from "./LockoutBanner";
import {useDisablePin} from "../hooks/useAuth";
import {PIN_LENGTH} from "../hooks/usePinEntryFlow";
import {deriveLockoutState, type LockoutState} from "../utils/lockout";

// Gates turning PIN unlock OFF behind re-entering the current PIN — see
// AuthServiceImpl#disablePin's own comment: disabling is the more sensitive direction (anyone
// holding an already-unlocked device for a few seconds could otherwise switch it off outright),
// so it gets the same step-up check enabling deliberately skips. A single entry, no choose/confirm
// (there's nothing new to pick), reusing the same compact popup chrome as PinSetupModal and the
// same lockout/shake handling AppLockScreen's own PIN unlock uses — this IS a real unlock attempt
// against the account's PIN, just spent on turning it off instead of clearing a session lock.
export function PinVerifyModal({ onClose, onVerified }: { onClose: () => void; onVerified: () => void }) {
  const { mutate: disablePin, isPending } = useDisablePin();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [lockout, setLockout] = useState<LockoutState | null>(null);

  function submit(pin: string) {
    disablePin(pin, {
      onSuccess: onVerified,
      onError: (e: unknown) => {
        const state = deriveLockoutState(e);
        if (state) { setLockout(state); setValue(""); return; }
        setError(true);
        setTimeout(() => { setValue(""); setError(false); }, 450);
      },
    });
  }

  function handleDigit(d: string) {
    if (isPending || lockout || value.length >= PIN_LENGTH) return;
    const next = value + d;
    setValue(next);
    if (error) setError(false);
    if (next.length === PIN_LENGTH) setTimeout(() => submit(next), 180);
  }

  function handleBackspace() {
    if (isPending || value.length === 0) return;
    setValue((v) => v.slice(0, -1));
    if (error) setError(false);
  }

  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-[360px]">
      <AuthCard className="px-5 pt-5 pb-6">
        <button onClick={onClose} aria-label="Close" data-testid="pin-verify-close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5 pt-2 text-center">
          <div className="w-11 h-11 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-5 h-5 text-brand-500" />
          </div>
          <h2 className="font-serif text-lg font-semibold text-foreground mb-1">Confirm your PIN</h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Enter your current PIN to turn off PIN unlock.
          </p>
        </div>

        {lockout && <LockoutBanner message={lockout.message} retryAt={lockout.retryAt} />}

        {error && (
          <p className="mb-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5" /> Incorrect PIN — try again
          </p>
        )}

        <PinCells value={value} error={error} compact />

        <div className="mt-5">
          <Keypad onDigit={handleDigit} onBackspace={handleBackspace} disabled={isPending || !!lockout} compact />
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
          {isPending ? "Verifying…" : "Continues automatically once you've entered 4 digits"}
        </p>
      </AuthCard>
    </TransactionModalOverlay>
  );
}
