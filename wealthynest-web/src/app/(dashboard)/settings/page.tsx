"use client";

import Link from "next/link";
import {
  User, Lock, Bell, Sun, Download, Tag, RefreshCw,
  Mail, Ticket, Plus, HelpCircle, Shield, FileText, Coffee,
  LogOut, Trash2, ChevronRight,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useLogout, useCloseAccount } from "@/features/auth/hooks/useAuth";
import { getInitials } from "@/lib/utils";
import { useState } from "react";
import { Loader2, AlertTriangle, X } from "lucide-react";

// ─── Menu item ────────────────────────────────────────────────────────────────

function MenuItem({
  href, icon: Icon, iconBg, label, description, external,
}: {
  href: string;
  icon: React.ElementType;
  iconBg: string;
  label: string;
  description: string;
  external?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-muted/60 transition-colors group">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
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

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, confirmClass, onConfirm, onCancel, loading,
}: {
  title: string; message: string; confirmLabel: string; confirmClass: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{message}</p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="text-sm px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-60 ${confirmClass}`}>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user }          = useAuthStore();
  const { mutate: logout, isPending: loggingOut } = useLogout();
  const { mutate: closeAccount, isPending: closingAccount } = useCloseAccount();
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
      <Header title="Settings" />
      <PageWrapper>
        <div className="max-w-lg mx-auto space-y-6">

          {/* ── Profile Card ─────────────────────────────────────── */}
          <Link
            href="/settings/profile"
            className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:bg-muted/40 transition-colors group"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl font-bold text-white shrink-0 select-none shadow-lg shadow-indigo-500/20">
              {user ? getInitials(user.fullName) : "?"}
            </div>
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

          {/* ── Account ──────────────────────────────────────────── */}
          <MenuGroup label="Account">
            <MenuItem href="/settings/profile"
              icon={User} iconBg="bg-indigo-500"
              label="Profile" description="Edit your name and email address" />
            <MenuItem href="/settings/security"
              icon={Lock} iconBg="bg-slate-500"
              label="Security" description="Change your password" />
          </MenuGroup>

          {/* ── Preferences ──────────────────────────────────────── */}
          <MenuGroup label="Preferences">
            <MenuItem href="/settings/appearance"
              icon={Sun} iconBg="bg-amber-500"
              label="Appearance" description="Dark mode, light mode, and currency" />
            <MenuItem href="/settings/notifications"
              icon={Bell} iconBg="bg-rose-500"
              label="Notifications" description="Budget alerts, goals, and maturity reminders" />
            <MenuItem href="/settings/categories"
              icon={Tag} iconBg="bg-violet-500"
              label="Categories" description="Manage expense and income categories" />
            <MenuItem href="/settings/recurring"
              icon={RefreshCw} iconBg="bg-indigo-500"
              label="Recurring Income" description="Auto-credit salary and monthly income" />
          </MenuGroup>

          {/* ── Data ─────────────────────────────────────────────── */}
          <MenuGroup label="Data">
            <MenuItem href="/reports"
              icon={Download} iconBg="bg-emerald-500"
              label="Reports & Exports" description="Monthly and annual reports, CSV downloads" />
          </MenuGroup>

          {/* ── Get Help ─────────────────────────────────────────── */}
          <MenuGroup label="Get Help">
            <MenuItem href="/settings/support/contact"
              icon={Mail} iconBg="bg-indigo-500"
              label="Contact Us" description="Email support · reply within 48 hours" />
            <MenuItem href="/settings/support/tickets"
              icon={Ticket} iconBg="bg-violet-500"
              label="My Tickets" description="View and track your support requests" />
            <MenuItem href="/settings/support/tickets/new"
              icon={Plus} iconBg="bg-emerald-500"
              label="Create a Ticket" description="Report a bug or ask a question" />
          </MenuGroup>

          {/* ── Information ──────────────────────────────────────── */}
          <MenuGroup label="Information">
            <MenuItem href="/settings/support/faq"
              icon={HelpCircle} iconBg="bg-cyan-500"
              label="FAQ" description="Answers to common questions" />
            <MenuItem href="/privacy"
              icon={Shield} iconBg="bg-slate-500"
              label="Privacy Policy" description="How we handle your data" />
            <MenuItem href="/terms"
              icon={FileText} iconBg="bg-slate-500"
              label="Terms of Service" description="Terms & conditions of use" />
          </MenuGroup>

          {/* ── Support the App ──────────────────────────────────── */}
          <MenuGroup label="Support the App">
            <MenuItem href="/settings/support/coffee"
              icon={Coffee} iconBg="bg-indigo-500"
              label="Support WealthyNest" description="Help keep the app free · pay via UPI" />
          </MenuGroup>

          {/* ── Danger zone ──────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold text-red-500/70 uppercase tracking-widest px-1 mb-1.5">Danger Zone</p>
          <div className="bg-card border border-red-500/20 rounded-2xl overflow-hidden divide-y divide-border/60">
            <button
              onClick={() => setShowLogout(true)}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-red-500/5 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-500">Sign out</p>
                <p className="text-xs text-muted-foreground mt-0.5">Sign out of your account on this device</p>
              </div>
            </button>
            <button
              onClick={() => setShowClose(true)}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-red-500/5 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-500">Close account</p>
                <p className="text-xs text-muted-foreground mt-0.5">Deactivate your account — data retained, admin must reactivate</p>
              </div>
            </button>
          </div>
          </div>

          <p className="text-[11px] text-muted-foreground/50 text-center pb-4">
            WealthyNest · v1.0 · Free forever · No ads · Built for Indian families
          </p>

        </div>
      </PageWrapper>

      {showLogout && (
        <ConfirmModal
          title="Sign out?"
          message="You'll be signed out from this device. You can sign back in at any time."
          confirmLabel="Sign out"
          confirmClass="bg-red-600 hover:bg-red-700 text-white"
          loading={loggingOut}
          onConfirm={() => logout()}
          onCancel={() => setShowLogout(false)}
        />
      )}

      {showClose && (
        <ConfirmModal
          title="Close your account?"
          message="Your account will be deactivated immediately and you will be signed out. Your data is retained. Only an admin can reactivate your account."
          confirmLabel="Yes, close account"
          confirmClass="bg-red-600 hover:bg-red-700 text-white"
          loading={closingAccount}
          onConfirm={() => closeAccount()}
          onCancel={() => setShowClose(false)}
        />
      )}
    </div>
  );
}
