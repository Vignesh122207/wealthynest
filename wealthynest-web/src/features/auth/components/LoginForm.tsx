"use client";

import {useEffect, useState} from "react";
import {useForm, type UseFormReturn} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import Link from "next/link";
import {
    AlertTriangle,
    ArrowLeft,
    Eye,
    EyeOff,
    KeyRound,
    Loader2,
    Lock,
    Mail,
    ShieldCheck,
    TrendingUp,
    Wallet
} from "lucide-react";
import {type LoginFormValues, loginSchema} from "../schemas/auth.schema";
import {useLogin, usePinLogin} from "../hooks/useAuth";
import {useAuthStore} from "../store/auth.store";
import {deriveLockoutState, type LockoutState} from "../utils/lockout";
import {GoogleSignInButton, isGoogleSignInConfigured} from "./GoogleSignInButton";
import {AuthBrandPanel} from "./AuthBrandPanel";
import {AuthCard} from "./AuthCard";
import {LockoutBanner} from "./LockoutBanner";
import {BrandMark} from "@/components/icons/BrandMark";
import {cn} from "@/lib/utils";

// pinEnabled on the persisted user object lets this device skip straight to a PIN prompt instead
// of the full form. This is a UX heuristic, not the real check — the refresh token that actually
// anchors PIN login lives only in an httpOnly cookie invisible to JS (see RefreshCookieService),
// so there's no way to know client-side whether it's still valid. A stale/expired cookie just
// means the PIN submit 401s cleanly and the user falls back to "use password instead" (see
// PinLoginStep's onUsePassword) rather than this ever being a security boundary.
const PIN_LENGTH = 4;

function PinLoginStep({ name, onUsePassword }: { name: string; onUsePassword: () => void }) {
  const [pin, setPin] = useState("");
  const [lockout, setLockout] = useState<LockoutState | null>(null);
  const { mutate: pinLogin, isPending } = usePinLogin();

  const submitPin = () => {
    if (pin.length !== PIN_LENGTH) return;
    pinLogin(pin, {
      onError: (e) => setLockout(deriveLockoutState(e)),
    });
  };

  // Auto-submits the instant the 4th digit lands — see AppLockScreen's own version of this same
  // effect for the fuller reasoning (a fixed-length PIN doesn't need a manual confirm step).
  useEffect(() => {
    if (pin.length !== PIN_LENGTH || isPending) return;
    submitPin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPin();
  };

  return (
    <AuthCard>
      <div className="mb-7 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-6 h-6 text-brand-500" />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-foreground mb-1">Welcome back, {name.split(" ")[0]}</h2>
        <p className="text-muted-foreground text-sm">Enter your PIN to continue</p>
      </div>
      {lockout && <LockoutBanner message={lockout.message} retryAt={lockout.retryAt} />}
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          data-testid="login-pin-input"
          type="password"
          inputMode="numeric"
          maxLength={PIN_LENGTH}
          autoFocus
          autoComplete="off"
          aria-label="PIN"
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/[^0-9]/g, "")); if (lockout) setLockout(null); }}
          placeholder="••••"
          className="w-full h-14 px-4 rounded-xl text-center text-2xl tracking-[0.5em] outline-none transition-all
            bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground
            focus:bg-card focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
        />
        {/* h-12 (48px), not h-11 — matches every other primary CTA in this flow (entry buttons,
            password-step submit) so the tap target doesn't shrink on this one step. */}
        <button data-testid="login-pin-submit" type="submit" disabled={isPending || pin.length !== PIN_LENGTH}
          className="w-full h-12 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
            bg-gradient-to-br from-brand-600 to-brand-500 text-white
            shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)]
            hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5
            disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPending ? "Verifying…" : "Continue"}
        </button>
      </form>
      <button data-testid="login-pin-use-password" onClick={onUsePassword}
        className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
        Sign in with password instead
      </button>
    </AuthCard>
  );
}

