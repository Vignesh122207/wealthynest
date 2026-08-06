"use client";

import {useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {
    ArrowLeftRight,
    ChartNoAxesCombined,
    FileText,
    Gem,
    Handshake,
    Heart,
    Home,
    KeyRound,
    LogOut,
    type LucideIcon,
    PieChart,
    Settings,
    ShieldCheck,
    Target,
    TrendingUp,
    Wallet,
    X,
} from "lucide-react";
import {FamilyGroupIcon} from "@/components/icons/FamilyGroupIcon";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {cn} from "@/lib/utils";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useLogout} from "@/features/auth/hooks/useAuth";
import {useUIStore} from "@/store/ui.store";
import {useMergedNotifications} from "@/features/notifications/hooks/useServerNotifications";
import {useIsDark} from "@/hooks/useIsDark";
import {badgeTextColor} from "@/components/icons/PremiumIcon";
import {BrandMark} from "@/components/icons/BrandMark";

// Each item keeps the brand hue it had under the old gradient-badge system (the brighter of the
// two original gradient stops) — restored per explicit request after a brief stint as flat
// single-accent icons. The icon itself is a plain glyph (no badge/box), just tinted with its own
// color via badgeTextColor (same already-verified 4.5:1-in-both-themes helper PremiumIcon/
// FlatIcon use) — active/inactive is still carried by the row's own pill background and label
// color, not by recoloring the icon.
// Labels are short on purpose — the desktop rail is a narrow icon-above-label column (see
// NavItem's collapsed variant), so "Transactions"/"Investments"/"Support WealthyNest" become
// "Activity"/"Invest"/"Support" here. The mobile drawer (NavItem's non-collapsed variant) reads
// these same short labels too, for one consistent nav vocabulary everywhere.
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/home",   label: "Home",         icon: Home,           hex: "#a855f7" },
      { href: "/accounts",    label: "Accounts",     icon: Wallet,         hex: "#3b82f6" },
      { href: "/expenses",    label: "Activity",     icon: ArrowLeftRight, hex: "#0ea5e9" },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/budgets",     label: "Budgets",      icon: PieChart,  hex: "#f59e0b" },
      { href: "/goals",       label: "Goals",        icon: Target,    hex: "#d946ef" },
      { href: "/debts",       label: "Debts",        icon: Handshake, hex: "#ef4444" },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/investments", label: "Invest",       icon: TrendingUp, hex: "#10b981" },
      { href: "/assets",      label: "Net Worth",    icon: Gem,        hex: "#8b5cf6" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics",     label: "Analytics",     icon: ChartNoAxesCombined, hex: "#14b8a6" },
      { href: "/family",        label: "Family",        icon: FamilyGroupIcon,     hex: "#FAA18F" },
      { href: "/reports",       label: "Reports",       icon: FileText,            hex: "#d98a52" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings",           label: "Settings",  icon: Settings, hex: "#6b7280" },
      { href: "/vault",              label: "Vault",     icon: KeyRound, hex: "#f6d776" },
      { href: "/support-wealthynest", label: "Support",  icon: Heart,    hex: "#fb7185" },
    ],
  },
];

const ADMIN_HEX = "#059669";

// Flat item list for the desktop rail — no group headers there (see the screenshot this rail is
// matching: one continuous column of tiles), so the grouping only matters for the mobile drawer.
const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

// "/settings" would otherwise match every /settings/* sub-route, including Profile
// (reached via the header avatar, not this nav, and with no back link into Settings)
// — exclude it so only the relevant item is highlighted. Support WealthyNest lives
// at its own top-level route now, so it no longer needs an exclusion here.
const SETTINGS_ACTIVE_EXCLUDE = ["/settings/profile"];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/settings") {
    return pathname === href ||
      (pathname.startsWith(href + "/") && !SETTINGS_ACTIVE_EXCLUDE.some(p => pathname.startsWith(p)));
  }
  return pathname === href || pathname.startsWith(href + "/");
}

function NavBadge({ badge }: { badge?: number }) {
  if (typeof badge !== "number" || badge <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none flex items-center justify-center ring-2 ring-[hsl(var(--sidebar-bg))]">
      {badge > 9 ? "9+" : badge}
    </span>
  );
}

