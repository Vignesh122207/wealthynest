"use client";

import Link from "next/link";
import {
    Bell,
    ChevronRight,
    FileText,
    HelpCircle,
    Lock,
    LogOut,
    type LucideIcon,
    Mail,
    Plus,
    RefreshCw,
    Shield,
    Sun,
    Tag,
    Ticket,
    Trash2,
} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {GlossyBadge, type IconTone, PremiumIcon} from "@/components/icons/PremiumIcon";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useCloseAccount, useLogout} from "@/features/auth/hooks/useAuth";
import {getInitials} from "@/lib/utils";
import {useState} from "react";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";

// ─── Menu item ────────────────────────────────────────────────────────────────

function MenuItem({
  href, icon: Icon, tone, label, description, external,
}: {
  href: string;
  icon: LucideIcon;
  tone: IconTone;
  label: string;
  description: string;
  external?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-muted/60 transition-colors group">
      <PremiumIcon icon={Icon} tone={tone} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
    </div>
  );
  if (external) return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
  return <Link href={href}>{inner}</Link>;
}

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1.5">
        {label}
      </p>
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user }          = useAuthStore();
  const { mutate: logout } = useLogout();
  const { mutate: closeAccount } = useCloseAccount();
  const [showLogout, setShowLogout]   = useState(false);
  const [showClose,  setShowClose]    = useState(false);

  function roleBadge(role?: string) {
    const map: Record<string, string> = {
      ADMIN:        "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      FAMILY_ADMIN: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      MEMBER:       "bg-slate-500/15 text-slate-600 dark:text-slate-400",
    };
    return map[role ?? "MEMBER"] ?? map.MEMBER;
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Settings" subtitle="Manage your account, preferences, and app behavior" />
      <PageWrapper>
        <div className="space-y-6">

          {/* ── Profile Card ─────────────────────────────────────── */}
          <Link
            href="/settings/profile"
            className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:bg-muted/40 transition-colors group"
          >
            <GlossyBadge gradient={["#6366f1", "#7c3aed"]} size="lg">
              <span className="text-xl font-bold text-white select-none">{user ? getInitials(user.fullName) : "?"}</span>
            </GlossyBadge>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-foreground truncate">{user?.fullName ?? "—"}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email ?? "—"}</p>
              {user?.role && user.role !== "MEMBER" && (
              <span className={`inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${roleBadge(user.role)}`}>
                {user.role.toLowerCase().replaceAll("_", " ")}
              </span>
            )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
          </Link>

          {/* ── Two-column grid on desktop ────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left column */}
            <div className="space-y-4">

              {/* ── Account ─────────────────────────────────────── */}
              {/* Profile lives in its own card above — no need for a second entry here. */}
              <MenuGroup label="Account">
                <MenuItem href="/settings/security"
                  icon={Lock} tone="gray"
                  label="Security" description="Change your password" />
              </MenuGroup>

              {/* ── Preferences ─────────────────────────────────── */}
              <MenuGroup label="Preferences">
                <MenuItem href="/settings/appearance"
                  icon={Sun} tone="orange"
                  label="Appearance" description="Dark mode, light mode, and currency" />
                <MenuItem href="/settings/notifications"
                  icon={Bell} tone="pink"
                  label="Notifications" description="Budget alerts, goals, and maturity reminders" />
                <MenuItem href="/settings/categories"
                  icon={Tag} tone="violet"
                  label="Categories" description="Manage expense and income categories" />
                <MenuItem href="/settings/recurring"
                  icon={RefreshCw} tone="indigo"
                  label="Recurring Rules" description="Auto-credit income, log bills, move money, and fund goals" />
              </MenuGroup>

            </div>

            {/* Right column */}
            <div className="space-y-4">

              {/* ── Get Help ────────────────────────────────────── */}
              <MenuGroup label="Get Help">
                <MenuItem href="/settings/support/contact"
                  icon={Mail} tone="indigo"
                  label="Contact Us" description="Email support · reply within 48 hours" />
                <MenuItem href="/settings/support/tickets"
                  icon={Ticket} tone="violet"
                  label="My Tickets" description="View and track your support requests" />
                <MenuItem href="/settings/support/tickets/new"
                  icon={Plus} tone="emerald"
                  label="Create a Ticket" description="Report a bug or ask a question" />
              </MenuGroup>

              {/* ── Information ─────────────────────────────────── */}
              <MenuGroup label="Information">
                <MenuItem href="/settings/support/faq"
                  icon={HelpCircle} tone="cyan"
                  label="FAQ" description="Answers to common questions" />
                <MenuItem href="/privacy"
                  icon={Shield} tone="gray"
                  label="Privacy Policy" description="How we handle your data" />
                <MenuItem href="/terms"
                  icon={FileText} tone="gray"
                  label="Terms of Service" description="Terms & conditions of use" />
              </MenuGroup>

            </div>
          </div>

          {/* ── Danger zone (full-width) ──────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-widest px-1 mb-1.5">Danger Zone</p>
            <div className="bg-card border border-red-500/20 rounded-2xl overflow-hidden divide-y divide-border/60">
              <button
                onClick={() => setShowLogout(true)}
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

          <p className="text-[11px] text-muted-foreground text-center pb-4">
            WealthyNest · v1.0 · Free forever · No ads · Built for Indian families
          </p>

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
