"use client";

import {useState} from "react";
import Link from "next/link";
import {
    AlertCircle,
    AlertTriangle,
    Bell,
    CalendarClock,
    CheckCircle2,
    Clock,
    Flag,
    Flame,
    Info,
    Landmark,
    LineChart,
    type LucideIcon,
    Target,
    TrendingUp,
    Wallet,
    X,
} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {type IconTone, PremiumIcon} from "@/components/icons/PremiumIcon";
import {type AppNotification, type NotifSeverity} from "@/hooks/useNotifications";
import {useNotificationStore} from "@/store/notification.store";
import {
    useDeleteServerNotification,
    useMarkAllServerRead,
    useMarkServerRead,
    useMergedNotifications,
    useServerNotifications
} from "@/features/notifications/hooks/useServerNotifications";
import {TabBar, type TabBarItem} from "@/components/ui/TabBar";
import {cn} from "@/lib/utils";

const SEVERITY_ICON: Record<NotifSeverity, LucideIcon> = {
  error:   AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info:    Info,
};

const SEVERITY_TONE: Record<NotifSeverity, IconTone> = {
  error:   "red",
  warning: "orange",
  success: "green",
  info:    "indigo",
};

const TYPE_LABELS: Record<AppNotification["type"], string> = {
  budget:     "Budget",
  income:     "Income",
  goal:       "Goal",
  maturity:   "Maturity",
  lowBalance: "Low Balance",
  anomaly:    "Unusual Spend",
  debtDue:    "Debt Due",
  loanEmi:    "Loan EMI",
  sipReminder: "SIP Reminder",
};

const TYPE_ICON: Record<AppNotification["type"], LucideIcon> = {
  budget:     Target,
  income:     TrendingUp,
  goal:       Flag,
  maturity:   Clock,
  lowBalance: Wallet,
  anomaly:    Flame,
  debtDue:    CalendarClock,
  loanEmi:    Landmark,
  sipReminder: LineChart,
};

const TYPE_HREF: Record<AppNotification["type"], string> = {
  budget:     "/budgets",
  income:     "/expenses?tab=income",
  goal:       "/goals",
  maturity:   "/investments",
  lowBalance: "/accounts",
  anomaly:    "/expenses",
  debtDue:    "/debts",
  loanEmi:    "/accounts",
  sipReminder: "/investments",
};

type Filter = "all" | AppNotification["type"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all",        label: "All"           },
  { value: "budget",     label: "Budgets"       },
  { value: "goal",       label: "Goals"         },
  { value: "income",     label: "Income"        },
  { value: "maturity",   label: "Maturity"      },
  { value: "lowBalance", label: "Low Balance"   },
  { value: "anomaly",    label: "Unusual Spend" },
  { value: "debtDue",    label: "Debt Due"      },
  { value: "loanEmi",    label: "Loan EMI"      },
];

// One color per alert type — reuses each type's own domain color from elsewhere in the app
// (Budgets=amber, Income=emerald, Debts=rose, etc.) rather than the flat single-color chips this
// page used before.
const FILTER_COLOR: Record<Filter, string> = {
  all:        "#475569",
  budget:     "#d97706",
  goal:       "#c026d3",
  income:     "#059669",
  maturity:   "#7c3aed",
  lowBalance: "#dc2626",
  anomaly:    "#db2777",
  debtDue:    "#e11d48",
  loanEmi:    "#0284c7",
  sipReminder: "#0284c7",
};

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
  n, isNew, onOpen, onDismiss,
}: {
  n: AppNotification;
  isNew: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const SeverityIcon = SEVERITY_ICON[n.severity];
  const TypeIcon     = TYPE_ICON[n.type];
  const href         = TYPE_HREF[n.type];

  return (
    <Link href={href} onClick={onOpen} className={cn(
      "flex gap-4 px-5 py-4 rounded-xl border transition-colors group",
      isNew
        ? "bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/8"
        : "bg-card border-border hover:bg-muted/40"
    )}>
      <PremiumIcon icon={SeverityIcon} tone={SEVERITY_TONE[n.severity]} size="sm" className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground leading-snug">{n.title}</p>
          <div className="flex items-center gap-2 shrink-0">
            {isNew && <span className="w-2 h-2 bg-indigo-500 rounded-full mt-1 shrink-0" />}
            <span className="text-[11px] text-muted-foreground/80 whitespace-nowrap">{formatNotifDate(n.date)}</span>
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

  const { data: serverNotifs = [], isLoading, isError, refetch } = useServerNotifications();
  const { notifications: allNotifs, unreadCount }  = useMergedNotifications();
  const { seenIds, markSeen, dismiss }             = useNotificationStore();
  const markAllServer                              = useMarkAllServerRead();
  const markServerRead                             = useMarkServerRead();
  const deleteServerNotif                          = useDeleteServerNotification();

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

  function handleOpen(n: AppNotification) {
    markSeen([n.id]);
    if (n.id.startsWith("server-")) {
      markServerRead.mutate(n.id.slice("server-".length));
    }
  }

  function handleDismiss(n: AppNotification) {
    if (n.id.startsWith("server-")) {
      deleteServerNotif.mutate(n.id.slice("server-".length));
    } else {
      dismiss(n.id);
    }
  }

  return (
    <>
      <Header title="Notifications" subtitle="Stay on top of alerts, reminders, and account activity" />
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
                data-testid="notifications-mark-all-read"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Filters — shared TabBar template, same as every other section's filter tabs. */}
          <TabBar
            items={FILTERS.map(({ value, label }): TabBarItem<Filter> => ({
              key: value, label, icon: value === "all" ? Bell : TYPE_ICON[value], color: FILTER_COLOR[value],
              count: value === "all" ? undefined : allNotifs.filter(n => n.type === value).length,
            }))}
            value={filter}
            onChange={setFilter}
            testIdPrefix="notification-filter"
          />

          {/* List */}
          {isLoading ? (
            <ListSkeleton />
          ) : isError ? (
            <QueryErrorState onRetry={() => refetch()} description="Couldn't load your notifications. Check your connection and try again." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="All clear"
              description="No notifications in this category."
              className="py-20"
            />
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
                          onOpen={() => handleOpen(n)}
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
