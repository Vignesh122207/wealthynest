import {apiClient} from "@/lib/axios";
import type {ApiResponse, PagedResponse} from "@/types/api.types";
import type {User} from "@/features/auth/types/auth.types";

// Actuator is mounted at the API server's root, not under /api/v1 — same reasoning as
// infrastructure/smoke-tests/post-deploy.spec.ts's own apiOrigin derivation. apiClient's request
// interceptor attaches the Authorization header to any request through this instance regardless
// of the URL being absolute, so reusing it here (instead of a bare fetch/new axios instance)
// still gets the real logged-in admin's token — SecurityConfig now requires ADMIN for anything
// under /actuator/** beyond health/info.
const ACTUATOR_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1").origin;

export interface ActuatorHealthComponent {
  status: string;
  details?: Record<string, unknown>;
}

export interface ActuatorHealth {
  status: string;
  components?: Record<string, ActuatorHealthComponent>;
}

export interface JobScheduleConfig {
  jobName:         string;
  displayName:     string;
  cronExpression:  string;
  timezone:        string;
  enabled:         boolean;
  lastRunAt?:      string;
  lastRunStatus?:  "SUCCESS" | "FAILED" | "RUNNING";
  lastRunMessage?: string;
}

export interface AuditLogEntry {
  id:          string;
  userId?:     string;
  userEmail?:  string;
  action:      string;
  entityType?: string;
  entityId?:   string;
  oldValue?:   Record<string, unknown>;
  newValue?:   Record<string, unknown>;
  ipAddress?:  string;
  createdAt:   string;
}

export interface UserGrowthPoint {
  month: string; // "YYYY-MM"
  count: number;
}

export interface SystemSettings {
  loginAlertEmailEnabled: boolean;
}

export const adminApi = {
  getStats: async (): Promise<Record<string, number>> =>
    (await apiClient.get<ApiResponse<Record<string, number>>>("/admin/stats")).data.data,

  listUsers: async (page = 0, size = 20, search?: string): Promise<PagedResponse<User>> =>
    (await apiClient.get<PagedResponse<User>>("/admin/users", {
      params: { page, size, ...(search ? { search } : {}) },
    })).data,

  toggleActive: async (id: string): Promise<User> =>
    (await apiClient.patch<ApiResponse<User>>(`/admin/users/${id}/toggle-active`)).data.data,

  updateRole: async (id: string, role: string): Promise<User> =>
    (await apiClient.patch<ApiResponse<User>>(`/admin/users/${id}/role?role=${role}`)).data.data,

  resetPassword: async (id: string): Promise<string> =>
    (await apiClient.post<ApiResponse<string>>(`/admin/users/${id}/reset-password`)).data.data,

  // Irreversible — erases the account and every row it owns. See /delete-account's "permanent
  // erasure" promise; distinct from a soft deactivate (toggleActive).
  deleteUserPermanently: async (id: string): Promise<void> => {
    await apiClient.delete<ApiResponse<void>>(`/admin/users/${id}`);
  },

  // ── User Growth ───────────────────────────────────────────────────────────

  getUserGrowth: async (): Promise<UserGrowthPoint[]> =>
    (await apiClient.get<ApiResponse<UserGrowthPoint[]>>("/admin/user-growth")).data.data,

  // ── Audit Logs ────────────────────────────────────────────────────────────

  getAuditLogs: async (page = 0, size = 20, userId?: string, action?: string): Promise<PagedResponse<AuditLogEntry>> =>
    (await apiClient.get<PagedResponse<AuditLogEntry>>("/admin/audit-logs", {
      params: {
        page, size,
        ...(userId ? { userId } : {}),
        ...(action ? { action } : {}),
      },
    })).data,

  // ── Jobs ──────────────────────────────────────────────────────────────────

  listJobs: async (): Promise<JobScheduleConfig[]> =>
    (await apiClient.get<ApiResponse<JobScheduleConfig[]>>("/admin/jobs")).data.data,

  triggerJob: async (jobName: string): Promise<string> =>
    (await apiClient.post<ApiResponse<string>>(`/admin/jobs/${jobName}/trigger`)).data.data,

  updateSchedule: async (jobName: string, cron: string): Promise<JobScheduleConfig> =>
    (await apiClient.put<ApiResponse<JobScheduleConfig>>(
      `/admin/jobs/${jobName}/schedule?cron=${encodeURIComponent(cron)}`)).data.data,

  // ── System Health (Actuator) ─────────────────────────────────────────────────

  getSystemHealth: async (): Promise<ActuatorHealth> =>
    (await apiClient.get<ActuatorHealth>(`${ACTUATOR_ORIGIN}/actuator/health`)).data,

  // ── System Settings ──────────────────────────────────────────────────────

  getSystemSettings: async (): Promise<SystemSettings> =>
    (await apiClient.get<ApiResponse<SystemSettings>>("/admin/settings")).data.data,

  updateSystemSettings: async (loginAlertEmailEnabled: boolean): Promise<SystemSettings> =>
    (await apiClient.patch<ApiResponse<SystemSettings>>(
      `/admin/settings?loginAlertEmailEnabled=${loginAlertEmailEnabled}`)).data.data,
};
