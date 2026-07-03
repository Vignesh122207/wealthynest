"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell, AlertCircle, AlertTriangle, CheckCircle2, Info,
  TrendingUp, Target, Flag, Clock, X,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { useNotifications, type AppNotification, type NotifSeverity } from "@/hooks/useNotifications";
import { useNotificationStore } from "@/store/notification.store";
import { useServerNotifications, useMarkAllServerRead, toAppNotification } from "@/features/notifications/hooks/useServerNotifications";
import { cn } from "@/lib/utils";

const SEVERITY_ICON: Record<NotifSeverity, React.ElementType> = {
  error:   AlertCircle,
  warning: AlertTriangle,
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

const TYPE_LABELS: Record<AppNotification["type"], string> = {
  budget:   "Budget",
  income:   "Income",
  goal:     "Goal",
  maturity: "Maturity",
};

const TYPE_ICON: Record<AppNotification["type"], React.ElementType> = {
  budget:   Target,
  income:   TrendingUp,
  goal:     Flag,
  maturity: Clock,
};

const TYPE_HREF: Record<AppNotification["type"], string> = {
  budget:   "/budgets",
  income:   "/expenses?tab=income",
  goal:     "/goals",
  maturity: "/investments",
};

type Filter = "all" | AppNotification["type"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all",      label: "All"      },
  { value: "budget",   label: "Budgets"  },
  { value: "goal",     label: "Goals"    },
  { value: "income",   label: "Income"   },
  { value: "maturity", label: "Maturity" },
];

function formatNotifDate(dateStr?: string) {
  if (!dateStr) return "Today";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function getDateGroup(dateStr?: string): string {
  if (!dateStr) return "Today";
  const d   = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff <= 7)  return "This Week";
  return "Older";
}

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "Older"];

function NotifRow({
  n, isNew, onDismiss,
}: {
  n: AppNotification;
  isNew: boolean;
  onDismiss: () => void;
}) {
  const SeverityIcon = SEVERITY_ICON[n.severity];
  const TypeIcon     = TYPE_ICON[n.type];
  const href         = TYPE_HREF[n.type];

  return (
    <Link href={href} className={cn(
      "flex gap-4 px-5 py-4 rounded-xl border transition-colors group",
      isNew
        ? "bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/8"
        : "bg-card border-border hover:bg-muted/40"
    )}>
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", SEVERITY_BG[n.severity])}>
        <SeverityIcon className={cn("w-4 h-4", SEVERITY_COLOR[n.severity])} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground leading-snug">{n.title}</p>
          <div className="flex items-center gap-2 shrink-0">
            {isNew && <span className="w-2 h-2 bg-indigo-500 rounded-full mt-1 shrink-0" />}
            <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap">{formatNotifDate(n.date)}</span>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
              className="opacity-0 group-hover:opacity-100 md:opacity-100 w-5 h-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-all"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.message}</p>
        <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          <TypeIcon className="w-3 h-3" />
          {TYPE_LABELS[n.type]}
        </span>
      </div>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex gap-4 px-5 py-4 rounded-xl border border-border bg-card animate-pulse">
          <div className="w-9 h-9 rounded-xl bg-muted/60 shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-2/3 bg-muted/60 rounded" />
            <div className="h-3 w-full bg-muted/40 rounded" />
            <div className="h-5 w-16 bg-muted/40 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const { notifications: localNotifs }    = useNotifications();
  const { data: serverNotifs = [], isLoading } = useServerNotifications();
  const { seenIds, markSeen }             = useNotificationStore();
  const markAllServer                     = useMarkAllServerRead();

  const serverMapped = serverNotifs.map(toAppNotification);

  const allNotifs = [...serverMapped, ...localNotifs.filter(
    (n) => !serverMapped.some((s) => s.title === n.title && s.message === n.message)
  )];

  // Count server unread excluding locally dismissed; local unread from store
  const serverUnread = serverNotifs.filter(
    n => !n.read && !seenIds.includes(`server-${n.id}`)
  ).length;
  const localUnread  = localNotifs.filter(
    n => !seenIds.includes(n.id) && !serverMapped.some(s => s.title === n.title && s.message === n.message)
  ).length;
  const unreadCount  = serverUnread + localUnread;

  const filtered = filter === "all"
    ? allNotifs
    : allNotifs.filter((n) => n.type === filter);

  // Group by date bucket
  const grouped: Record<string, AppNotification[]> = {};
  filtered.forEach(n => {
    const g = getDateGroup(n.date);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(n);
  });

  function handleMarkAllRead() {
    markSeen(allNotifs.map((n) => n.id));
    markAllServer.mutate();
  }

  function handleDismiss(n: AppNotification) {
    markSeen([n.id]);
  }

  return (
    <>
      <Header title="Notifications" />
      <PageWrapper>
        <div className="max-w-3xl space-y-6">

          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">All notifications</h2>
              {unreadCount > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-full border transition-all",
                  filter === value
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* List */}
          {isLoading ? (
            <ListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Bell className="w-7 h-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground">All clear</p>
              <p className="text-xs text-muted-foreground mt-1">No notifications in this category.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {GROUP_ORDER.filter(g => grouped[g]?.length).map(group => (
                <div key={group}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">
                    {group}
                  </p>
                  <div className="space-y-2">
                    {grouped[group].map((n) => {
                      const serverN = serverNotifs.find((s) => `server-${s.id}` === n.id);
                      const isNew   = serverN ? !serverN.read && !seenIds.includes(n.id) : !seenIds.includes(n.id);
                      return (
                        <NotifRow
                          key={n.id}
                          n={n}
                          isNew={isNew}
                          onDismiss={() => handleDismiss(n)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </PageWrapper>
    </>
  );
}
