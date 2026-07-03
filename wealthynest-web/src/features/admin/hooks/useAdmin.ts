"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../api/admin.api";

export function useAdminStats() {
  return useQuery({ queryKey: ["admin", "stats"], queryFn: adminApi.getStats });
}

export function useAdminUsers(page = 0, search = "", size = 20) {
  return useQuery({
    queryKey: ["admin", "users", page, search, size],
    queryFn:  () => adminApi.listUsers(page, size, search || undefined),
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.toggleActive(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast.success("User status updated"); },
    onError:   () => toast.error("Failed to update user"),
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => adminApi.updateRole(id, role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast.success("Role updated"); },
    onError:   () => toast.error("Failed to update role"),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (id: string) => adminApi.resetPassword(id),
    onSuccess:  () => toast.success("Password reset email sent"),
    onError:    () => toast.error("Failed to send reset email"),
  });
}

export function useAdminAuditLogs(page = 0, size = 20, userId?: string, action?: string) {
  return useQuery({
    queryKey: ["admin", "audit-logs", page, size, userId, action],
    queryFn:  () => adminApi.getAuditLogs(page, size, userId, action),
  });
}

export function useUserGrowth() {
  return useQuery({
    queryKey: ["admin", "user-growth"],
    queryFn:  adminApi.getUserGrowth,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export function useAdminJobs() {
  return useQuery({
    queryKey: ["admin", "jobs"],
    queryFn:  adminApi.listJobs,
    refetchInterval: 5000,
  });
}

// How long to wait before refreshing investment/net-worth data after each job type
const JOB_REFRESH_DELAY: Record<string, number> = {
  NSE_EOD:            20_000, // bhavcopy download + 2400+ price updates
  GOLD_PRICE:          5_000, // single API call
  MF_NAV:             12_000, // per-fund NAV calls
  AUTO_INCOME:        35_000, // per-stock with 2 s delays
  RECURRING_EXPENSES:  5_000, // expense processing only
};

export function useTriggerJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobName: string) => adminApi.triggerJob(jobName),
    onSuccess: (_, jobName) => {
      toast.success(`${jobName} triggered — running in background`);
      qc.invalidateQueries({ queryKey: ["admin", "jobs"] });
      qc.invalidateQueries({ queryKey: ["income-history"] });

      const delay = JOB_REFRESH_DELAY[jobName] ?? 10_000;
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["investments"] });
        qc.invalidateQueries({ queryKey: ["net-worth"] });   // matches ["net-worth", "summary"]
        qc.invalidateQueries({ queryKey: ["analytics"] });   // matches ["analytics", "dashboard"]
        qc.invalidateQueries({ queryKey: ["income-history"] });
      }, delay);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to trigger job"),
  });
}

export function useUpdateJobSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobName, cron }: { jobName: string; cron: string }) =>
      adminApi.updateSchedule(jobName, cron),
    onSuccess: () => {
      toast.success("Schedule updated");
      qc.invalidateQueries({ queryKey: ["admin", "jobs"] });
    },
    onError: () => toast.error("Failed to update schedule"),
  });
}
