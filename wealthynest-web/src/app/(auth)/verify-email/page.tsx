"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle, Mail, RefreshCw } from "lucide-react";
import { useVerifyEmail, useResendVerification } from "@/features/auth/hooks/useAuth";
import { apiErrorMessage } from "@/lib/utils";
import { BrandMark } from "@/components/icons/BrandMark";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">(
    token ? "verifying" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  const { mutate: verify }  = useVerifyEmail();
  const { mutate: resend, isPending: resending } = useResendVerification();

  useEffect(() => {
    if (!token) return;
    setStatus("verifying");
    verify(token, {
      onSuccess: () => setStatus("success"),
      onError: (e: unknown) => {
        setStatus("error");
        setErrorMsg(apiErrorMessage(e, "Verification failed. The link may have expired."));
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="w-full max-w-md text-center space-y-6">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2.5 mb-8">
        <BrandMark boxClassName="w-10 h-10" iconClassName="w-5 h-5" />
        <span className="text-xl font-bold text-foreground tracking-tight">WealthyNest</span>
      </div>

      {/* Verifying state */}
      {status === "verifying" && (
        <div className="space-y-4">
          <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
          <p className="text-foreground font-semibold text-lg">Verifying your email…</p>
          <p className="text-muted-foreground text-sm">This will only take a moment.</p>
        </div>
      )}

      {/* Success state */}
      {status === "success" && (
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-foreground font-bold text-2xl">Email verified!</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your email has been verified. You can now sign in to your account.
          </p>
          <Link
            href="/login"
            className="inline-block mt-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
          >
            Sign in
          </Link>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-foreground font-bold text-2xl">Verification failed</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{errorMsg}</p>
          {email && (
            <button
              onClick={() => resend(email)}
              disabled={resending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground text-sm font-medium transition-colors disabled:opacity-60"
            >
              {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Resend verification email
            </button>
          )}
          <div className="pt-1">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Back to sign in
            </Link>
          </div>
        </div>
      )}

      {/* Idle state — no token, just showing "check your email" */}
      {status === "idle" && (
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-indigo-500/15 flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-foreground font-bold text-2xl">Check your inbox</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {email
              ? <>We sent a verification link to <span className="text-foreground">{email}</span>. Click the link to activate your account.</>
              : "A verification link was sent to your email address. Click it to activate your account."}
          </p>
          <p className="text-xs text-muted-foreground/70">
            Didn&apos;t get it? Check your spam folder or{" "}
            {email ? (
              <button
                onClick={() => resend(email)}
                disabled={resending}
                className="underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 disabled:opacity-60"
              >
                {resending ? "sending…" : "resend the email"}
              </button>
            ) : (
              <Link href="/login" className="underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
                go back to sign in
              </Link>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
