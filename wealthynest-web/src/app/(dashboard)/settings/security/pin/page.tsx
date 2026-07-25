"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {AlertCircle, ArrowLeft, KeyRound} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {AuthCard} from "@/features/auth/components/AuthCard";
import {useEnablePin} from "@/features/auth/hooks/useAuth";
import {cn} from "@/lib/utils";

const PIN_LENGTH = 4;

// Same cell treatment as AppLockScreen/LoginForm's PIN steps — filled/active/error states, shake
// on mismatch — kept local rather than extracted since this is only the second call site.
function PinCells({ value, error }: { value: string; error: boolean }) {
  return (
    <div className={cn("flex items-center justify-center gap-2.5 pointer-events-none", error && "animate-shake")}>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => {
        const filled = i < value.length;
        const active = i === value.length;
        return (
          <div key={i} data-testid="pin-setup-cell" className={cn(
            "w-full max-w-14 h-16 rounded-2xl border-[1.5px] flex items-center justify-center transition-all",
            error ? "border-red-500 bg-red-500/10"
              : filled ? "border-[#c2703d] bg-card"
              : active ? "border-[#d98a52] ring-[3px] ring-[#c2703d]/20"
              : "bg-muted/40 border-border"
          )}>
            {filled && <span className={cn("w-3 h-3 rounded-full", error ? "bg-red-500" : "bg-[#c2703d]")} />}
          </div>
        );
      })}
    </div>
  );
}

// Dedicated screen (not an inline settings-card form): choose a PIN, confirm it, done — no
// password step (see AuthServiceImpl#enablePin's own comment for why that's a deliberate call).
// `key={step}` on the input below forces a remount on every step change so `autoFocus` actually
// refires — React only runs it on mount, and without a fresh element the second step's input
// would sit there unfocused until tapped.
export default function SetupPinPage() {
  const router = useRouter();
  const { mutate: enablePin, isPending } = useEnablePin();

  const [step, setStep] = useState<"choose" | "confirm">("choose");
  const [chosenPin, setChosenPin] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const startOver = () => {
    setStep("choose");
    setChosenPin("");
    setConfirmValue("");
    setMismatch(false);
  };

  const handleChooseChange = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH);
    setChosenPin(digits);
    if (digits.length === PIN_LENGTH) {
      setTimeout(() => setStep("confirm"), 150);
    }
  };

  const handleConfirmChange = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH);
    setConfirmValue(digits);
    if (mismatch) setMismatch(false);
    if (digits.length !== PIN_LENGTH) return;

    if (digits === chosenPin) {
      enablePin(digits, {
        onSuccess: () => router.push("/settings/security"),
        onError: () => setConfirmValue(""),
      });
    } else {
      setMismatch(true);
      setTimeout(() => setConfirmValue(""), 450);
    }
  };

  const value = step === "choose" ? chosenPin : confirmValue;

  return (
    <div className="flex flex-col flex-1">
      <Header title="Set up PIN" subtitle="A quick 4-digit unlock for this device" />
      <PageWrapper>
        <div className="max-w-lg mx-auto space-y-6">
          {step === "confirm" ? (
            <button onClick={startOver} data-testid="pin-setup-start-over"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Start over
            </button>
          ) : (
            <Link href="/settings/security" data-testid="pin-setup-back-link"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Security
            </Link>
          )}

          <AuthCard>
            <div className="mb-7 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#c2703d]/10 flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-6 h-6 text-[#c2703d]" />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-foreground mb-1">
                {step === "choose" ? "Choose your PIN" : "Confirm your PIN"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {step === "choose"
                  ? "Pick 4 digits to unlock WealthyNest quickly on this device."
                  : "Enter your PIN again to confirm."}
              </p>
            </div>

            {mismatch && (
              <p className="mb-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                <AlertCircle className="w-3.5 h-3.5" /> PINs didn&apos;t match — try again
              </p>
            )}

            <div className="relative h-16">
              <input
                key={step}
                data-testid={step === "choose" ? "pin-setup-choose-input" : "pin-setup-confirm-input"}
                type="password"
                inputMode="numeric"
                maxLength={PIN_LENGTH}
                autoFocus
                autoComplete="off"
                aria-label={step === "choose" ? "Choose a 4-digit PIN" : "Confirm your 4-digit PIN"}
                value={value}
                onChange={(e) => step === "choose" ? handleChooseChange(e.target.value) : handleConfirmChange(e.target.value)}
                disabled={isPending}
                className="absolute inset-0 w-full h-full opacity-0 cursor-text"
              />
              <PinCells value={value} error={mismatch} />
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground/70">
              {isPending ? "Setting up…" : "Continues automatically once you've entered 4 digits"}
            </p>
          </AuthCard>
        </div>
      </PageWrapper>
    </div>
  );
}