// Reached via the entry screen's "Continue with email" button — one form asking for email and
// password together, the standard shape (Continue with email → one screen → submit), not the
// email-then-password two-step this used to be split into. No passkey option here — passkey is
// scoped entirely to AppLockScreen's returning-device unlock now, not a full-login alternative
// alongside email/password (see that component's own comment for why it never auto-fires either).
function PasswordLoginStep({ form, onSubmit, isPending, emailNotVerified, lockout, onBack }: {
  form: UseFormReturn<LoginFormValues>;
  onSubmit: (v: LoginFormValues) => void;
  isPending: boolean;
  emailNotVerified: string | null;
  lockout: LockoutState | null;
  onBack: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthCard>
      <div className="mb-7 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-brand-500" />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-foreground mb-1">Sign in</h2>
        <p className="text-muted-foreground text-sm">Enter your email and password to continue</p>
      </div>

      {lockout && <LockoutBanner message={lockout.message} retryAt={lockout.retryAt} />}

      {emailNotVerified && (
        <div className="mb-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-300">
            <p className="font-medium mb-1">Email not verified</p>
            <p className="text-amber-700/80 dark:text-amber-400/80">
              Check your inbox for a verification link.{" "}
              <Link
                href={`/verify-email?email=${encodeURIComponent(emailNotVerified)}`}
                className="underline text-amber-700 dark:text-amber-300 hover:text-amber-600 dark:hover:text-amber-200"
              >
                Resend email
              </Link>
            </p>
          </div>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login-password-step-email" className="text-xs font-medium text-muted-foreground">Email</label>
          <input
            id="login-password-step-email"
            data-testid="login-password-step-email-input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            autoFocus
            {...form.register("email")}
            className={cn(
              "w-full h-12 px-4 rounded-xl text-sm outline-none transition-all",
              "bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground",
              "focus:bg-card focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25",
              form.formState.errors.email && "border-red-500/60"
            )}
          />
          {form.formState.errors.email && (
            <p data-testid="login-email-error" className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password-step-password" className="text-xs font-medium text-muted-foreground">Password</label>
            <Link href="/forgot-password" className="text-xs text-brand-600 dark:text-brand-300 hover:text-brand-500 dark:hover:text-brand-200 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password-step-password"
              data-testid="login-password-step-password-input"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              {...form.register("password")}
              className={cn(
                "w-full h-12 px-4 pr-10 rounded-xl text-sm outline-none transition-all",
                "bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground",
                "focus:bg-card focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25",
                form.formState.errors.password && "border-red-500/60"
              )}
            />
            <button type="button" onClick={() => setShowPassword(p => !p)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground transition-colors">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.password.message}</p>
          )}
        </div>

        <button data-testid="login-password-submit" type="submit" disabled={isPending}
          className={cn(
            "w-full h-12 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
            "bg-gradient-to-br from-brand-600 to-brand-500 text-white",
            "shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)]",
            "hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5",
            "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          )}>
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <button data-testid="login-back-button" onClick={onBack}
        className="mt-6 w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>
    </AuthCard>
  );
}

// Matches SignupForm's own module-level const — Capacitor.isNativePlatform() and the
// NEXT_PUBLIC_* env vars it reads are both fixed for the life of the session, so this doesn't
// need to be recomputed per render.
const googleClientIdConfigured = isGoogleSignInConfigured();

const EYEBROW = "Private finance, made simple";

const PERKS = [
  { icon: Wallet,       text: "Track all your assets in one place" },
  { icon: TrendingUp,   text: "Real-time investment & XIRR tracking" },
  { icon: ShieldCheck,  text: "Fully private — your data stays yours" },
];

export function LoginForm() {
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState<string | null>(null);
  const [lockout, setLockout] = useState<LockoutState | null>(null);
  const [usePasswordInstead, setUsePasswordInstead] = useState(false);
  // Snapshot taken once, after the auth store's persisted state has rehydrated on mount —
  // deliberately NOT a live subscription. A fresh login inside this same page lifecycle calls
  // setAuth() (to populate the store for the redirect that follows), and if this read the store
  // reactively, a pinEnabled user would see the PIN screen flash for a frame right after
  // successfully signing in with password/Google/passkey, before router.push("/home")
  // finishes — this only asks "was PIN already set up on this device before I arrived here?".
  const [pinCandidate, setPinCandidate] = useState<{ eligible: boolean; name: string } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { mutate: login, isPending } = useLogin();

  useEffect(() => {
    const { user } = useAuthStore.getState();
    setPinCandidate({ eligible: !!user?.pinEnabled, name: user?.fullName ?? "" });
    setHydrated(true);
  }, []);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const showPinStep = hydrated && !usePasswordInstead && !!pinCandidate?.eligible;

  const onSubmit = (v: LoginFormValues) => {
    setEmailNotVerified(null);
    setLockout(null);
    login(v, {
      onError: (e: unknown) => {
        const code = e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
        if (code === "EMAIL_NOT_VERIFIED") setEmailNotVerified(v.email);
        else setLockout(deriveLockoutState(e));
      },
    });
  };

  return (
    // Locked to the viewport height on mobile (where AuthBrandPanel is hidden and this is the
    // whole screen) so the card sits fixed and centered instead of the page scrolling under it —
    // matches how a native app's own login screen behaves. `main` below still allows its own
    // internal scroll as a fallback for a genuinely short device/landscape/keyboard-open case, so
    // a field or the submit button can never become unreachable, just no longer the default.
    // Desktop reverts to natural page growth — plenty of room there for the two-column layout.
    // The `-env(safe-area-inset-top)` subtraction matters: (auth)/layout.tsx wraps every auth page
    // (this one included) in a `paddingTop: env(safe-area-inset-top)` div for the native status
    // bar. That padding sits outside this div, so on a real notch/status-bar device a plain
    // `100dvh` here would combine with it to exceed the actual viewport by exactly that inset —
    // just enough to force the whole page to scroll again despite `overflow-hidden` below.
    <div className="h-[calc(100dvh-env(safe-area-inset-top,0px))] overflow-hidden lg:h-auto lg:min-h-screen lg:overflow-visible flex bg-background">

      {/* ── Left panel — brand ──────────────────────────────── */}
      <AuthBrandPanel
        gradientClassName="bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900"
        watermarkSide="right"
        eyebrow={EYEBROW}
        headline={<>Take charge of<br />your financial life</>}
        subcopy="Everything you need to track, plan and grow your wealth — built for Indian families."
        perks={PERKS}
        trustLabel="Passkey & biometric ready"
        copyrightNote={`© ${new Date().getFullYear()} WealthyNest · Built with ♥`}
      />

      {/* ── Right panel — form ──────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">

        {/* The desktop aside's marketing panel (watermark, gradient, perks) has nowhere to go on a
            phone-width screen — AuthCard below already carries the serif heading/accent-line/
            gradient-button treatment regardless of viewport, so this just needs to tie the top of
            the screen back to the same brand voice, not repeat the aside's whole pitch. Reuses the
            exact eyebrow copy from the desktop panel rather than inventing separate mobile copy. */}
        <div className="lg:hidden flex flex-col items-center mb-8 text-center">
          <div className="flex items-center gap-2.5 mb-2">
            <BrandMark boxClassName="w-9 h-9" iconClassName="w-6 h-6" />
            <span className="text-lg font-bold text-foreground">WealthyNest</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">
            {EYEBROW}
          </p>
        </div>

        {showPinStep ? (
          <PinLoginStep name={pinCandidate!.name} onUsePassword={() => setUsePasswordInstead(true)} />
        ) : showPasswordStep ? (
          <PasswordLoginStep form={form} onSubmit={onSubmit} isPending={isPending}
            emailNotVerified={emailNotVerified} lockout={lockout} onBack={() => setShowPasswordStep(false)} />
        ) : (
        <>
        <AuthCard>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300 mb-2.5">Sign in</p>
          <div className="mb-7">
            <h2 className="font-serif text-[27px] font-semibold text-foreground mb-1.5 tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground text-sm">Sign in to continue to WealthyNest</p>
          </div>

          {/* Two clear entry points, not a form and an OAuth button sharing the same card — Google
              leads (fastest path for anyone who has it), "Continue with email" is the one deliberate
              step into the email/password/passkey flow below. Always the long-lived session — no
              "stay signed in" checkbox, since AppLockScreen's PIN/fingerprint/passkey gate is what
              actually protects a returning device, the same pattern real banking apps use — see
              useLogin's own comment for the fuller reasoning. */}
          <div className="space-y-3">
            {googleClientIdConfigured && (
              <>
                <GoogleSignInButton />
                <div className="flex items-center gap-3 py-1" aria-hidden>
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground/70">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </>
            )}
            <button data-testid="login-continue-with-email-button" type="button" onClick={() => setShowPasswordStep(true)}
              className="w-full h-12 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2.5
                bg-muted hover:bg-muted/80 text-foreground border border-border">
              <Mail className="w-4 h-4" /> Continue with email
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-brand-600 dark:text-brand-300 hover:text-brand-500 dark:hover:text-brand-200 font-semibold transition-colors">
              Create one
            </Link>
          </p>
        </AuthCard>
        <p className="mt-[18px] flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
          <ShieldCheck className="w-3 h-3" /> Private by design · never sold to advertisers
        </p>
        </>
        )}
      </main>
    </div>
  );
}
