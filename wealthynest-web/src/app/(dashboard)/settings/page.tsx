"use client";

import Link from "next/link";
import {
    Bell,
    ChevronRight,
    HelpCircle,
    Lock,
    type LucideIcon,
    Mail,
    Plus,
    RefreshCw,
    ScrollText,
    Shield,
    Sun,
    Tag,
    Ticket,
} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {GlossyBadge, type IconTone, PremiumIcon} from "@/components/icons/PremiumIcon";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {getInitials} from "@/lib/utils";

// ─── Menu item ────────────────────────────────────────────────────────────────

function MenuItem({
  href, icon: Icon, tone, hex, label, description, external,
}: {
  href: string;
  icon: LucideIcon;
  /** Named tone from the Apple system-color palette. Ignored when `hex` is set — same contract as PremiumIcon itself. */
  tone?: IconTone;
  /** Raw hex for a row that needs to match a destination page's exact brand color instead of a named tone. */
  hex?: string;
  label: string;
  description: string;
  external?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-muted/60 transition-colors group">
      <PremiumIcon icon={Icon} tone={tone} hex={hex} size="sm" />
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
  const { user } = useAuthStore();

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
            <GlossyBadge gradient={["#c2703d", "#27272a"]} size="lg">
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
                  icon={Tag} tone="purple"
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
                  icon={Mail} tone="teal"
                  label="Contact Us" description="Email support · reply within 48 hours" />
                <MenuItem href="/settings/support/tickets"
                  icon={Ticket} tone="blue"
                  label="My Tickets" description="View and track your support requests" />
                <MenuItem href="/settings/support/tickets/new"
                  icon={Plus} tone="green"
                  label="Create a Ticket" description="Report a bug or ask a question" />
              </MenuGroup>

              {/* ── Information ─────────────────────────────────── */}
              <MenuGroup label="Information">
                <MenuItem href="/settings/support/faq"
                  icon={HelpCircle} tone="cyan"
                  label="FAQ" description="Answers to common questions" />
                <MenuItem href="/privacy?from=settings"
                  icon={Shield} hex="#935a35"
                  label="Privacy Policy" description="How we handle your data" />
                <MenuItem href="/terms?from=settings"
                  icon={ScrollText} tone="yellow"
                  label="Terms of Service" description="Terms & conditions of use" />
              </MenuGroup>

            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center pb-4">
            WealthyNest · v1.0 · Free forever · No ads · Built for Indian families
          </p>

        </div>
      </PageWrapper>
    </div>
  );
}
