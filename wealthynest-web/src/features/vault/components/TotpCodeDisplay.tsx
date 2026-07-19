"use client";

import {useEffect, useState} from "react";
import {TOTP, Secret} from "otpauth";
import {Copy} from "lucide-react";
import {toast} from "sonner";

const VAULT_SLATE = "#64748b";
const PERIOD_SECONDS = 30;

/** Renders a rotating 6-digit TOTP code with a countdown ring. The base32 secret only ever
 * arrives here already decrypted via the step-up-gated reveal response — codes are generated
 * entirely client-side, nothing is sent back to the server. */
export function TotpCodeDisplay({ base32Secret }: { base32Secret: string }) {
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(PERIOD_SECONDS);

  useEffect(() => {
    let totp: TOTP;
    try {
      totp = new TOTP({ secret: Secret.fromBase32(base32Secret), digits: 6, period: PERIOD_SECONDS });
    } catch {
      return;
    }

    const tick = () => {
      setCode(totp.generate());
      setSecondsLeft(PERIOD_SECONDS - (Math.floor(Date.now() / 1000) % PERIOD_SECONDS));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [base32Secret]);

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  if (!code) return null;

  const progress = secondsLeft / PERIOD_SECONDS;
  const circumference = 2 * Math.PI * 9;

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">2FA Code</p>
        <p className="text-lg font-mono font-semibold tabular-nums tracking-wider text-foreground">
          {code.slice(0, 3)} {code.slice(3)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0 -rotate-90">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/20" />
          <circle cx="12" cy="12" r="9" fill="none" stroke={VAULT_SLATE} strokeWidth="2"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <button type="button" onClick={handleCopy} aria-label="Copy code"
          className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
