"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Eye, EyeOff, Sprout, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordFormValues } from "../schemas/auth.schema";
import { useResetPassword } from "../hooks/useAuth";
import { cn } from "@/lib/utils";

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
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d1a] px-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Invalid reset link</h2>
          <p className="text-slate-400 text-sm">This link is missing a token. Please request a new password reset.</p>
          <Link href="/forgot-password"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all">
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#0d0d1a]">

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] shrink-0 relative overflow-hidden
        bg-gradient-to-br from-indigo-600 via-[#4338ca] to-violet-700 p-12">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-10 right-0 w-80 h-80 rounded-full bg-violet-400/10 blur-3xl" />
        </div>
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">WealthyNest</span>
        </div>
        <div className="relative space-y-4">
          <h1 className="text-3xl font-bold text-white leading-snug">Choose a strong<br />new password</h1>
          <p className="text-indigo-200 text-sm leading-relaxed max-w-xs">
            Pick something you haven&apos;t used before and make it hard to guess.
          </p>
          <ul className="space-y-2 pt-2">
            {RULES.map(({ label }) => (
              <li key={label} className="flex items-center gap-2 text-xs text-indigo-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-indigo-300">
          © {new Date().getFullYear()} WealthyNest · Built with ♥
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
            <Sprout className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">WealthyNest</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-white mb-1">Set new password</h2>
            <p className="text-slate-400 text-sm">Your link is valid for 15 minutes.</p>
          </div>

          <form onSubmit={form.handleSubmit((v) => mutate({ token, newPassword: v.newPassword }))} className="space-y-4">

            {/* New password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">New password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  placeholder="••••••••"
                  {...form.register("newPassword")}
                  className={cn(
                    "auth-input w-full h-11 px-4 pr-10 rounded-xl text-sm outline-none transition-all",
                    "bg-white/5 border border-white/10 text-white placeholder:text-slate-500",
                    "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
                    form.formState.errors.newPassword && "border-red-500/60"
                  )}
                />
                <button type="button" onClick={() => setShowNew(p => !p)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition-colors">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength checklist */}
              {pw.length > 0 && (
                <div className="grid grid-cols-2 gap-1 pt-1">
                  {RULES.map(({ test, label }) => (
                    <div key={label} className={cn("flex items-center gap-1.5 text-[11px]",
                      test(pw) ? "text-emerald-400" : "text-slate-600")}>
                      <span>{test(pw) ? "✓" : "○"}</span>
                      {label}
                    </div>
                  ))}
                </div>
              )}

              {form.formState.errors.newPassword && (
                <p className="text-xs text-red-400">{form.formState.errors.newPassword.message}</p>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  {...form.register("confirmPassword")}
                  className={cn(
                    "auth-input w-full h-11 px-4 pr-10 rounded-xl text-sm outline-none transition-all",
                    "bg-white/5 border border-white/10 text-white placeholder:text-slate-500",
                    "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
                    form.formState.errors.confirmPassword && "border-red-500/60"
                  )}
                />
                <button type="button" onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-red-400">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <button type="submit" disabled={isPending}
              className={cn(
                "w-full h-11 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 mt-2",
                "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? "Saving…" : "Set new password"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Remembered it?{" "}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
