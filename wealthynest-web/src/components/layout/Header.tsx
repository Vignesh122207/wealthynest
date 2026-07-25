"use client";

import Link from "next/link";
import {AlertCircle, Bell, CheckCircle2, Download, Eye, EyeOff, Info, Menu, Moon, Sun, X} from "lucide-react";
import {useTheme} from "next-themes";
import {useEffect, useRef, useState} from "react";
import {cn, getInitials} from "@/lib/utils";
import {useUIStore} from "@/store/ui.store";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {type AppNotification, type NotifSeverity} from "@/hooks/useNotifications";
import {useNotificationStore} from "@/store/notification.store";
import {useMergedNotifications} from "@/features/notifications/hooks/useServerNotifications";
import {usePrivacyStore} from "@/store/privacy.store";
import {GlossyBadge, PremiumIcon} from "@/components/icons/PremiumIcon";
import {NAV_GRADIENTS} from "@/components/layout/Sidebar";

// Same copper pair BrandMark's ribbon logo uses for its lightest leg — the bell keys off this
// instead of PremiumIcon's Apple-tone palette so it reads as *this app's* brand, not a generic
// system color, and stays in sync with --primary. The avatar takes the sidebar's own Notifications
// gradient (NAV_GRADIENTS) instead — swapped on purpose, not the "obvious" pairing.
const BRAND_GRADIENT: [string, string] = ["#e8935f", "#c2703d"];

// ─── Severity helpers ────────────────────────────────────────────────────────

const SEVERITY_ICON: Record<NotifSeverity, React.ElementType> = {
  error:   AlertCircle,
  warning: AlertCircle,
  success: CheckCircle2,
  info:    Info,
};

const SEVERITY_COLOR: Record<NotifSeverity, string> = {
  error:   "text-red-500",
  warning: "text-amber-500",
  success: "text-emerald-500",
  info:    "text-indigo-500",
};

const SEVERITY_BG: Record<NotifSeverity, string> = {
  error:   "bg-red-500/10",
  warning: "bg-amber-500/10",
  success: "bg-emerald-500/10",
  info:    "bg-indigo-500/10",
};

// ─── Notification Panel ──────────────────────────────────────────────────────

function NotificationPanel({
  notifications,
  newCount,
  onClose,
}: {
  notifications: AppNotification[];
  newCount: number;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-1rem))] bg-card border border-border rounded-2xl shadow-xl shadow-black/10 overflow-hidden z-50">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold text-foreground">Notifications</p>
        {newCount > 0 && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {newCount} new
          </span>
        )}
        <button
          onClick={onClose}
          className="ml-auto text-muted-foreground hover:text-foreground p-0.5 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <Bell className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">All clear</p>
          <p className="text-xs text-muted-foreground mt-0.5">No alerts right now. Check back later.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border max-h-80 overflow-y-auto">
          {notifications.slice(0, 5).map((n) => {
            const SeverityIcon = SEVERITY_ICON[n.severity];
            return (
              <li key={n.id} className="flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", SEVERITY_BG[n.severity])}>
                  <SeverityIcon className={cn("w-3.5 h-3.5", SEVERITY_COLOR[n.severity])} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-snug">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                  {n.date && (
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                      {new Date(n.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* View all link */}
      <div className="border-t border-border px-4 py-2.5">
        <Link
          href="/notifications"
          onClick={onClose}
          className="text-xs text-primary hover:underline font-medium"
        >
          View all notifications →
        </Link>
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

interface HeaderProps {
  title: string;
  subtitle?: string;
  onExport?: () => void;
}

export function Header({ title, subtitle, onExport }: HeaderProps) {
  const { theme, setTheme }   = useTheme();
  const [mounted, setMounted] = useState(false);
  const { toggleMobileMenu }  = useUIStore();
  const { user }              = useAuthStore();

  const [showNotifs, setShowNotifs] = useState(false);

  const notifsRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount } = useMergedNotifications();
  const { markSeen }                   = useNotificationStore();

  const { hideAmounts, toggleHideAmounts } = usePrivacyStore();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setShowNotifs(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowNotifs(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function toggleNotifs() {
    const opening = !showNotifs;
    setShowNotifs(opening);
    if (opening) markSeen(notifications.map((n) => n.id));
  }

  return (
    <header className={cn(
      "min-h-16 border-b border-border flex items-center justify-between gap-3 px-4 lg:px-6 py-3 bg-[hsl(var(--sidebar-bg))]/90 backdrop-blur-sm sticky top-0 z-10"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleMobileMenu}
          data-testid="mobile-menu-toggle"
          aria-label="Open menu"
          className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 data-testid="page-header-title" className="text-base font-semibold text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground/70 truncate hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">

        {/* Hide/show amounts — masks currency figures on every page, not just Home, since
            usePrivacyStore/useAmountFormatter is read app-wide (Accounts, Investments, Budgets…). */}
        <button onClick={toggleHideAmounts} aria-label={hideAmounts ? "Show amounts" : "Hide amounts"} aria-pressed={hideAmounts}>
          <PremiumIcon icon={hideAmounts ? EyeOff : Eye} tone="blue" size="xs" interactive className="rounded-full" />
        </button>

        {/* Bell */}
        <div ref={notifsRef} className="relative">
          <button onClick={toggleNotifs} aria-label="Notifications" aria-haspopup="true" aria-expanded={showNotifs}>
            <PremiumIcon icon={Bell} gradient={BRAND_GRADIENT} size="xs" interactive selected={showNotifs} badge={unreadCount > 0} className="rounded-full" />
          </button>
          {showNotifs && (
            <NotificationPanel
              notifications={notifications}
              newCount={unreadCount}
              onClose={() => setShowNotifs(false)}
            />
          )}
        </div>

        {/* Theme toggle */}
        {mounted && (
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
            <PremiumIcon icon={theme === "dark" ? Sun : Moon} tone="indigo" size="xs" interactive className="rounded-full" />
          </button>
        )}

        {/* Export — only on pages that hand us something to export */}
        {onExport && (
          <button onClick={onExport} aria-label="Export">
            <PremiumIcon icon={Download} tone="green" size="xs" interactive className="rounded-full" />
          </button>
        )}

        {/* User avatar — persistent across every page; other pages no longer forced you back to
            Home to reach it. Square, matching BrandMark's own tile shape (both read as "identity"),
            while the round action buttons around it read as a distinct "utility" family. */}
        <Link href="/settings/profile" className="ml-1" aria-label="Edit profile">
          <GlossyBadge gradient={NAV_GRADIENTS["/notifications"]} size="sm" interactive>
            <span className="relative text-xs font-bold text-white">{user ? getInitials(user.fullName) : "?"}</span>
          </GlossyBadge>
        </Link>

      </div>
    </header>
  );
}
