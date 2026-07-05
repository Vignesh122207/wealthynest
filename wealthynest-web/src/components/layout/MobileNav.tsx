"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Receipt, TrendingUp, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard",   label: "Home",         icon: Home },
  { href: "/accounts",    label: "Accounts",     icon: Wallet },
  { href: "/expenses",    label: "Transactions", icon: Receipt },
  { href: "/investments", label: "Investments",  icon: TrendingUp },
  { href: "/assets",      label: "Net Worth",    icon: Scale },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-[hsl(var(--sidebar-bg))]/95 backdrop-blur-xl border-t border-[hsl(var(--sidebar-border))]">
      <div
        className="flex items-center justify-around w-full"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 flex-1 transition-all relative",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary rounded-full" />
              )}
              <div className={cn(
                "w-9 h-7 rounded-xl flex items-center justify-center transition-all",
                active ? "bg-primary/10" : "bg-transparent"
              )}>
                <Icon className={cn("w-[18px] h-[18px] transition-transform", active && "scale-110")} strokeWidth={active ? 2.25 : 1.75} />
              </div>
              <span className={cn(
                "text-[9px] font-semibold tracking-tight text-center leading-tight",
                active ? "text-primary" : "text-muted-foreground/70"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
