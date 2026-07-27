"use client";

import {useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {
    ArrowLeftRight,
    ChartNoAxesCombined,
    ChevronLeft,
    ChevronRight,
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
import {Tooltip} from "@/components/ui/Tooltip";
import {cn} from "@/lib/utils";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useLogout} from "@/features/auth/hooks/useAuth";
import {useUIStore} from "@/store/ui.store";
import {useMergedNotifications} from "@/features/notifications/hooks/useServerNotifications";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {BrandMark} from "@/components/icons/BrandMark";

type Gradient = [string, string];

// Every gradient below is a unique pair — no two nav items share the same two
// stops (previously Family/Budgets were both flat "pink" and Accounts/Reports
// were both flat "blue"; Family/Support WealthyNest later collided again once
// Support WealthyNest moved to a warm rose→pink gradient of its own — Family
// settled on a warm coral/terracotta, reading as "home/hearth", a hue no other
// item touches). Reports/Settings both end on slate, which is deliberate: Reports
// keeps a brand-colored starting stop so it reads as "data" (a lightened copper,
// distinct from the header bell's own full-strength brand pair), Settings stays
// fully neutral since it's pure utility.
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/home",   label: "Home",         icon: Home,            gradient: ["#a855f7", "#6366f1"] as Gradient },
      { href: "/accounts",    label: "Accounts",     icon: Wallet,          gradient: ["#3b82f6", "#06b6d4"] as Gradient },
      { href: "/expenses",    label: "Transactions", icon: ArrowLeftRight,  gradient: ["#0ea5e9", "#4f46e5"] as Gradient },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/budgets",     label: "Budgets",      icon: PieChart,   gradient: ["#f59e0b", "#ea580c"] as Gradient },
      { href: "/goals",       label: "Goals",        icon: Target,     gradient: ["#d946ef", "#9333ea"] as Gradient },
      { href: "/debts",       label: "Debts",        icon: Handshake,  gradient: ["#ef4444", "#e11d48"] as Gradient },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/investments", label: "Investments",  icon: TrendingUp, gradient: ["#10b981", "#16a34a"] as Gradient },
      { href: "/assets",      label: "Net Worth",    icon: Gem,        gradient: ["#8b5cf6", "#c026d3"] as Gradient },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics",     label: "Analytics",     icon: ChartNoAxesCombined, gradient: ["#14b8a6", "#06b6d4"] as Gradient },
      { href: "/family",        label: "Family",        icon: FamilyGroupIcon, gradient: ["#FAA18F", "#D9714E"] as Gradient },
      { href: "/reports",       label: "Reports",       icon: FileText,  gradient: ["#d98a52", "#64748b"] as Gradient },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings",           label: "Settings",            icon: Settings, gradient: ["#6b7280", "#475569"] as Gradient },
      // Gold — matches the redesigned Vault page's own brass/gold identity (VaultHealthCard's
      // "vault door" hero), was navy/graphite before that redesign.
      { href: "/vault",              label: "Vault",                icon: KeyRound, gradient: ["#f6d776", "#a9791a"] as Gradient },
      { href: "/support-wealthynest", label: "Support WealthyNest", icon: Heart,    gradient: ["#fb7185", "#db2777"] as Gradient },
    ],
  },
];

const ADMIN_GRADIENT: Gradient = ["#059669", "#0d9488"];

// Shared with MobileNav so bottom-tab icons match the desktop sidebar exactly
// instead of drifting to their own named tones.
export const NAV_GRADIENTS: Record<string, Gradient> = Object.fromEntries(
  NAV_GROUPS.flatMap((group) => group.items.map(({ href, gradient }) => [href, gradient]))
);

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

