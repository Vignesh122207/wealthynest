"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sprout, Loader2, CheckCircle2, XCircle, Mail, RefreshCw } from "lucide-react";
import { useVerifyEmail, useResendVerification } from "@/features/auth/hooks/useAuth";

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
      onError: (e: any) => {
        setStatus("error");
        setErrorMsg(e?.response?.data?.message ?? "Verification failed. The link may have expired.");
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="w-full max-w-md text-center space-y-6">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2.5 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <Sprout className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">WealthyNest</span>
      </div>

      {/* Verifying state */}
      {status === "verifying" && (
        <div className="space-y-4">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto" />
          <p className="text-white font-semibold text-lg">Verifying your email…</p>
          <p className="text-slate-400 text-sm">This will only take a moment.</p>
        </div>
      )}

      {/* Success state */}
      {status === "success" && (
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-white font-bold text-2xl">Email verified!</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
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
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-white font-bold text-2xl">Verification failed</h1>
          <p className="text-slate-400 text-sm leading-relaxed">{errorMsg}</p>
          {email && (
            <button
              onClick={() => resend(email)}
              disabled={resending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Resend verification email
            </button>
          )}
          <div className="pt-1">
            <Link href="/login" className="text-sm text-slate-400 hover:text-slate-300 transition-colors">
              Back to sign in
            </Link>
          </div>
        </div>
      )}

      {/* Idle state — no token, just showing "check your email" */}
      {status === "idle" && (
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-indigo-500/15 flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-white font-bold text-2xl">Check your inbox</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            {email
              ? <>We sent a verification link to <span className="text-white">{email}</span>. Click the link to activate your account.</>
              : "A verification link was sent to your email address. Click it to activate your account."}
          </p>
          <p className="text-xs text-slate-500">
            Didn&apos;t get it? Check your spam folder or{" "}
            {email ? (
              <button
                onClick={() => resend(email)}
                disabled={resending}
                className="underline text-indigo-400 hover:text-indigo-300 disabled:opacity-60"
              >
                {resending ? "sending…" : "resend the email"}
              </button>
            ) : (
              <Link href="/login" className="underline text-indigo-400 hover:text-indigo-300">
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d0d1a] px-4">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
