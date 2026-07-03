"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Eye, EyeOff, IndianRupee, Sprout, Loader2, ShieldCheck, Target, Wallet } from "lucide-react";
import { registerSchema, type RegisterFormValues } from "../schemas/auth.schema";
import { useRegister } from "../hooks/useAuth";
import { cn } from "@/lib/utils";

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
  const colors = ["", "bg-red-500", "bg-red-400", "bg-amber-500", "bg-emerald-500", "bg-emerald-400"];
  const textColors = ["", "text-red-400", "text-red-400", "text-amber-400", "text-emerald-400", "text-emerald-400"];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i <= score ? colors[score] : "bg-white/10"
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

  const fields: { name: keyof RegisterFormValues; label: string; type?: string; placeholder: string }[] = [
    { name: "fullName", label: "Full name", placeholder: "Your full name" },
    { name: "email",    label: "Email",     type: "email", placeholder: "you@example.com" },
  ];

  return (
    <div className="min-h-screen flex bg-[#0d0d1a]">

      {/* ── Left panel — brand ──────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] shrink-0 relative overflow-hidden
        bg-gradient-to-br from-violet-600 via-indigo-600 to-[#2563eb] p-12">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-20 left-0 w-60 h-60 rounded-full bg-indigo-300/10 blur-3xl" />
        </div>

        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">WealthyNest</span>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-3xl font-bold text-white leading-snug">
            Start your<br />financial journey
          </h1>
          <p className="text-indigo-200 text-sm leading-relaxed max-w-xs">
            Join thousands of Indian families managing money smarter every day.
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
          © {new Date().getFullYear()} WealthyNest · All rights reserved.
        </p>
      </div>

      {/* ── Right panel — form ──────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
            <Sprout className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">WealthyNest</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-white mb-1">Create account</h2>
            <p className="text-slate-400 text-sm">It&apos;s free. No card required.</p>
          </div>

          <form onSubmit={form.handleSubmit((v) => register(v))} className="space-y-3">
            {fields.map(({ name, label, type = "text", placeholder }) => (
              <div key={name} className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  {...form.register(name)}
                  className={cn(
                    "auth-input w-full h-11 px-4 rounded-xl text-sm outline-none transition-all",
                    "bg-white/5 border border-white/10 text-white placeholder:text-slate-500",
                    "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
                    form.formState.errors[name] && "border-red-500/60"
                  )}
                />
                {form.formState.errors[name] && (
                  <p className="text-xs text-red-400">{form.formState.errors[name]?.message}</p>
                )}
              </div>
            ))}

            {/* Password with strength indicator */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 chars, uppercase, number"
                  {...form.register("password")}
                  className={cn(
                    "auth-input w-full h-11 px-4 pr-10 rounded-xl text-sm outline-none transition-all",
                    "bg-white/5 border border-white/10 text-white placeholder:text-slate-500",
                    "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
                    form.formState.errors.password && "border-red-500/60"
                  )}
                />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={passwordValue} />
              {form.formState.errors.password && (
                <p className="text-xs text-red-400">{form.formState.errors.password.message}</p>
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
                "w-full h-11 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 mt-1",
                "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
