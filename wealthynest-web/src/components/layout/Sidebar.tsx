"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Scale, LineChart, Home, Receipt, Target, Wallet,
  TrendingUp, Users, Flag, ShieldCheck, Sprout, X, Settings,
  FileText, Handshake,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useUIStore } from "@/store/ui.store";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard",   label: "Dashboard",    icon: Home },
      { href: "/accounts",    label: "Accounts",     icon: Wallet },
      { href: "/expenses",    label: "Transactions", icon: Receipt },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/budgets",     label: "Budgets",      icon: Target },
      { href: "/goals",       label: "Goals",        icon: Flag },
      { href: "/debts",       label: "Debts",        icon: Handshake },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/investments", label: "Investments",  icon: TrendingUp },
      { href: "/assets",      label: "Net Worth",    icon: Scale },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics",   label: "Analytics",    icon: LineChart },
      { href: "/family",      label: "Family",       icon: Users },
      { href: "/reports",     label: "Reports",      icon: FileText },
    ],
  },
];

function NavItem({ href, label, icon: Icon, active, onClick }: {
  href: string; label: string; icon: React.ElementType;
  active: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group",
        active
          ? "bg-primary/10 text-primary dark:bg-primary/15"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
      )}
      <Icon className={cn(
        "w-4 h-4 shrink-0 transition-colors",
        active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
      )} />
      <span>{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname                            = usePathname();
  const { user }                            = useAuthStore();
  const isAdmin                             = user?.role === "ADMIN";
  const { mobileMenuOpen, closeMobileMenu } = useUIStore();

  const navContent = (
    <div className="flex flex-col h-full">
      {/* ── Logo ── */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-[hsl(var(--sidebar-border))] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
            <Sprout className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-foreground leading-none">WealthyNest</span>
            <p className="text-[10px] text-muted-foreground/60 leading-none mt-0.5">Personal Finance</p>
          </div>
        </div>
        <button
          onClick={closeMobileMenu}
          className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Nav groups ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest px-3 mb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <NavItem key={href} href={href} label={label} icon={icon}
                    active={active} onClick={closeMobileMenu} />
                );
              })}
            </div>
          </div>
        ))}

        {isAdmin && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest px-3 mb-1">Admin</p>
            <NavItem href="/admin" label="Admin Panel" icon={ShieldCheck}
              active={pathname.startsWith("/admin")} onClick={closeMobileMenu} />
          </div>
        )}
      </nav>

      {/* ── User → Settings ── */}
      <div className="px-3 pb-4 pt-3 border-t border-[hsl(var(--sidebar-border))] shrink-0">
        <Link
          href="/settings"
          onClick={closeMobileMenu}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
            pathname.startsWith("/settings")
              ? "bg-primary/10 border border-primary/20"
              : "hover:bg-muted border border-transparent"
          )}
        >
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-all select-none",
            pathname.startsWith("/settings")
              ? "bg-primary/20 text-primary"
              : "bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-primary group-hover:from-indigo-500/30 group-hover:to-violet-500/30"
          )}>
            {user ? getInitials(user.fullName) : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate leading-none">{user?.fullName ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{user?.email ?? "—"}</p>
          </div>
          <Settings className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-60 shrink-0 hidden lg:flex flex-col h-screen sticky top-0 bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))]">
        {navContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMobileMenu} />
          <aside className="relative w-72 max-w-[85vw] flex flex-col h-full bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))] shadow-2xl">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
