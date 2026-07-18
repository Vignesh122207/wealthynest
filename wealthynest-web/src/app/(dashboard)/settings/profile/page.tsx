"use client";

import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {ArrowLeft, Loader2, Lock} from "lucide-react";
import Link from "next/link";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {GlossyBadge} from "@/components/icons/PremiumIcon";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useUpdateProfile} from "@/features/auth/hooks/useAuth";
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

          <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 bg-card border border-border rounded-2xl py-8">
            <GlossyBadge gradient={["#6366f1", "#7c3aed"]} size="xl">
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
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors mt-2"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save changes
              </button>
            </form>
          </div>

        </div>
      </PageWrapper>
    </div>
  );
}
