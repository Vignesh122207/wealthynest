"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {ArrowLeftRight, Home, Menu, Wallet, type LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {useUIStore} from "@/store/ui.store";

// "More" opens the Sidebar overlay itself, so its icon carries the same brand copper used for
// that affordance elsewhere rather than one of the per-item nav gradients below.
const COPPER_GRADIENT: [string, string] = ["#d98a52", "#a85f30"]; // brand-300 → brand-600

// Gradients match each item's own entry in Sidebar.tsx's NAV_GROUPS — keep the two in sync.
// Only four slots on mobile — the rest of the app (Investments, Budgets, Debts, Net Worth,
// Family, Analytics, Reports, Settings, Support) lives behind "More", which opens the same
// full Sidebar overlay used on desktop.
const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; gradient: [string, string] }[] = [
  { href: "/home",     label: "Home",         icon: Home,          gradient: ["#a855f7", "#6366f1"] },
  { href: "/accounts", label: "Accounts",     icon: Wallet,        gradient: ["#3b82f6", "#06b6d4"] },
  { href: "/expenses", label: "Transactions", icon: ArrowLeftRight, gradient: ["#0ea5e9", "#4f46e5"] },
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
        {NAV_ITEMS.map(({ href, label, icon, gradient }) => {
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
              <PremiumIcon
                icon={icon}
                gradient={gradient}
                size="xs"
                selected={active}
                className="rounded-[7px]"
              />
              <span className={cn(
                "text-[9px] font-semibold tracking-tight text-center leading-tight",
                active ? "text-primary" : "text-muted-foreground/70"
              )}>
                {label}
              </span>
            </Link>
          );
        })}

        {/* Investments, Budgets, Debts, Net Worth, Family, Analytics, Reports, Settings, and
            Support all live behind this — the header hamburger reaches the same full sidebar
            overlay, but nothing in the bottom bar itself pointed there, so those destinations
            had no affordance a mobile user would necessarily discover. Notifications isn't
            among them — the header bell (every page) opens that full-screen, same as always. */}
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
          <PremiumIcon
            icon={Menu}
            gradient={COPPER_GRADIENT}
            size="xs"
            selected={mobileMenuOpen}
            className="rounded-[7px]"
          />
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
