"use client";

import Link from "next/link";
import {Bell, Download, Eye, EyeOff, Menu, SunMoon} from "lucide-react";
import {useTheme} from "next-themes";
import {useEffect, useState} from "react";
import {cn, getInitials} from "@/lib/utils";
import {useUIStore} from "@/store/ui.store";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useMergedNotifications} from "@/features/notifications/hooks/useServerNotifications";
import {usePrivacyStore} from "@/store/privacy.store";
import {GlossyBadge} from "@/components/icons/PremiumIcon";

// Material-style icon button: transparent at rest, a neutral tonal circle appears only on
// hover/press (Gmail/Calendar's own top-bar pattern) — the color lives in the glyph itself, not
// in a permanent filled shape behind it. Shared by all four header actions so they read as one
// consistent toolbar instead of drifting per-icon.
const ICON_BUTTON = "w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted active:bg-muted/70 transition-colors";

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

  const { unreadCount } = useMergedNotifications();

  const { hideAmounts, toggleHideAmounts } = usePrivacyStore();

  useEffect(() => setMounted(true), []);

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
            usePrivacyStore/useAmountFormatter is read app-wide (Accounts, Investments, Budgets…).
            Colored when amounts are visible, muted gray when hidden — the color itself signals
            state, not just the glyph swap. */}
        <button onClick={toggleHideAmounts} aria-label={hideAmounts ? "Show amounts" : "Hide amounts"} aria-pressed={hideAmounts} className={ICON_BUTTON}>
          {hideAmounts
            ? <EyeOff className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={2} />
            : <Eye className="w-[18px] h-[18px] text-blue-500" strokeWidth={2} />}
        </button>

        {/* Bell — filled, not outline, so it reads as a solid gold bell rather than a thin blue-ish
            line icon, the way most apps render their notification glyph. Goes straight to the
            full /notifications page (no dropdown preview) — it's the only way into that page now
            that the sidebar's own "Notifications" entry is gone, so it needs to be a real
            destination, not a teaser. */}
        <Link href="/notifications" aria-label="Notifications" className={cn(ICON_BUTTON, "relative")}>
          <Bell className="w-[18px] h-[18px] text-amber-500" fill="currentColor" strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[hsl(var(--sidebar-bg))]" />
          )}
        </Link>

        {/* Theme toggle — SunMoon is one glyph representing both states, so it never has to swap
            to an actual Sun icon that would compete with the bell's gold for attention. */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className={ICON_BUTTON}
          >
            <SunMoon className="w-[18px] h-[18px] text-indigo-500" strokeWidth={2} />
          </button>
        )}

        {/* Export — only on pages that hand us something to export */}
        {onExport && (
          <button onClick={onExport} aria-label="Export" className={ICON_BUTTON}>
            <Download className="w-[18px] h-[18px] text-emerald-500" strokeWidth={2} />
          </button>
        )}

        {/* User avatar — persistent across every page; other pages no longer forced you back to
            Home to reach it. Square, matching BrandMark's own tile shape (both read as "identity"),
            while the round action buttons around it read as a distinct "utility" family. */}
        <Link href="/settings/profile" className="ml-1" aria-label="Edit profile">
          <GlossyBadge gradient={["#c2703d", "#27272a"]} size="sm" interactive>
            <span className="relative text-xs font-bold text-white">{user ? getInitials(user.fullName) : "?"}</span>
          </GlossyBadge>
        </Link>

      </div>
    </header>
  );
}
