"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, type ServerNotification } from "../api/notifications.api";
import type { AppNotification, NotifSeverity } from "@/hooks/useNotifications";

function mapServerType(type: string): AppNotification["type"] {
  if (type.includes("BUDGET")) return "budget";
  if (type.includes("GOAL"))   return "goal";
  if (type.includes("INCOME") || type.includes("DIVIDEND")) return "income";
  if (type.includes("MATURITY") || type.includes("FD") || type.includes("BOND")) return "maturity";
  return "budget";
}

function mapServerSeverity(type: string, title: string): NotifSeverity {
  const t = (type + title).toLowerCase();
  if (t.includes("exceeded") || t.includes("over") || t.includes("breach")) return "error";
  if (t.includes("warning") || t.includes("nearly") || t.includes("alert")) return "warning";
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

export function useServerUnreadCount() {
  return useQuery({
    queryKey: ["server-notifications-count"],
    queryFn:  notificationsApi.getUnreadCount,
    staleTime: 30_000,
  });
}

export function useMarkAllServerRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["server-notifications"] });
      qc.invalidateQueries({ queryKey: ["server-notifications-count"] });
    },
  });
}
