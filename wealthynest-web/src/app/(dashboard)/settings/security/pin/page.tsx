"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {AlertCircle, ArrowLeft, Delete, KeyRound, X} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {AuthCard} from "@/features/auth/components/AuthCard";
import {useEnablePin} from "@/features/auth/hooks/useAuth";
import {useIsNativePlatform} from "@/features/auth/hooks/useNativeBiometric";
import {cn} from "@/lib/utils";

const PIN_LENGTH = 4;

// Same cell treatment as AppLockScreen/LoginForm's PIN steps — filled/active/error states, shake
// on mismatch — kept local rather than shared since those two render full-screen and always pair
// with a native-keyboard hidden input, while this page pairs with the keypad below instead.
function PinCells({ value, error }: { value: string; error: boolean }) {
  return (
    <div className={cn("flex items-center justify-center gap-2.5", error && "animate-shake")}>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => {
        const filled = i < value.length;
        const active = i === value.length;
        return (
          <div key={i} data-testid="pin-setup-cell" className={cn(
            "w-full max-w-14 h-16 rounded-2xl border-[1.5px] flex items-center justify-center transition-all",
            error ? "border-red-500 bg-red-500/10"
              : filled ? "border-brand-500 bg-card"
              : active ? "border-brand-300 ring-[3px] ring-brand-500/20"
              : "bg-muted/40 border-border"
          )}>
            {filled && <span className={cn("w-3 h-3 rounded-full", error ? "bg-red-500" : "bg-brand-500")} />}
          </div>
        );
      })}
    </div>
  );
}

// Custom on-screen keypad — deliberately not the device's native numeric keyboard (the hidden
// `inputMode="numeric"` input Login and App-Lock unlock both still use). This is the one PIN
// entry surface that gets its own input; the other two are unchanged.
function Keypad({ onDigit, onBackspace, disabled }: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  disabled: boolean;
}) {
  const keyClass = "aspect-square rounded-full border border-border bg-card text-xl font-semibold text-foreground " +
    "hover:bg-muted active:scale-90 active:bg-brand-500/15 transition-all disabled:opacity-50 disabled:pointer-events-none";

  return (
    <div className="grid grid-cols-3 gap-3.5 max-w-[280px] mx-auto">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
        <button key={k} type="button" onClick={() => onDigit(k)} disabled={disabled}
          data-testid={`pin-keypad-${k}`} className={keyClass}>
          {k}
        </button>
      ))}
      <div aria-hidden />
      <button type="button" onClick={() => onDigit("0")} disabled={disabled}
        data-testid="pin-keypad-0" className={keyClass}>
        0
      </button>
      <button type="button" onClick={onBackspace} disabled={disabled} aria-label="Delete digit"
        data-testid="pin-keypad-backspace"
        className="aspect-square rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-90 transition-all disabled:opacity-50 disabled:pointer-events-none">
        <Delete className="w-5 h-5" />
      </button>
    </div>
  );
}

// Dedicated screen (not an inline settings-card form — setting up quick unlock is deliberate
// enough to warrant its own page): choose a PIN, confirm it, done — no password step (see
// AuthServiceImpl#enablePin's own comment for why that's a deliberate call).
export default function SetupPinPage() {
  const router = useRouter();
  const isNative = useIsNativePlatform();
  const { mutate: enablePin, isPending } = useEnablePin();

  const [step, setStep] = useState<"choose" | "confirm">("choose");
  const [chosenPin, setChosenPin] = useState("");
  const [value, setValue] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const startOver = () => {
    setStep("choose");
    setChosenPin("");
    setValue("");
    setMismatch(false);
  };
  const close = () => router.push("/settings/security");

  function submit(digits: string) {
    if (step === "choose") {
      setChosenPin(digits);
      setValue("");
      setStep("confirm");
      return;
    }
    if (digits === chosenPin) {
      enablePin(digits, {
        onSuccess: () => router.push("/settings/security"),
        onError: () => setValue(""),
      });
    } else {
      setMismatch(true);
      setTimeout(() => { setValue(""); setMismatch(false); }, 450);
    }
  }

  function handleDigit(d: string) {
    if (isPending || value.length >= PIN_LENGTH) return;
    const next = value + d;
    setValue(next);
    if (mismatch) setMismatch(false);
    if (next.length === PIN_LENGTH) setTimeout(() => submit(next), 180);
  }

  function handleBackspace() {
    if (isPending || value.length === 0) return;
    setValue((v) => v.slice(0, -1));
    if (mismatch) setMismatch(false);
  }

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
