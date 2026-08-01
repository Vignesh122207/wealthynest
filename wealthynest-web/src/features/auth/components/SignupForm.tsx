"use client";

import {useEffect, useState} from "react";
import {useForm, useWatch} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowLeft, Check, Eye, EyeOff, IndianRupee, Loader2, Mail, ShieldCheck, Target, Wallet, X} from "lucide-react";
import {BrandMark} from "@/components/icons/BrandMark";
import {GoogleSignInButton, isGoogleSignInConfigured} from "./GoogleSignInButton";
import {AuthBrandPanel} from "./AuthBrandPanel";
import {AuthCard} from "./AuthCard";
import {type RegisterFormValues, registerSchema} from "../schemas/auth.schema";
import {useRegister} from "../hooks/useAuth";
import {useAuthStore} from "../store/auth.store";
import {cn} from "@/lib/utils";

const googleClientIdConfigured = isGoogleSignInConfigured();

const EYEBROW = "Zero ads · zero selling";

const PERKS = [
  { icon: Wallet,       text: "Net worth across all accounts" },
  { icon: Target,       text: "Budget goals & smart alerts" },
  { icon: IndianRupee,  text: "SIPs, mutual funds & dividends" },
  { icon: ShieldCheck,  text: "100% private — nothing is sold" },
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["", "Weak", "Weak", "Fair", "Good", "Strong"];
  const barColors  = ["", "bg-red-500", "bg-red-400", "bg-amber-500", "bg-emerald-500", "bg-emerald-400"];
  const textColors = ["", "text-red-600 dark:text-red-400", "text-red-600 dark:text-red-400",
    "text-amber-600 dark:text-amber-400", "text-emerald-600 dark:text-emerald-400", "text-emerald-600 dark:text-emerald-400"];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i <= score ? barColors[score] : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs font-medium", textColors[score])}>
        {labels[score]}
      </p>
    </div>
  );
}

// Same four rules registerSchema (and the backend's @Pattern) actually enforce — checked live so
// "what am I missing" is answered by looking, not by submitting and reading a validation error.
const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: "At least 8 characters", test: p => p.length >= 8 },
  { label: "One uppercase letter",  test: p => /[A-Z]/.test(p) },
  { label: "One lowercase letter",  test: p => /[a-z]/.test(p) },
  { label: "One number",            test: p => /\d/.test(p) },
];

