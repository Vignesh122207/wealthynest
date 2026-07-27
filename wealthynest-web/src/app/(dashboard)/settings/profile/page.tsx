"use client";

import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {Loader2, Lock, LogOut, Trash2} from "lucide-react";
import Link from "next/link";
import {useState} from "react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {GlossyBadge, PremiumIcon} from "@/components/icons/PremiumIcon";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useCloseAccount, useLogout, useUpdateProfile} from "@/features/auth/hooks/useAuth";
import {getInitials} from "@/lib/utils";

const schema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
});
type Values = z.infer<typeof schema>;

function roleBadge(role?: string) {
  const map: Record<string, string> = {
    ADMIN:        "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    FAMILY_ADMIN: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    MEMBER:       "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  };
  return map[role ?? "MEMBER"] ?? map.MEMBER;
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const { mutate: logout } = useLogout();
  const { mutate: closeAccount } = useCloseAccount();
  const [showLogout, setShowLogout] = useState(false);
  const [showClose, setShowClose] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: user?.fullName ?? "" },
  });

  function onSubmit(values: Values) { updateProfile(values); }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Profile" subtitle="Update your personal details and account info" />
      <PageWrapper>
        <div className="max-w-lg md:max-w-3xl mx-auto space-y-6">

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 bg-card border border-border rounded-2xl py-8">
            <GlossyBadge gradient={["#c2703d", "#27272a"]} size="xl">
              <span className="text-xl font-bold text-white select-none">{user ? getInitials(user.fullName) : "?"}</span>
            </GlossyBadge>
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
              {user?.role && user.role !== "MEMBER" && (
                <span className={`inline-block mt-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${roleBadge(user.role)}`}>
                  {user.role.toLowerCase().replace("_", " ")}
                </span>
              )}
            </div>
          </div>

          {/* Edit form */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit details</p>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground block">Full name</label>
                <input
                  {...form.register("fullName")}
                  data-testid="profile-fullname-input"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="Your full name"
                />
                {form.formState.errors.fullName && (
                  <p className="text-xs text-red-600 dark:text-red-400">{form.formState.errors.fullName.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground block">Email address</label>
                <div className="w-full flex items-center justify-between gap-3 bg-muted/40 border border-border rounded-xl px-3 py-2.5">
                  <span className="text-sm text-foreground truncate">{user?.email}</span>
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                </div>
                {user?.pendingEmail ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Verification pending for {user.pendingEmail} —{" "}
                    <Link href="/settings/security" className="underline hover:text-amber-500">check Settings → Security</Link>.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/70">
                    To change your email,{" "}
                    <Link href="/settings/security" className="text-indigo-600 dark:text-indigo-400 hover:underline">go to Settings → Security</Link>.
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={isPending}
                data-testid="profile-form-submit"
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all mt-2
                  bg-gradient-to-br from-brand-600 to-brand-500 text-white
                  shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)]
                  hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save changes
              </button>
            </form>
          </div>

          {/* ── Danger zone — relocated here from Settings, next to the identity it affects ── */}
          <div>
            <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-widest px-1 mb-1.5">Danger Zone</p>
            <div className="bg-card border border-red-500/20 rounded-2xl overflow-hidden divide-y divide-border/60">
              <button
                onClick={() => setShowLogout(true)}
                data-testid="profile-signout-trigger"
                className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-red-500/5 transition-colors text-left"
              >
                <PremiumIcon icon={LogOut} tone="red" size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Sign out</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sign out of your account on this device</p>
                </div>
              </button>
              <button
                onClick={() => setShowClose(true)}
                data-testid="profile-close-account-trigger"
                className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-red-500/5 transition-colors text-left"
              >
                <PremiumIcon icon={Trash2} tone="red" size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Close account</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Deactivate your account — data retained, admin must reactivate</p>
                </div>
              </button>
            </div>
          </div>

        </div>
      </PageWrapper>

      {showLogout && (
        <ConfirmDialog open title="Sign out?"
          description="You'll be signed out from this device. You can sign back in at any time."
          confirmLabel="Sign out" danger
          onConfirm={() => logout()}
          onCancel={() => setShowLogout(false)} />
      )}

      {showClose && (
        <ConfirmDialog open title="Close your account?"
          description="Your account will be deactivated immediately and you will be signed out. Your data is retained. Only an admin can reactivate your account."
          confirmLabel="Yes, close account" danger
          typeToConfirm="CLOSE"
          onConfirm={() => closeAccount()}
          onCancel={() => setShowClose(false)} />
      )}
    </div>
  );
}
