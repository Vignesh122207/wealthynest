"use client";

import {useState} from "react";
import {useForm, useWatch} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import Link from "next/link";
import {Eye, EyeOff, IndianRupee, Loader2, ShieldCheck, Target, Wallet} from "lucide-react";
import {BrandMark} from "@/components/icons/BrandMark";
import {GoogleSignInButton} from "./GoogleSignInButton";
import {type RegisterFormValues, registerSchema} from "../schemas/auth.schema";
import {useRegister} from "../hooks/useAuth";
import {cn} from "@/lib/utils";

const googleClientIdConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

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

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const { mutate: register, isPending } = useRegister();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const passwordValue = useWatch({ control: form.control, name: "password" });

  const fields: { name: keyof RegisterFormValues; label: string; type?: string; placeholder: string; autoComplete: string }[] = [
    { name: "fullName", label: "Full name", placeholder: "Your full name", autoComplete: "name" },
    { name: "email",    label: "Email",     type: "email", placeholder: "you@example.com", autoComplete: "email" },
  ];

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left panel — brand ──────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] shrink-0 relative overflow-hidden
        bg-gradient-to-br from-[#6b4526] via-[#a85f30] to-[#c9a227] p-12">
        <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" aria-hidden />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-20 left-0 w-60 h-60 rounded-full bg-[#e2a877]/10 blur-3xl" />
        </div>

        <div className="relative flex items-center gap-2.5">
          <BrandMark variant="glass" boxClassName="w-9 h-9" iconClassName="w-5 h-5" />
          <span className="text-xl font-bold text-white tracking-tight">WealthyNest</span>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-3xl font-bold text-white leading-snug">
            Start your<br />financial journey
          </h1>
          <p className="text-[#ecc9a3] text-sm leading-relaxed max-w-xs">
            Free, forever — no VC funding, no ads, nothing here to sell you but a better way to
            track your money.
          </p>
          <ul className="space-y-3">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-[#f5e3d3]">
                <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-[#e2a877]">
          © {new Date().getFullYear()} WealthyNest · All rights reserved.
        </p>
      </div>

      {/* ── Right panel — form ──────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        <div className="lg:hidden flex items-center gap-2 mb-8">
          <BrandMark boxClassName="w-8 h-8" iconClassName="w-5 h-5" />
          <span className="text-lg font-bold text-foreground">WealthyNest</span>
        </div>

        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-foreground mb-1">Create account</h2>
            <p className="text-muted-foreground text-sm">It&apos;s free. No card required.</p>
          </div>

          {/* Google creates the account automatically on first sign-in — same backend path as
              the login page's button, just entered from "Sign up" instead of "Sign in" for
              anyone who wouldn't think to click a "sign in" button before they have an account. */}
          {googleClientIdConfigured && (
            <>
              <GoogleSignInButton rememberMe={false} />
              <div className="flex items-center gap-3 py-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground/70">or create an account with email</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

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
                  {...form.register(name)}
                  className={cn(
                    "w-full h-11 px-4 rounded-xl text-sm outline-none transition-all",
                    "bg-background border border-border text-foreground placeholder:text-muted-foreground",
                    "focus:border-[#c2703d] focus:ring-2 focus:ring-[#c2703d]/25",
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
                  placeholder="Min 8 chars, uppercase, number"
                  {...form.register("password")}
                  className={cn(
                    "w-full h-11 px-4 pr-10 rounded-xl text-sm outline-none transition-all",
                    "bg-background border border-border text-foreground placeholder:text-muted-foreground",
                    "focus:border-[#c2703d] focus:ring-2 focus:ring-[#c2703d]/25",
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
                  placeholder="••••••••"
                  {...form.register("confirmPassword")}
                  className={cn(
                    "w-full h-11 px-4 pr-10 rounded-xl text-sm outline-none transition-all",
                    "bg-background border border-border text-foreground placeholder:text-muted-foreground",
                    "focus:border-[#c2703d] focus:ring-2 focus:ring-[#c2703d]/25",
                    form.formState.errors.confirmPassword && "border-red-500/60"
                  )}
                />
                <button type="button" onClick={() => setShowConfirm(p => !p)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <button data-testid="signup-submit" type="submit" disabled={isPending}
              className={cn(
                "w-full h-11 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 mt-1",
                "bg-[#a85f30] hover:bg-[#c2703d] text-white shadow-lg shadow-[#c2703d]/30",
                "hover:shadow-xl hover:shadow-[#c2703d]/40 hover:-translate-y-0.5",
                "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              )}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-[#a85f30] dark:text-[#d98a52] hover:text-[#c2703d] dark:hover:text-[#e2a877] font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
