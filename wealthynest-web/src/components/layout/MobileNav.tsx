"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, ArrowLeftRight, TrendingUp, PieChart, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { NAV_GRADIENTS } from "@/components/layout/Sidebar";
import { useUIStore } from "@/store/ui.store";

// Same neutral gray→slate pair the Sidebar uses for Settings — fitting since "More" opens the
// same full nav that Settings lives in, and it's the one tab here that isn't a page of its own.
const MORE_GRADIENT: [string, string] = ["#6b7280", "#475569"];

// Net Worth only moves on a monthly snapshot — the least frequently-checked
// number in the app — while Budgets is one of the most-opened destinations
// (checked mid-month against a limit), so it holds the fifth tab instead.
// Budgets uses PieChart (not Target) to match the desktop Sidebar, which now
// uses Target for Goals — same glyph would otherwise mean two different
// things depending on whether you're on mobile or desktop.
// Gradients come from NAV_GRADIENTS (Sidebar.tsx) so each icon is the exact
// same color on mobile as it is on desktop, instead of its own named tone.
const NAV_ITEMS = [
  { href: "/dashboard",   label: "Home",         icon: Home },
  { href: "/accounts",    label: "Accounts",     icon: Wallet },
  { href: "/expenses",    label: "Transactions", icon: ArrowLeftRight },
  { href: "/investments", label: "Investments",  icon: TrendingUp },
  { href: "/budgets",     label: "Budgets",      icon: PieChart },
];

export function MobileNav() {
  const pathname = usePathname();
  const { mobileMenuOpen, openMobileMenu } = useUIStore();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-[hsl(var(--sidebar-bg))]/95 backdrop-blur-xl border-t border-[hsl(var(--sidebar-border))]">
      <div
        className="flex items-center justify-around w-full"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {NAV_ITEMS.map(({ href, label, icon }) => {
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
                <PremiumIcon icon={icon} gradient={NAV_GRADIENTS[href]} size="xs" className={cn("transition-transform", active && "scale-110")} />
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

        {/* Debts, Net Worth, Family, Analytics, Reports, Notifications, Settings, and Support
            all live behind this — the header hamburger reaches the same full sidebar overlay,
            but nothing in the bottom bar itself pointed there, so those eight destinations had
            no affordance a mobile user would necessarily discover. */}
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
            <PremiumIcon icon={Menu} gradient={MORE_GRADIENT} size="xs" className={cn("transition-transform", mobileMenuOpen && "scale-110")} />
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
