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

const NAV_ITEMS = [
  { href: "/dashboard",   label: "Dashboard",   icon: Home },
  { href: "/accounts",    label: "Accounts",    icon: Wallet },
  { href: "/expenses",    label: "Transactions", icon: Receipt },
  { href: "/budgets",     label: "Budgets",     icon: Target },
  { href: "/goals",       label: "Goals",       icon: Flag },
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/assets",      label: "Net Worth",   icon: Scale },
  { href: "/analytics",   label: "Analytics",   icon: LineChart },
  { href: "/debts",       label: "Debts",       icon: Handshake },
  { href: "/family",      label: "Family",      icon: Users },
  { href: "/reports",     label: "Reports",     icon: FileText },
];

export function Sidebar() {
  const pathname                            = usePathname();
  const { user }                            = useAuthStore();
  const isAdmin                             = user?.role === "ADMIN";
  const { mobileMenuOpen, closeMobileMenu } = useUIStore();

  const navContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-[hsl(var(--sidebar-border))] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Sprout className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">WealthyNest</span>
        </div>
        <button
          onClick={closeMobileMenu}
          className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} onClick={closeMobileMenu}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                active
                  ? "bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}>
              <Icon className={cn("w-4 h-4 shrink-0",
                active ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground group-hover:text-foreground")} />
              {label}
            </Link>
          );
        })}

        {isAdmin && (
          <Link href="/admin" onClick={closeMobileMenu}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group mt-1",
              pathname.startsWith("/admin")
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}>
            <ShieldCheck className={cn("w-4 h-4 shrink-0",
              pathname.startsWith("/admin") ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground group-hover:text-foreground")} />
            Admin
          </Link>
        )}
      </nav>

      {/* User card → Settings */}
      <div className="px-3 pb-4 pt-3 border-t border-[hsl(var(--sidebar-border))] shrink-0">
        <Link
          href="/settings"
          onClick={closeMobileMenu}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group",
            pathname.startsWith("/settings")
              ? "bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
              : "hover:bg-muted"
          )}
        >
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-all",
            pathname.startsWith("/settings")
              ? "bg-indigo-600/30 text-indigo-600 dark:text-indigo-300"
              : "bg-indigo-600/20 text-indigo-600 dark:text-indigo-300 group-hover:ring-2 group-hover:ring-indigo-500/40"
          )}>
            {user ? getInitials(user.fullName) : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Settings className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <aside className="w-60 shrink-0 hidden lg:flex flex-col h-screen sticky top-0 bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))]">
        {navContent}
      </aside>

      {/* Mobile sidebar — slides in as overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeMobileMenu}
          />
          <aside className="relative w-72 max-w-[85vw] flex flex-col h-full bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))] shadow-2xl">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