// `collapsed` now names two genuinely different layouts, not a width toggle on the same one:
// `true` is the persistent desktop rail's icon-above-label tile (labels always visible, so no
// tooltip needed); `false` is the mobile drawer's icon-left-label-right row. See Sidebar's own
// comment on why the rail no longer collapses/expands at runtime.
function NavItem({ href, label, icon: Icon, hex, active, badge, collapsed, onClick }: {
  href: string; label: string; icon: LucideIcon; hex: string;
  active: boolean; badge?: number; collapsed?: boolean; onClick?: () => void;
}) {
  const isDark = useIsDark();
  const iconColor = badgeTextColor(hex, isDark);

  if (collapsed) {
    return (
      <Link
        href={href}
        data-testid={`nav-link-${href.replace(/^\//, "")}`}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-2xl text-center transition-colors",
          active ? "bg-primary/10 dark:bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <span className="relative flex items-center justify-center">
          <Icon className="w-5 h-5 shrink-0" style={{ color: iconColor }} />
          <NavBadge badge={badge} />
        </span>
        <span className="text-[10px] font-semibold leading-[1.15]">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      data-testid={`nav-link-${href.replace(/^\//, "")}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150",
        active ? "text-primary bg-primary/10 dark:bg-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
      )}
      <span className="relative flex items-center">
        <Icon className="w-[18px] h-[18px] shrink-0" style={{ color: iconColor }} />
        <NavBadge badge={badge} />
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user }  = useAuthStore();
  const isAdmin   = user?.role === "ADMIN";
  const { mobileMenuOpen, closeMobileMenu } = useUIStore();
  const { mutate: logout } = useLogout();
  const { unreadCount }    = useMergedNotifications();
  const [confirmLogout, setConfirmLogout] = useState(false);

  // The desktop rail is a fixed-width icon-above-label column now (no collapse/expand toggle —
  // see the outer <aside> below), while the mobile drawer stays the wider icon-left-label-right
  // list it always was. `collapsed` still names that distinction since the two render paths
  // below are genuinely different layouts, not a width animated between two states.
  function renderNav(collapsed: boolean) {
    const signOutButton = collapsed ? (
      <button
        data-testid="nav-logout"
        onClick={() => setConfirmLogout(true)}
        className="w-full flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl text-[10px] font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
      >
        <LogOut className="w-5 h-5 shrink-0" />
        Sign out
      </button>
    ) : (
      <button
        data-testid="nav-logout"
        onClick={() => setConfirmLogout(true)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-all"
      >
        <LogOut className="w-[18px] h-[18px] shrink-0" />
        <span>Sign out</span>
      </button>
    );

    return (
      <div className="flex flex-col h-full">
        {/* ── Logo ── */}
        <div className={cn("flex items-center h-16 border-b border-[hsl(var(--sidebar-border))] shrink-0", collapsed ? "justify-center px-2" : "justify-between px-4")}>
          {collapsed ? (
            <BrandMark boxClassName="w-9 h-9" iconClassName="w-6 h-6" />
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <BrandMark boxClassName="w-8 h-8" iconClassName="w-6 h-6" />
              <div className="min-w-0">
                <span className="text-sm font-bold tracking-tight text-foreground leading-none">WealthyNest</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Personal Finance</p>
              </div>
            </div>
          )}
          <button
            onClick={closeMobileMenu}
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Nav ── */}
        {collapsed ? (
          <nav className="flex-1 px-2.5 py-4 overflow-y-auto space-y-1.5">
            {ALL_NAV_ITEMS.map(({ href, label, icon, hex }) => (
              <NavItem key={href} href={href} label={label} icon={icon} hex={hex}
                active={isNavActive(pathname, href)}
                badge={href === "/notifications" ? unreadCount : undefined}
                collapsed onClick={closeMobileMenu} />
            ))}
            {isAdmin && (
              <NavItem href="/admin" label="Admin" icon={ShieldCheck} hex={ADMIN_HEX}
                active={pathname.startsWith("/admin")} collapsed onClick={closeMobileMenu} />
            )}
          </nav>
        ) : (
          <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-3 mb-1">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(({ href, label, icon, hex }) => (
                    <NavItem key={href} href={href} label={label} icon={icon} hex={hex}
                      active={isNavActive(pathname, href)}
                      badge={href === "/notifications" ? unreadCount : undefined}
                      onClick={closeMobileMenu} />
                  ))}
                </div>
              </div>
            ))}

            {isAdmin && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-3 mb-1">Admin</p>
                <NavItem href="/admin" label="Admin" icon={ShieldCheck} hex={ADMIN_HEX}
                  active={pathname.startsWith("/admin")} onClick={closeMobileMenu} />
              </div>
            )}
          </nav>
        )}

        {/* ── Sign out ── */}
        <div className={cn("pb-4 pt-3 border-t border-[hsl(var(--sidebar-border))] shrink-0", collapsed ? "px-2.5" : "px-3")}>
          {signOutButton}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop sidebar — fixed-width icon rail, no collapse/expand toggle (see NavItem/
          renderNav's own comments on why "collapsed" is now two fixed layouts, not a state). */}
      <aside className="relative shrink-0 hidden lg:flex flex-col w-24 h-screen sticky top-0 bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))]">
        {renderNav(true)}
      </aside>

      {/* Mobile sidebar overlay — `fixed`, so (unlike ordinary flowed content) it needs its own
          safe-area padding rather than inheriting any from an ancestor; without it, the logo row
          rendered directly under the status bar, overlapping the clock/battery/wifi icons. */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMobileMenu} />
          <aside
            className="relative w-72 max-w-[85vw] flex flex-col h-full bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))] shadow-2xl"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {renderNav(false)}
          </aside>
        </div>
      )}

      {confirmLogout && (
        <ConfirmDialog open title="Sign out?"
          description="You'll be signed out from this device. You can sign back in at any time."
          confirmLabel="Sign out" danger
          onConfirm={() => { logout(); closeMobileMenu(); }}
          onCancel={() => setConfirmLogout(false)} />
      )}
    </>
  );
}
