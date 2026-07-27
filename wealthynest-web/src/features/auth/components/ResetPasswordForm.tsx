"use client";

import {useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import Link from "next/link";
import {AlertTriangle, Check, Eye, EyeOff, Loader2, ShieldCheck, X} from "lucide-react";
import {type ResetPasswordFormValues, resetPasswordSchema} from "../schemas/auth.schema";
import {useResetPassword} from "../hooks/useAuth";
import {AuthBrandPanel} from "./AuthBrandPanel";
import {AuthCard} from "./AuthCard";
import {BrandMark} from "@/components/icons/BrandMark";
import {cn} from "@/lib/utils";

interface Props {
  token: string;
}

const EYEBROW = "New password";

const RULES = [
  { test: (p: string) => p.length >= 8,   label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p: string) => /\d/.test(p),    label: "One number" },
];

// Same four rules shown as the panel's "perks" list — a requirements checklist reads naturally in
// the same icon-row shape Login/Signup use for value props, so this reuses AuthBrandPanel as-is
// rather than inventing a second panel layout just for this screen.
const PERKS = RULES.map(({ label }) => ({ icon: ShieldCheck, text: label }));

export function ResetPasswordForm({ token }: Props) {
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate, isPending }         = useResetPassword();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
    mode: "onChange",
  });

  const pw = form.watch("newPassword") ?? "";

  const shell = (card: React.ReactNode) => (
    <div className="h-[calc(100dvh-env(safe-area-inset-top,0px))] overflow-hidden lg:h-auto lg:min-h-screen lg:overflow-visible flex bg-background">
      <AuthBrandPanel
        gradientClassName="bg-gradient-to-br from-brand-700 via-brand-900 to-brand-600"
        watermarkSide="left"
        eyebrow={EYEBROW}
        headline={<>Choose a strong<br />new password</>}
        subcopy="Pick something you haven't used before and make it hard to guess."
        perks={PERKS}
        trustLabel="Link valid for 15 minutes"
        copyrightNote={`© ${new Date().getFullYear()} WealthyNest · Built with ♥`}
      />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="lg:hidden flex flex-col items-center mb-8 text-center">
          <div className="flex items-center gap-2.5 mb-2">
            <BrandMark boxClassName="w-9 h-9" iconClassName="w-6 h-6" />
            <span className="text-lg font-bold text-foreground">WealthyNest</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">
            {EYEBROW}
          </p>
        </div>
        {card}
      </main>
    </div>
  );

  if (!token) {
    return shell(
      <AuthCard className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-foreground mb-1.5">Invalid reset link</h2>
        <p className="text-muted-foreground text-sm mb-6">This link is missing a token. Please request a new password reset.</p>
        <Link href="/forgot-password"
          className="inline-flex h-11 items-center justify-center rounded-xl px-6 font-semibold text-sm text-white transition-all
            bg-gradient-to-br from-brand-600 to-brand-500
            shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)]
            hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5">
          Request new link
        </Link>
      </AuthCard>
    );
  }

  return shell(
    <AuthCard>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300 mb-2.5">Reset</p>
      <div className="mb-7">
        <h2 className="font-serif text-[27px] font-semibold text-foreground mb-1.5 tracking-tight">Set new password</h2>
        <p className="text-muted-foreground text-sm">Your link is valid for 15 minutes.</p>
      </div>

      <form onSubmit={form.handleSubmit((v) => mutate({ token, newPassword: v.newPassword }))} className="space-y-4">

        {/* New password */}
        <div className="space-y-1.5">
          <label htmlFor="reset-new-password" className="text-xs font-medium text-muted-foreground">New password</label>
          <div className="relative">
            <input
              id="reset-new-password"
              data-testid="reset-password-new-input"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              {...form.register("newPassword")}
              className={cn(
                "w-full h-12 px-4 pr-10 rounded-xl text-sm outline-none transition-all",
                "bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground",
                "focus:bg-card focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25",
                form.formState.errors.newPassword && "border-red-500/60"
              )}
            />
            <button type="button" onClick={() => setShowNew(p => !p)}
              aria-label={showNew ? "Hide password" : "Show password"}
              className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground transition-colors">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {pw.length > 0 && (
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {RULES.map(({ test, label }) => {
                const met = test(pw);
                return (
                  <li key={label} className={cn(
                    "flex items-center gap-1.5 text-xs font-medium transition-colors",
                    met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/70"
                  )}>
                    {met ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                    {label}
                  </li>
                );
              })}
            </ul>
          )}

          {form.formState.errors.newPassword && (
            <p className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.newPassword.message}</p>
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <label htmlFor="reset-confirm-password" className="text-xs font-medium text-muted-foreground">Confirm password</label>
          <div className="relative">
            <input
              id="reset-confirm-password"
              data-testid="reset-password-confirm-input"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              {...form.register("confirmPassword")}
              className={cn(
                "w-full h-12 px-4 pr-10 rounded-xl text-sm outline-none transition-all",
                "bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground",
                "focus:bg-card focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25",
                form.formState.errors.confirmPassword && "border-red-500/60"
              )}
            />
            <button type="button" onClick={() => setShowConfirm(p => !p)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground transition-colors">
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {form.formState.errors.confirmPassword && (
            <p className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.confirmPassword.message}</p>
          )}
        </div>

        <button data-testid="reset-password-submit" type="submit" disabled={isPending}
          className={cn(
            "w-full h-12 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 mt-1",
            "bg-gradient-to-br from-brand-600 to-brand-500 text-white",
            "shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)]",
            "hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5",
            "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          )}>
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPending ? "Saving…" : "Set new password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="text-brand-600 dark:text-brand-300 hover:text-brand-500 dark:hover:text-brand-200 font-semibold transition-colors">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
