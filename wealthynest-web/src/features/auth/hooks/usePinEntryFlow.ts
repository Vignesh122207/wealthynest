import {useState} from "react";

export const PIN_LENGTH = 4;

/** Choose-then-confirm PIN entry state machine — shared by the native full-page PIN setup route
 * and the web popup modal (see settings/security/page.tsx's PinRow) so the two surfaces can't
 * silently drift on retry/mismatch/backspace behavior. Callers own how a confirmed PIN is
 * submitted (the mutation itself, and what happens after) via `onConfirmed`. */
export function usePinEntryFlow({ isPending, onConfirmed }: {
  isPending: boolean;
  onConfirmed: (pin: string, opts: { onError: () => void }) => void;
}) {
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

  function submit(digits: string) {
    if (step === "choose") {
      setChosenPin(digits);
      setValue("");
      setStep("confirm");
      return;
    }
    if (digits === chosenPin) {
      onConfirmed(digits, { onError: () => setValue("") });
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

  return { step, value, mismatch, startOver, handleDigit, handleBackspace };
}