function PasswordChecklist({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
      {PASSWORD_RULES.map(rule => {
        const met = rule.test(password);
        return (
          <li key={rule.label} className={cn(
            "flex items-center gap-1.5 text-xs font-medium transition-colors",
            met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/70"
          )}>
            {met ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 opacity-40" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

function PasswordMatch({ password, confirm }: { password: string; confirm: string }) {
  if (!confirm) return null;
  const match = password === confirm;
  return (
    <p className={cn(
      "flex items-center gap-1 text-xs font-medium",
      match ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
    )}>
      {match ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      {match ? "Passwords match" : "Passwords don't match"}
    </p>
  );
}

export function SignupForm() {
  const [showEmailStep, setShowEmailStep] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { mutate: register, isPending } = useRegister();
  const router = useRouter();

  // Same guard as LoginForm's own — see its comment for the full why. Reached directly (a
  // bookmarked/typed /signup URL) rather than via a logged-out entry point.
  useEffect(() => {
    if (useAuthStore.getState().isAuthenticated) { router.replace("/home"); return; }
    setHydrated(true);
  }, [router]);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const passwordValue = useWatch({ control: form.control, name: "password" });
  const confirmPasswordValue = useWatch({ control: form.control, name: "confirmPassword" });

  const fields: { name: keyof RegisterFormValues; label: string; type?: string; placeholder: string; autoComplete: string }[] = [
    { name: "fullName", label: "Full name", placeholder: "Your full name", autoComplete: "name" },
    { name: "email",    label: "Email",     type: "email", placeholder: "you@example.com", autoComplete: "email" },
  ];

  if (!hydrated) return null;

  return (
    // Locked to the viewport height on mobile (where AuthBrandPanel is hidden and this is the
    // whole screen) so the card sits fixed and centered instead of the page scrolling under it —
    // matches how a native app's own signup screen behaves. The form panel below still allows its
    // own internal scroll as a fallback for a genuinely short device/landscape/keyboard-open case
    // (this form's expanded field set is the tallest content on either auth screen), so a field or
    // the submit button can never become unreachable, just no longer the default. Desktop reverts
    // to natural page growth — plenty of room there for the two-column layout.
    // The `-env(safe-area-inset-top)` subtraction matters: (auth)/layout.tsx wraps every auth page
    // (this one included) in a `paddingTop: env(safe-area-inset-top)` div for the native status
    // bar. That padding sits outside this div, so on a real notch/status-bar device a plain
    // `100dvh` here would combine with it to exceed the actual viewport by exactly that inset —
    // just enough to force the whole page to scroll again despite `overflow-hidden` below.
    <div className="h-[calc(100dvh-env(safe-area-inset-top,0px))] overflow-hidden lg:h-auto lg:min-h-screen lg:overflow-visible flex bg-background">

      {/* ── Left panel — brand ──────────────────────────────── */}
      <AuthBrandPanel
        gradientClassName="bg-gradient-to-br from-brand-750 via-brand-600 to-[#c9a227]"
        watermarkSide="left"
        eyebrow={EYEBROW}
        headline={<>Start your<br />financial journey</>}
        subcopy="Free, forever — no VC funding, no ads, nothing here to sell you but a better way to track your money."
        perks={PERKS}
        trustLabel="No card required"
        copyrightNote={`© ${new Date().getFullYear()} WealthyNest · All rights reserved`}
      />

      {/* ── Right panel — form ──────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">

        {/* Same mobile brand treatment as LoginForm — see its own comment for why this is a
            compact eyebrow tie-in rather than trying to squeeze the desktop aside's full pitch
            (watermark, gradient, perks) into a phone-width screen. */}
        <div className="lg:hidden flex flex-col items-center mb-8 text-center">
          <div className="flex items-center gap-2.5 mb-2">
            <BrandMark boxClassName="w-9 h-9" iconClassName="w-6 h-6" />
            <span className="text-lg font-bold text-foreground">WealthyNest</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">
            {EYEBROW}
          </p>
        </div>

        {showEmailStep ? (
        <AuthCard>
          <div className="mb-7">
            <h2 className="font-serif text-[27px] font-semibold text-foreground mb-1">Create your account</h2>
            <p className="text-muted-foreground text-sm">It&apos;s free. No card required.</p>
          </div>

          <form onSubmit={form.handleSubmit((v) => register(v))} className="space-y-3">
            {fields.map(({ name, label, type = "text", placeholder, autoComplete }) => (
              <div key={name} className="space-y-1.5">
                <label htmlFor={`signup-${name}`} className="text-xs font-medium text-muted-foreground">{label}</label>
                <input
                  id={`signup-${name}`}
                  data-testid={`signup-${name}-input`}
                  type={type}
                  autoComplete={autoComplete}
                  placeholder={placeholder}
                  autoFocus={name === "fullName"}
                  {...form.register(name)}
                  className={cn(
                    "w-full h-11 px-4 rounded-xl text-sm outline-none transition-all",
                    "bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground",
                    "focus:bg-card focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25",
                    form.formState.errors[name] && "border-red-500/60"
                  )}
                />
                {form.formState.errors[name] && (
                  <p className="text-xs text-red-600 dark:text-red-400">{form.formState.errors[name]?.message}</p>
                )}
              </div>
            ))}

            {/* Password with strength indicator */}
            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <input
                  id="signup-password"
                  data-testid="signup-password-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  {...form.register("password")}
                  className={cn(
                    "w-full h-11 px-4 pr-10 rounded-xl text-sm outline-none transition-all",
                    "bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground",
                    "focus:bg-card focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25",
                    form.formState.errors.password && "border-red-500/60"
                  )}
                />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={passwordValue} />
              <PasswordChecklist password={passwordValue} />
              {form.formState.errors.password && (
                <p className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.password.message}</p>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label htmlFor="signup-confirm-password" className="text-xs font-medium text-muted-foreground">Confirm password</label>
              <div className="relative">
                <input
                  id="signup-confirm-password"
                  data-testid="signup-confirm-password-input"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  {...form.register("confirmPassword")}
                  className={cn(
                    "w-full h-11 px-4 pr-10 rounded-xl text-sm outline-none transition-all",
                    "bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground",
                    "focus:bg-card focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25",
                    form.formState.errors.confirmPassword && "border-red-500/60"
                  )}
                />
                <button type="button" onClick={() => setShowConfirm(p => !p)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPasswordValue ? (
                <PasswordMatch password={passwordValue} confirm={confirmPasswordValue} />
              ) : (
                form.formState.errors.confirmPassword && (
                  <p className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.confirmPassword.message}</p>
                )
              )}
            </div>

            {/* h-12 (48px) — matches the entry screen's own buttons and Login's equivalent submit,
                not the h-11 text inputs above it. */}
            <button data-testid="signup-submit" type="submit" disabled={isPending}
              className={cn(
                "w-full h-12 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 mt-1",
                "bg-gradient-to-br from-brand-600 to-brand-500 text-white",
                "shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)]",
                "hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5",
                "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              )}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? "Creating account…" : "Create account"}
            </button>
          </form>

          <button data-testid="signup-email-back-button" onClick={() => setShowEmailStep(false)}
            className="mt-6 w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </AuthCard>
        ) : (
        <AuthCard>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300 mb-2.5">Get started</p>
          <div className="mb-7">
            <h2 className="font-serif text-[27px] font-semibold text-foreground mb-1">Create your account</h2>
            <p className="text-muted-foreground text-sm">It&apos;s free. No card required.</p>
          </div>

          {/* Google creates the account automatically on first sign-in — same backend path as
              the login page's button, just entered from "Sign up" instead of "Sign in" for
              anyone who wouldn't think to click a "sign in" button before they have an account.
              "Continue with email" leads into the full name/email/password form above, kept as
              its own step rather than shown alongside Google — same "Continue with Google /
              Continue with email" split as the login page. */}
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
            <button data-testid="signup-continue-with-email-button" type="button" onClick={() => setShowEmailStep(true)}
              className="w-full h-12 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2.5
                bg-muted hover:bg-muted/80 text-foreground border border-border">
              <Mail className="w-4 h-4" /> Continue with email
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-600 dark:text-brand-300 hover:text-brand-500 dark:hover:text-brand-200 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </AuthCard>
        )}
        <p className="mt-[18px] flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
          <ShieldCheck className="w-3 h-3" /> Private by design · never sold to advertisers
        </p>
      </div>
    </div>
  );
}
