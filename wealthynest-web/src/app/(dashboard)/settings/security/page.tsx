"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { useChangePassword } from "@/features/auth/hooks/useAuth";
import type { UseFormRegisterReturn } from "react-hook-form";

const schema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword:     z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string().min(1, "Required"),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match", path: ["confirmPassword"],
});
type Values = z.infer<typeof schema>;

function PasswordField({ label, reg, error, placeholder }: {
  label: string;
  reg: UseFormRegisterReturn;
  error?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground block">{label}</label>
      <div className="relative">
        <input
          {...reg}
          type={show ? "text" : "password"}
          className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          placeholder={placeholder ?? "••••••••"}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function SecurityPage() {
  const { mutate: changePassword, isPending } = useChangePassword();
  const [success, setSuccess] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  function onSubmit(values: Values) {
    changePassword(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      { onSuccess: () => { form.reset(); setSuccess(true); setTimeout(() => setSuccess(false), 4000); } }
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Security" />
      <PageWrapper>
        <div className="max-w-lg mx-auto space-y-6">

          <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>

          {/* Icon header */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-16 h-16 rounded-2xl bg-slate-500/10 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-slate-500" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">Change Password</p>
              <p className="text-xs text-muted-foreground mt-1">Use a strong password with letters, numbers and symbols.</p>
            </div>
          </div>

          {success && (
            <div className="text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl px-4 py-3 text-center font-medium">
              Password updated successfully!
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <PasswordField
                label="Current password"
                reg={form.register("currentPassword")}
                error={form.formState.errors.currentPassword?.message}
              />
              <PasswordField
                label="New password"
                reg={form.register("newPassword")}
                error={form.formState.errors.newPassword?.message}
                placeholder="At least 8 characters"
              />
              <PasswordField
                label="Confirm new password"
                reg={form.register("confirmPassword")}
                error={form.formState.errors.confirmPassword?.message}
              />
              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Update password
              </button>
            </form>
          </div>

        </div>
      </PageWrapper>
    </div>
  );
}
