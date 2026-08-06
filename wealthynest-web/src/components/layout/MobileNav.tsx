"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {ArrowLeftRight, Home, Menu, PieChart, TrendingUp, Wallet} from "lucide-react";
import {cn} from "@/lib/utils";
import {useUIStore} from "@/store/ui.store";
import {useIsDark} from "@/hooks/useIsDark";
import {badgeTextColor} from "@/components/icons/PremiumIcon";

// Net Worth only moves on a monthly snapshot — the least frequently-checked
// number in the app — while Budgets is one of the most-opened destinations
// (checked mid-month against a limit), so it holds the fifth tab instead.
// Budgets uses PieChart (not Target) to match the desktop Sidebar, which now
// uses Target for Goals — same glyph would otherwise mean two different
// things depending on whether you're on mobile or desktop.
// Same per-item hex as Sidebar.tsx's NAV_GROUPS (the brighter of each item's old gradient
// stops), so a destination reads as the same color on mobile as it does on desktop.
const NAV_ITEMS = [
  { href: "/home",   label: "Home",         icon: Home,           hex: "#a855f7" },
  { href: "/accounts",    label: "Accounts",     icon: Wallet,         hex: "#3b82f6" },
  { href: "/expenses",    label: "Transactions", icon: ArrowLeftRight, hex: "#0ea5e9" },
  { href: "/investments", label: "Investments",  icon: TrendingUp,     hex: "#10b981" },
  { href: "/budgets",     label: "Budgets",      icon: PieChart,       hex: "#f59e0b" },
];

// Same neutral gray the desktop Sidebar uses for Settings — fitting since "More" opens the
// same full nav that Settings lives in.
const MORE_HEX = "#6b7280";

export function MobileNav() {
  const pathname = usePathname();
  const { mobileMenuOpen, openMobileMenu } = useUIStore();
  const isDark = useIsDark();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-[hsl(var(--sidebar-bg))]/95 backdrop-blur-xl border-t border-[hsl(var(--sidebar-border))]">
      <div
        className="flex items-center justify-around w-full"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon, hex }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
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
                <Icon className={cn("w-[18px] h-[18px] transition-transform", active && "scale-110")} style={{ color: badgeTextColor(hex, isDark) }} />
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

        {/* Debts, Net Worth, Family, Analytics, Reports, Settings, and Support all live behind
            this — the header hamburger reaches the same full sidebar overlay, but nothing in the
            bottom bar itself pointed there, so those seven destinations had no affordance a
            mobile user would necessarily discover. Notifications isn't among them — the header
            bell (every page) opens that full-screen, same as it always has. */}
        <button
          type="button"
          onClick={openMobileMenu}
          aria-label="More"
          aria-haspopup="true"
          aria-expanded={mobileMenuOpen}
          className={cn(
            "flex flex-col items-center gap-1 py-2.5 flex-1 transition-all relative",
            mobileMenuOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {mobileMenuOpen && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary rounded-full" />
          )}
          <div className={cn(
            "w-9 h-7 rounded-xl flex items-center justify-center transition-all",
            mobileMenuOpen ? "bg-primary/10" : "bg-transparent"
          )}>
            <Menu className={cn("w-[18px] h-[18px] transition-transform", mobileMenuOpen && "scale-110")} style={{ color: badgeTextColor(MORE_HEX, isDark) }} />
          </div>
          <span className={cn(
            "text-[9px] font-semibold tracking-tight text-center leading-tight",
            mobileMenuOpen ? "text-primary" : "text-muted-foreground/70"
          )}>
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
