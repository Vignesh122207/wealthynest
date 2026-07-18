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
    Fingerprint,
    KeyRound,
    Loader2,
    Lock,
    ShieldCheck,
    TrendingUp,
    Wallet
} from "lucide-react";
import {type LoginFormValues, loginSchema} from "../schemas/auth.schema";
import {useLogin, usePasskeyLogin, usePinLogin} from "../hooks/useAuth";
import {useAuthStore} from "../store/auth.store";
import {isWebAuthnSupported} from "../utils/webauthn";
import {GoogleSignInButton} from "./GoogleSignInButton";
import {BrandMark} from "@/components/icons/BrandMark";
import {cn} from "@/lib/utils";

// A still-valid refresh token from a prior full login lets this device skip straight to a PIN
// prompt instead of the full form — see AuthServiceImpl.pinLogin for why a PIN alone (without
// this token) can never be used to sign in from a device that's never logged in here before.
function PinLoginStep({ name, onUsePassword }: { name: string; onUsePassword: () => void }) {
  const [pin, setPin] = useState("");
  const { refreshToken } = useAuthStore();
  const { mutate: pinLogin, isPending } = usePinLogin();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refreshToken || pin.length < 4) return;
    pinLogin({ refreshToken, pin });
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-7 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-6 h-6 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Welcome back, {name.split(" ")[0]}</h2>
        <p className="text-muted-foreground text-sm">Enter your PIN to continue</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          data-testid="login-pin-input"
          type="password"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          value={pin}
          onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="••••"
          className="w-full h-14 px-4 rounded-xl text-center text-2xl tracking-[0.5em] outline-none transition-all
            bg-background border border-border text-foreground placeholder:text-muted-foreground
            focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25"
        />
        <button data-testid="login-pin-submit" type="submit" disabled={isPending || pin.length < 4}
          className="w-full h-11 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
            bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30
            disabled:opacity-60 disabled:cursor-not-allowed">
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPending ? "Verifying…" : "Continue"}
        </button>
      </form>
      <button data-testid="login-pin-use-password" onClick={onUsePassword}
        className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
        Sign in with password instead
      </button>
    </div>
  );
}

