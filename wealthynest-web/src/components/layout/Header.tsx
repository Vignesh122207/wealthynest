"use client";

import Link from "next/link";
import { Bell, Menu, Moon, Settings, Sun, LogOut, TrendingUp, Target, AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { cn, getInitials } from "@/lib/utils";
import { useUIStore } from "@/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useLogout } from "@/features/auth/hooks/useAuth";
import { useNotifications, type AppNotification, type NotifSeverity } from "@/hooks/useNotifications";
import { useNotificationStore } from "@/store/notification.store";
import { useServerUnreadCount } from "@/features/notifications/hooks/useServerNotifications";

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

const TYPE_ICON: Record<AppNotification["type"], React.ElementType> = {
  budget:   Target,
  income:   TrendingUp,
  goal:     Target,
  maturity: AlertCircle,
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
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
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
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
        >
          View all notifications →
        </Link>
      </div>
    </div>
  );
}

// ─── Avatar Dropdown ─────────────────────────────────────────────────────────

function AvatarDropdown({
  user,
  onLogout,
  onClose,
}: {
  user: { fullName: string; email: string; role?: string } | null;
  onLogout: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-60 bg-card border border-border rounded-2xl shadow-xl shadow-black/10 overflow-hidden z-50">
      {/* User info */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-300 shrink-0 select-none">
            {user ? getInitials(user.fullName) : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{user?.fullName ?? "—"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email ?? "—"}</p>
          </div>
        </div>
        {user?.role && user.role !== "MEMBER" && (
          <span className="mt-2 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            {user.role.toLowerCase().replace("_", " ")}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="py-1.5">
        <Link
          href="/settings"
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
          Settings
        </Link>
      </div>

      <div className="border-t border-border py-1.5">
        <button
          onClick={() => { onLogout(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { theme, setTheme }   = useTheme();
  const [mounted, setMounted] = useState(false);
  const { toggleMobileMenu }  = useUIStore();
  const { user }              = useAuthStore();
  const { mutate: logout }    = useLogout();

  const [showNotifs, setShowNotifs] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);

  const notifsRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount: localUnread } = useNotifications();
  const { markSeen }                                = useNotificationStore();
  const { data: serverUnread = 0 }                  = useServerUnreadCount();
  const unreadCount = localUnread + serverUnread;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setShowAvatar(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function toggleNotifs() {
    const opening = !showNotifs;
    setShowNotifs(opening);
    setShowAvatar(false);
    if (opening) markSeen(notifications.map((n) => n.id));
  }

  function toggleAvatar() {
    setShowAvatar(v => !v);
    setShowNotifs(false);
  }

  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-[hsl(var(--sidebar-bg))]/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-1">

        {/* Bell */}
        <div ref={notifsRef} className="relative">
          <button
            onClick={toggleNotifs}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center relative transition-all",
              showNotifs
                ? "text-indigo-600 dark:text-indigo-400 bg-indigo-600/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full" />
            )}
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
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        {/* User avatar */}
        <div ref={avatarRef} className="relative ml-1">
          <button
            onClick={toggleAvatar}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all",
              showAvatar
                ? "bg-indigo-600/20 text-indigo-600 dark:text-indigo-300 ring-2 ring-indigo-500/40"
                : "bg-indigo-600/10 text-indigo-600 dark:text-indigo-300 hover:ring-2 hover:ring-indigo-500/30"
            )}
            aria-label="Account menu"
          >
            {user ? getInitials(user.fullName) : "?"}
          </button>
          {showAvatar && (
            <AvatarDropdown user={user} onLogout={logout} onClose={() => setShowAvatar(false)} />
          )}
        </div>

      </div>
    </header>
  );
}
