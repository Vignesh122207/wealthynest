"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Eye, EyeOff, Sprout, Loader2, ShieldCheck, TrendingUp, Wallet, AlertTriangle } from "lucide-react";
import { loginSchema, type LoginFormValues } from "../schemas/auth.schema";
import { useLogin } from "../hooks/useAuth";
import { cn } from "@/lib/utils";

const PERKS = [
  { icon: Wallet,       text: "Track all your assets in one place" },
  { icon: TrendingUp,   text: "Real-time investment & XIRR tracking" },
  { icon: ShieldCheck,  text: "Fully private — your data stays yours" },
];

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState<string | null>(null);
  const { mutate: login, isPending } = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = (v: LoginFormValues) => {
    setEmailNotVerified(null);
    login(v, {
      onError: (e: any) => {
        if (e?.response?.data?.error === "EMAIL_NOT_VERIFIED") {
          setEmailNotVerified(v.email);
        }
      },
    });
  };

  return (
    <div className="min-h-screen flex bg-[#0d0d1a]">

      {/* ── Left panel — brand ──────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] shrink-0 relative overflow-hidden
        bg-gradient-to-br from-indigo-600 via-[#4338ca] to-violet-700 p-12">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-10 right-0 w-80 h-80 rounded-full bg-violet-400/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-indigo-300/5 blur-2xl" />
        </div>

        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Sprout className="w-5 h-5 text-white" />
          </div>
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
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
            <Sprout className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">WealthyNest</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-slate-400 text-sm">Sign in to your account</p>
          </div>

          {/* Email not verified banner */}
          {emailNotVerified && (
            <div className="mb-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-300">
                <p className="font-medium mb-1">Email not verified</p>
                <p className="text-amber-400/80">
                  Check your inbox for a verification link.{" "}
                  <Link
                    href={`/verify-email?email=${encodeURIComponent(emailNotVerified)}`}
                    className="underline text-amber-300 hover:text-amber-200"
                  >
                    Resend email
                  </Link>
                </p>
              </div>
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                {...form.register("email")}
                className={cn(
                  "auth-input w-full h-11 px-4 rounded-xl text-sm outline-none transition-all",
                  "bg-white/5 border border-white/10 text-white placeholder:text-slate-500",
                  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
                  form.formState.errors.email && "border-red-500/60"
                )}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-400">{form.formState.errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <Link href="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
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
              {form.formState.errors.password && (
                <p className="text-xs text-red-400">{form.formState.errors.password.message}</p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="rememberMe"
                {...form.register("rememberMe")}
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-indigo-500 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-xs text-slate-400 cursor-pointer select-none">
                Keep me signed in for 30 days
              </label>
            </div>

            <button type="submit" disabled={isPending}
              className={cn(
                "w-full h-11 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 mt-2",
                "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
