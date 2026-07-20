"use client";

import {useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import Link from "next/link";
import {AlertTriangle, Eye, EyeOff, Loader2, ShieldCheck} from "lucide-react";
import {type ResetPasswordFormValues, resetPasswordSchema} from "../schemas/auth.schema";
import {useResetPassword} from "../hooks/useAuth";
import {BrandMark} from "@/components/icons/BrandMark";
import {cn} from "@/lib/utils";

interface Props {
  token: string;
}

const RULES = [
  { test: (p: string) => p.length >= 8,           label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p),         label: "Uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p),         label: "Lowercase letter" },
  { test: (p: string) => /\d/.test(p),            label: "Number" },
];

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

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Invalid reset link</h2>
          <p className="text-muted-foreground text-sm">This link is missing a token. Please request a new password reset.</p>
          <Link href="/forgot-password"
            className="inline-block bg-[#a85f30] hover:bg-[#c2703d] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all">
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] shrink-0 relative overflow-hidden
        bg-gradient-to-br from-[#a85f30] via-[#8a4a26] to-[#52341f] p-12">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-10 right-0 w-80 h-80 rounded-full bg-[#a8794f]/10 blur-3xl" />
        </div>
        <div className="relative flex items-center gap-2.5">
          <BrandMark variant="glass" boxClassName="w-9 h-9" iconClassName="w-5 h-5" />
          <span className="text-xl font-bold text-white tracking-tight">WealthyNest</span>
        </div>
        <div className="relative space-y-4">
          <h1 className="text-3xl font-bold text-white leading-snug">Choose a strong<br />new password</h1>
          <p className="text-[#ecc9a3] text-sm leading-relaxed max-w-xs">
            Pick something you haven&apos;t used before and make it hard to guess.
          </p>
          <ul className="space-y-2 pt-2">
            {RULES.map(({ label }) => (
              <li key={label} className="flex items-center gap-2 text-xs text-[#ecc9a3]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#e2a877]">
          © {new Date().getFullYear()} WealthyNest · Built with ♥
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <BrandMark boxClassName="w-8 h-8" iconClassName="w-5 h-5" />
          <span className="text-lg font-bold text-foreground">WealthyNest</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-foreground mb-1">Set new password</h2>
            <p className="text-muted-foreground text-sm">Your link is valid for 15 minutes.</p>
          </div>

          <form onSubmit={form.handleSubmit((v) => mutate({ token, newPassword: v.newPassword }))} className="space-y-4">

            {/* New password */}
            <div className="space-y-1.5">
              <label htmlFor="reset-new-password" className="text-xs font-medium text-muted-foreground">New password</label>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...form.register("newPassword")}
                  className={cn(
                    "w-full h-11 px-4 pr-10 rounded-xl text-sm outline-none transition-all",
                    "bg-background border border-border text-foreground placeholder:text-muted-foreground",
                    "focus:border-[#c2703d] focus:ring-2 focus:ring-[#c2703d]/25",
                    form.formState.errors.newPassword && "border-red-500/60"
                  )}
                />
                <button type="button" onClick={() => setShowNew(p => !p)}
                  aria-label={showNew ? "Hide password" : "Show password"}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength checklist */}
              {pw.length > 0 && (
                <div className="grid grid-cols-2 gap-1 pt-1">
                  {RULES.map(({ test, label }) => (
                    <div key={label} className={cn("flex items-center gap-1.5 text-[11px]",
                      test(pw) ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50")}>
                      <span>{test(pw) ? "✓" : "○"}</span>
                      {label}
                    </div>
                  ))}
                </div>
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

            <button type="submit" disabled={isPending}
              className={cn(
                "w-full h-11 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 mt-2",
                "bg-[#a85f30] hover:bg-[#c2703d] text-white shadow-lg shadow-[#c2703d]/30",
                "hover:shadow-xl hover:shadow-[#c2703d]/40 hover:-translate-y-0.5",
                "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              )}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? "Saving…" : "Set new password"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link href="/login" className="text-[#a85f30] dark:text-[#d98a52] hover:text-[#c2703d] dark:hover:text-[#e2a877] font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
