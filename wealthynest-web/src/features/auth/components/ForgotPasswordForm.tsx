"use client";

import {useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import Link from "next/link";
import {ArrowLeft, CheckCircle2, Clock, Loader2, Mail, ShieldCheck} from "lucide-react";
import {type ForgotPasswordFormValues, forgotPasswordSchema} from "../schemas/auth.schema";
import {useForgotPassword} from "../hooks/useAuth";
import {AuthBrandPanel} from "./AuthBrandPanel";
import {AuthCard} from "./AuthCard";
import {BrandMark} from "@/components/icons/BrandMark";
import {cn} from "@/lib/utils";

const EYEBROW = "Account recovery";

const PERKS = [
  { icon: Mail,        text: "Reset link sent straight to your inbox" },
  { icon: Clock,       text: "Link expires in 15 minutes, for safety" },
  { icon: ShieldCheck, text: "Your account stays protected the whole time" },
];

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
    // Same shared shell as Login/Signup — see LoginForm's own comment for the fuller reasoning on
    // the viewport lock and the safe-area-inset subtraction.
    <div className="h-[calc(100dvh-env(safe-area-inset-top,0px))] overflow-hidden lg:h-auto lg:min-h-screen lg:overflow-visible flex bg-background">

      {/* ── Left panel — brand ──────────────────────────────── */}
      <AuthBrandPanel
        gradientClassName="bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500"
        watermarkSide="right"
        eyebrow={EYEBROW}
        headline={<>Forgot your<br />password?</>}
        subcopy="No worries — it happens. Enter your email and we'll send you a secure link to get back in."
        perks={PERKS}
        trustLabel="We never see your password"
        copyrightNote={`© ${new Date().getFullYear()} WealthyNest · Built with ♥`}
      />

      {/* ── Right panel — form ──────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">

        {/* Same mobile brand treatment as Login/Signup — see LoginForm's own comment for why this
            is a compact eyebrow tie-in rather than the full desktop panel squeezed down. */}
        <div className="lg:hidden flex flex-col items-center mb-8 text-center">
          <div className="flex items-center gap-2.5 mb-2">
            <BrandMark boxClassName="w-9 h-9" iconClassName="w-6 h-6" />
            <span className="text-lg font-bold text-foreground">WealthyNest</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">
            {EYEBROW}
          </p>
        </div>

        {sent ? (
          <AuthCard>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-foreground mb-1.5">Check your inbox</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                If <span className="text-foreground font-medium">{sentEmail}</span> is registered,
                you&apos;ll receive a password reset link within a minute.
                The link expires in <strong className="text-foreground">15 minutes</strong>.
              </p>
            </div>

            <div className="mt-6 bg-muted/50 border border-border rounded-xl p-4 text-left space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Didn&apos;t get the email?</p>
              <p className="text-xs text-muted-foreground">Check your spam folder, or</p>
              <button
                type="button"
                data-testid="forgot-password-try-again"
                onClick={() => { setSent(false); form.reset(); }}
                className="text-xs text-brand-600 dark:text-brand-300 hover:text-brand-500 dark:hover:text-brand-200 font-medium transition-colors"
              >
                try again with a different address
              </button>
            </div>

            <Link href="/login" data-testid="forgot-password-back-to-login"
              className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </Link>
          </AuthCard>
        ) : (
          <AuthCard>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300 mb-2.5">Reset</p>
            <div className="mb-7">
              <h2 className="font-serif text-[27px] font-semibold text-foreground mb-1.5 tracking-tight">Reset password</h2>
              <p className="text-muted-foreground text-sm">Enter your email and we&apos;ll send you a reset link.</p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="forgot-password-email" className="text-xs font-medium text-muted-foreground">Email address</label>
                <input
                  id="forgot-password-email"
                  data-testid="forgot-password-email-input"
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
                  <p className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.email.message}</p>
                )}
              </div>

              <button data-testid="forgot-password-submit" type="submit" disabled={isPending}
                className={cn(
                  "w-full h-12 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                  "bg-gradient-to-br from-brand-600 to-brand-500 text-white",
                  "shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)]",
                  "hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5",
                  "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                )}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {isPending ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <Link href="/login"
              className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </Link>
          </AuthCard>
        )}
        <p className="mt-[18px] flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
          <ShieldCheck className="w-3 h-3" /> Private by design · never sold to advertisers
        </p>
      </main>
    </div>
  );
}
