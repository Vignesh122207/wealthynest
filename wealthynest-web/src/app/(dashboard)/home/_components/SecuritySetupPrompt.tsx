"use client";

import {useState} from "react";
import Link from "next/link";
import {Capacitor} from "@capacitor/core";
import {Fingerprint, KeyRound, Lock, X} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useNativeBiometricStatus} from "@/features/auth/hooks/useNativeBiometric";

const DISMISS_KEY_PREFIX = "wealthynest:securitySetupPromptDismissed:";

// Native-only nudge toward the fast-unlock setup that already exists in Settings → Security
// (PinSection/NativeBiometricSection) but has no discovery path outside of digging through
// Settings. PIN and fingerprint are two independent options, not a PIN-first prerequisite chain —
// see nativeBiometric.ts for why the fingerprint toggle needs nothing stored behind it.
export function SecuritySetupPrompt() {
  const { user } = useAuthStore();
  const { data: nativeBiometric } = useNativeBiometricStatus();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined" || !user) return false;
    return localStorage.getItem(DISMISS_KEY_PREFIX + user.id) === "true";
  });

  if (!Capacitor.isNativePlatform() || !user || dismissed) return null;

  // Either one alone already delivers what this card promises ("skip typing your password") —
  // PIN and fingerprint are independent options here (see this component's own top comment), not
  // a pair that both need checking off before the nudge goes away. Reaching the JSX below means
  // neither is done, so it only ever needs to offer both as actions — never a "done" state.
  if (user.pinEnabled || nativeBiometric?.enabled) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY_PREFIX + user.id, "true");
    setDismissed(true);
  };

  return (
    <div data-testid="security-setup-prompt" className="animate-fade-in-up rounded-2xl bg-card border border-slate-100/80 dark:border-border/50 shadow-soft dark:shadow-none p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <PremiumIcon icon={Lock} tone="indigo" size="xs" />
          <div>
            <p className="text-sm font-semibold text-foreground">Secure this device</p>
            <p className="text-xs text-muted-foreground mt-0.5">Skip typing your password every time you open the app.</p>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" data-testid="security-setup-prompt-dismiss"
          className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/settings/security" data-testid="security-setup-prompt-pin"
          className="flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-600/10 hover:bg-indigo-600/20 px-3 py-2.5 transition-colors">
          <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Set up PIN</span>
        </Link>

        <Link href="/settings/security" data-testid="security-setup-prompt-fingerprint"
          className="flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-600/10 hover:bg-indigo-600/20 px-3 py-2.5 transition-colors">
          <Fingerprint className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Set up fingerprint</span>
        </Link>
      </div>
    </div>
  );
}