// Its own full screen (not an inline expand within the Google/passkey card) — same treatment as
// PinLoginStep, so choosing "password" feels like a deliberate step rather than a cramped
// accordion competing for space with the other two methods.
function PasswordLoginStep({ form, onSubmit, isPending, emailNotVerified, onBack }: {
  form: UseFormReturn<LoginFormValues>;
  onSubmit: (v: LoginFormValues) => void;
  isPending: boolean;
  emailNotVerified: string | null;
  onBack: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-7 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Sign in with password</h2>
        <p className="text-muted-foreground text-sm">Enter your email and password to continue</p>
      </div>

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
          <label className="text-xs font-medium text-muted-foreground">Email</label>
          <input
            data-testid="login-password-step-email-input"
            type="email"
            placeholder="you@example.com"
            autoFocus
            {...form.register("email")}
            className={cn(
              "w-full h-12 px-4 rounded-xl text-sm outline-none transition-all",
              "bg-background border border-border text-foreground placeholder:text-muted-foreground",
              "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
              form.formState.errors.email && "border-red-500/60"
            )}
          />
          {form.formState.errors.email && (
            <p data-testid="login-email-error" className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Password</label>
            <Link href="/forgot-password" className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              data-testid="login-password-step-password-input"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              {...form.register("password")}
              className={cn(
                "w-full h-12 px-4 pr-10 rounded-xl text-sm outline-none transition-all",
                "bg-background border border-border text-foreground placeholder:text-muted-foreground",
                "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
                form.formState.errors.password && "border-red-500/60"
              )}
            />
            <button type="button" onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground transition-colors">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.password.message}</p>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <input
            data-testid="login-remember-me"
            type="checkbox"
            id="rememberMe"
            {...form.register("rememberMe")}
            className="w-4 h-4 rounded border-border bg-background accent-indigo-500 cursor-pointer"
          />
          <label htmlFor="rememberMe" className="text-xs text-muted-foreground cursor-pointer select-none">
            Keep me signed in for 30 days
          </label>
        </div>

        <button data-testid="login-password-submit" type="submit" disabled={isPending}
          className={cn(
            "w-full h-12 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
            "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}>
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <button data-testid="login-back-button" onClick={onBack}
        className="mt-6 w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>
    </div>
  );
}

const PERKS = [
  { icon: Wallet,       text: "Track all your assets in one place" },
  { icon: TrendingUp,   text: "Real-time investment & XIRR tracking" },
  { icon: ShieldCheck,  text: "Fully private — your data stays yours" },
];

export function LoginForm() {
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState<string | null>(null);
  const [usePasswordInstead, setUsePasswordInstead] = useState(false);
  // Snapshot taken once, after the auth store's persisted state has rehydrated on mount —
  // deliberately NOT a live subscription. A fresh login inside this same page lifecycle calls
  // setAuth() (to populate the store for the redirect that follows), and if this read the store
  // reactively, a pinEnabled user would see the PIN screen flash for a frame right after
  // successfully signing in with password/Google/passkey, before router.push("/dashboard")
  // finishes — this only asks "was PIN already set up on this device before I arrived here?".
  const [pinCandidate, setPinCandidate] = useState<{ eligible: boolean; name: string } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { mutate: login, isPending } = useLogin();

  useEffect(() => {
    const { user, refreshToken } = useAuthStore.getState();
    setPinCandidate({ eligible: !!user?.pinEnabled && !!refreshToken, name: user?.fullName ?? "" });
    setHydrated(true);
  }, []);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const showPinStep = hydrated && !usePasswordInstead && !!pinCandidate?.eligible;
  const { mutate: passkeyLogin, isPending: passkeyPending } = usePasskeyLogin();

  const handlePasskeyLogin = () => {
    const email = form.getValues("email");
    if (!email) { form.setError("email", { message: "Enter your email first" }); return; }
    const rememberMe = form.getValues("rememberMe") ?? false;
    passkeyLogin({ email, rememberMe });
  };

  const onSubmit = (v: LoginFormValues) => {
    setEmailNotVerified(null);
    login(v, {
      onError: (e: unknown) => {
        const code = e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
        if (code === "EMAIL_NOT_VERIFIED") setEmailNotVerified(v.email);
      },
    });
  };

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left panel — brand ──────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] shrink-0 relative overflow-hidden
        bg-gradient-to-br from-indigo-600 via-[#4338ca] to-violet-700 p-12">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-10 right-0 w-80 h-80 rounded-full bg-violet-400/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-indigo-300/5 blur-2xl" />
        </div>

        <div className="relative flex items-center gap-2.5">
          <BrandMark variant="glass" boxClassName="w-9 h-9" iconClassName="w-5 h-5" />
          <span className="text-xl font-bold text-white tracking-tight">WealthyNest</span>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-3xl font-bold text-white leading-snug">
            Take charge of<br />your financial life
          </h1>
          <p className="text-indigo-200 text-sm leading-relaxed max-w-xs">
            Everything you need to track, plan and grow your wealth — built for Indian families.
          </p>
          <ul className="space-y-3">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-indigo-100">
                <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-indigo-300">
          © {new Date().getFullYear()} WealthyNest · Built with ♥
        </p>
      </div>

      {/* ── Right panel — form ──────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        <div className="lg:hidden flex items-center gap-2 mb-8">
          <BrandMark boxClassName="w-8 h-8" iconClassName="w-5 h-5" />
          <span className="text-lg font-bold text-foreground">WealthyNest</span>
        </div>

        {showPinStep ? (
          <PinLoginStep name={pinCandidate!.name} onUsePassword={() => setUsePasswordInstead(true)} />
        ) : showPasswordStep ? (
          <PasswordLoginStep form={form} onSubmit={onSubmit} isPending={isPending}
            emailNotVerified={emailNotVerified} onBack={() => setShowPasswordStep(false)} />
        ) : (
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-foreground mb-1.5 tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground text-sm">Sign in to continue to WealthyNest</p>
          </div>

          <div className="bg-card border border-border/80 rounded-2xl shadow-xl shadow-indigo-950/[0.03] dark:shadow-black/40 p-6">
            <div className="space-y-4">
              {/* Email — used by the passkey flow below */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  data-testid="login-email-input"
                  type="email"
                  placeholder="you@example.com"
                  {...form.register("email")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); setShowPasswordStep(true); }
                  }}
                  className={cn(
                    "w-full h-12 px-4 rounded-xl text-sm outline-none transition-all",
                    "bg-background border border-border text-foreground placeholder:text-muted-foreground",
                    "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
                    form.formState.errors.email && "border-red-500/60"
                  )}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.email.message}</p>
                )}
              </div>

              {/* Remember me — applies to whichever method below is used */}
              <div className="flex items-center gap-2.5">
                <input
                  data-testid="login-remember-me"
                  type="checkbox"
                  id="rememberMe"
                  {...form.register("rememberMe")}
                  className="w-4 h-4 rounded border-border bg-background accent-indigo-500 cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Keep me signed in for 30 days
                </label>
              </div>

              {/* Google */}
              <GoogleSignInButton rememberMe={form.watch("rememberMe") ?? false} />

              {/* Passkey */}
              {isWebAuthnSupported() && (
                <button data-testid="login-passkey-button" type="button" onClick={handlePasskeyLogin} disabled={passkeyPending}
                  className="w-full h-11 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2
                    bg-muted hover:bg-muted/80 text-foreground disabled:opacity-60 disabled:cursor-not-allowed">
                  {passkeyPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                  {passkeyPending ? "Follow your device's prompt…" : "Sign in with a passkey"}
                </button>
              )}

              {/* Password — its own full screen, not an inline expand here */}
              <button data-testid="login-use-password-button" type="button" onClick={() => setShowPasswordStep(true)}
                className="w-full h-11 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2
                  text-muted-foreground hover:text-foreground hover:bg-muted/60">
                <Lock className="w-3.5 h-3.5" /> Sign in with password
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold transition-colors">
              Create one
            </Link>
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
