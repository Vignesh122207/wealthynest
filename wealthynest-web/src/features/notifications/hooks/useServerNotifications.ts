"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, type ServerNotification } from "../api/notifications.api";
import { useNotifications, type AppNotification, type NotifSeverity } from "@/hooks/useNotifications";
import { useNotificationStore } from "@/store/notification.store";

function mapServerType(type: string): AppNotification["type"] {
  if (type.includes("LOW_BALANCE"))   return "lowBalance";
  if (type.includes("SPEND_ANOMALY")) return "anomaly";
  if (type.includes("DEBT_DUE"))      return "debtDue";
  if (type.includes("LOAN_EMI"))      return "loanEmi";
  if (type.includes("BUDGET")) return "budget";
  if (type.includes("GOAL"))   return "goal";
  if (type.includes("INCOME") || type.includes("DIVIDEND")) return "income";
  if (type.includes("MATURITY") || type.includes("FD") || type.includes("BOND")) return "maturity";
  return "budget";
}

function mapServerSeverity(type: string, title: string): NotifSeverity {
  const t = (type + title).toLowerCase();
  if (t.includes("exceeded") || t.includes("over") || t.includes("breach")) return "error";
  if (t.includes("warning") || t.includes("nearly") || t.includes("alert") || t.includes("low balance") || t.includes("unusual")) return "warning";
  if (t.includes("achieved") || t.includes("credited") || t.includes("success")) return "success";
  return "info";
}

export function toAppNotification(n: ServerNotification): AppNotification {
  return {
    id:       `server-${n.id}`,
    type:     mapServerType(n.type),
    title:    n.title,
    message:  n.message,
    severity: mapServerSeverity(n.type, n.title),
    date:     n.createdAt,
  };
}

export function useServerNotifications() {
  return useQuery({
    queryKey: ["server-notifications"],
    queryFn:  notificationsApi.getNotifications,
    staleTime: 60_000,
  });
}

export function useMarkAllServerRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["server-notifications"] });
    },
  });
}

// ─── Merged local + server notifications ────────────────────────────────────
// The single source of truth for "how many unread notifications are there" and
// "what's the combined list" — every badge/panel in the app (Sidebar, Header
// bell, the /notifications page) must use this instead of computing its own,
// since a naive `localCount + serverCount` double-counts any event the backend
// and the client both independently derive (e.g. a budget-exceeded alert), and
// ignores that dismissing a notification only updates the client-side
// `seenIds` store, not the server's own unread counter.
export function useMergedNotifications() {
  const { notifications: localNotifs } = useNotifications();
  const { data: serverNotifs = [] }    = useServerNotifications();
  const { seenIds }                    = useNotificationStore();

  const serverMapped = serverNotifs.map(toAppNotification);
  const dedupedLocal = localNotifs.filter(
    (n) => !serverMapped.some((s) => s.title === n.title && s.message === n.message)
  );
  const notifications = [...serverMapped, ...dedupedLocal];

  const serverUnread = serverNotifs.filter((n) => !n.read && !seenIds.includes(`server-${n.id}`)).length;
  const localUnread  = dedupedLocal.filter((n) => !seenIds.includes(n.id)).length;

  return { notifications, unreadCount: serverUnread + localUnread };
}