function NavItem({ href, label, icon, gradient, active, badge, collapsed, onClick }: {
  href: string; label: string; icon: LucideIcon; gradient: Gradient;
  active: boolean; badge?: number; collapsed?: boolean; onClick?: () => void;
}) {
  const link = (
    <Link
      href={href}
      data-testid={`nav-link-${href.replace(/^\//, "")}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group",
        collapsed && "justify-center px-0",
        active && "text-primary",
        active && !collapsed && "bg-primary/10 dark:bg-primary/15",
        !active && "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
      )}
      {/* Collapsed rows have no room for the left accent bar above. A ring on the row itself
          (tried first) traced the row's own rounded-xl edge and read as a highlighted rectangle
          — this scopes a circular copper ring tightly to the icon instead, so the cue is a
          deliberate round accent distinct from the icon's own rounded-square shape. */}
      {collapsed ? (
        <span className={cn("flex items-center justify-center rounded-full p-0.5", active && "ring-2 ring-primary")}>
          <PremiumIcon icon={icon} gradient={gradient} size="xs" interactive selected={active} badge={badge} />
        </span>
      ) : (
        <PremiumIcon icon={icon} gradient={gradient} size="xs" interactive selected={active} badge={badge} />
      )}
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  return collapsed
    ? <Tooltip content={label} side="right" className="flex w-full">{link}</Tooltip>
    : link;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user }  = useAuthStore();
  const isAdmin   = user?.role === "ADMIN";
  const { mobileMenuOpen, closeMobileMenu, sidebarCollapsed, toggleSidebar } = useUIStore();
  const { mutate: logout } = useLogout();
  const { unreadCount }    = useMergedNotifications();
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Mobile's overlay drawer always renders expanded (collapsing a drawer you open on demand just
  // to close it again isn't useful) — only the persistent desktop rail collapses, so this takes
  // `collapsed` as a param instead of reading sidebarCollapsed directly.
  function renderNav(collapsed: boolean) {
    const signOutButton = (
      <button
        data-testid="nav-logout"
        onClick={() => setConfirmLogout(true)}
        aria-label={collapsed ? "Sign out" : undefined}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-all",
          collapsed && "justify-center px-0"
        )}
      >
        <PremiumIcon icon={LogOut} tone="red" size="xs" />
        {!collapsed && <span>Sign out</span>}
      </button>
    );

    return (
      <div className="flex flex-col h-full">
        {/* ── Logo ── */}
        <div className={cn("flex items-center h-16 border-b border-[hsl(var(--sidebar-border))] shrink-0", collapsed ? "justify-center px-2" : "justify-between px-4")}>
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark boxClassName="w-8 h-8" iconClassName="w-6 h-6" />
            {!collapsed && (
              <div className="min-w-0">
                <span className="text-sm font-bold tracking-tight text-foreground leading-none">WealthyNest</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Personal Finance</p>
              </div>
            )}
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
              {!collapsed && (
                <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-3 mb-1">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon, gradient }) => {
                  const active = isNavActive(pathname, href);
                  const badge = href === "/notifications" ? unreadCount : undefined;
                  return (
                    <NavItem key={href} href={href} label={label} icon={icon} gradient={gradient}
                      active={active} badge={badge} collapsed={collapsed} onClick={closeMobileMenu} />
                  );
                })}
              </div>
            </div>
          ))}

          {isAdmin && (
            <div>
              {!collapsed && <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-3 mb-1">Admin</p>}
              <NavItem href="/admin" label="Admin" icon={ShieldCheck} gradient={ADMIN_GRADIENT}
                active={pathname.startsWith("/admin")} collapsed={collapsed} onClick={closeMobileMenu} />
            </div>
          )}
        </nav>

        {/* ── Sign out ── */}
        <div className="px-3 pb-4 pt-3 border-t border-[hsl(var(--sidebar-border))] shrink-0">
          {collapsed
            ? <Tooltip content="Sign out" side="right" className="flex w-full">{signOutButton}</Tooltip>
            : signOutButton}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        "relative shrink-0 hidden lg:flex flex-col h-screen sticky top-0 bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))] transition-[width] duration-200 ease-out",
        sidebarCollapsed ? "w-[68px]" : "w-60"
      )}>
        {renderNav(sidebarCollapsed)}

        {/* Straddles the sidebar/content border so its position doesn't depend on collapsed
            state — same "rail toggle" pattern as VS Code's explorer / Notion's sidebar. */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[27px] w-6 h-6 rounded-full border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-bg))] text-muted-foreground hover:text-foreground hover:border-primary/40 flex items-center justify-center shadow-sm z-20 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
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
