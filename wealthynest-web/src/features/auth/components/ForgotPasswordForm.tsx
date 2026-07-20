"use client";

import {useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import Link from "next/link";
import {ArrowLeft, CheckCircle2, Loader2, Mail} from "lucide-react";
import {type ForgotPasswordFormValues, forgotPasswordSchema} from "../schemas/auth.schema";
import {useForgotPassword} from "../hooks/useAuth";
import {BrandMark} from "@/components/icons/BrandMark";
import {cn} from "@/lib/utils";

export function ForgotPasswordForm() {
  const [sent, setSent]            = useState(false);
  const [sentEmail, setSentEmail]  = useState("");
  const { mutate, isPending }      = useForgotPassword();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (v: ForgotPasswordFormValues) => {
    mutate(v.email, {
      onSuccess: () => { setSentEmail(v.email); setSent(true); },
    });
  };

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
          <h1 className="text-3xl font-bold text-white leading-snug">Forgot your<br />password?</h1>
          <p className="text-[#ecc9a3] text-sm leading-relaxed max-w-xs">
            No worries — it happens. We&apos;ll send you a secure link to reset it in seconds.
          </p>
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
          {sent ? (
            /* Success state */
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Check your inbox</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  If <span className="text-foreground font-medium">{sentEmail}</span> is registered,
                  you&apos;ll receive a password reset link within a minute.
                  The link expires in <strong className="text-foreground">15 minutes</strong>.
                </p>
              </div>
              <div className="bg-muted/50 border border-border rounded-xl p-4 text-left space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Didn&apos;t get the email?</p>
                <p className="text-xs text-muted-foreground">Check your spam folder, or</p>
                <button
                  type="button"
                  onClick={() => { setSent(false); form.reset(); }}
                  className="text-xs text-[#a85f30] dark:text-[#d98a52] hover:text-[#c2703d] dark:hover:text-[#e2a877] font-medium transition-colors"
                >
                  try again with a different address
                </button>
              </div>
              <Link href="/login"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="mb-7">
                <h2 className="text-2xl font-bold text-foreground mb-1">Reset password</h2>
                <p className="text-muted-foreground text-sm">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="forgot-password-email" className="text-xs font-medium text-muted-foreground">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="forgot-password-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      {...form.register("email")}
                      className={cn(
                        "w-full h-11 pl-10 pr-4 rounded-xl text-sm outline-none transition-all",
                        "bg-background border border-border text-foreground placeholder:text-muted-foreground",
                        "focus:border-[#c2703d] focus:ring-2 focus:ring-[#c2703d]/25",
                        form.formState.errors.email && "border-red-500/60"
                      )}
                    />
                  </div>
                  {form.formState.errors.email && (
                    <p className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.email.message}</p>
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
                  {isPending ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <Link href="/login"
                className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
