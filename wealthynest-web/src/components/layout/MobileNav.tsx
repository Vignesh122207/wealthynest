"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Receipt, Target, Wallet, Flag,
  TrendingUp, Scale, LineChart, Users, FileText, Handshake,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard",   label: "Home",    icon: Home },
  { href: "/accounts",    label: "Accounts", icon: Wallet },
  { href: "/expenses",    label: "Txns",    icon: Receipt },
  { href: "/budgets",     label: "Budgets", icon: Target },
  { href: "/goals",       label: "Goals",   icon: Flag },
  { href: "/investments", label: "Invest",  icon: TrendingUp },
  { href: "/assets",      label: "NetWorth",icon: Scale },
  { href: "/analytics",   label: "Insights",icon: LineChart },
  { href: "/debts",       label: "Debts",   icon: Handshake },
  { href: "/family",      label: "Family",  icon: Users },
  { href: "/reports",     label: "Reports", icon: FileText },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-md border-t border-border">
      <div
        className="flex items-center overflow-x-auto"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-3 px-3 transition-all shrink-0",
                active ? "text-indigo-500 dark:text-indigo-400" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", active && "scale-110")} />
              <span className={cn("text-[10px] font-medium whitespace-nowrap", active && "text-indigo-500 dark:text-indigo-400")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
