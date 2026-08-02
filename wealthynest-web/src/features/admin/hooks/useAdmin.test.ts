import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  useAdminStats, useAdminUsers, useToggleUserActive, useUpdateUserRole, useResetUserPassword,
  useDeleteUserPermanently, useAdminAuditLogs, useUserGrowth, useAdminJobs, useTriggerJob,
  useUpdateJobSchedule, useSystemHealth,
} from "./useAdmin";
import { adminApi } from "../api/admin.api";
import { toast } from "sonner";

vi.mock("../api/admin.api", () => ({
  adminApi: {
    getStats: vi.fn(), listUsers: vi.fn(), toggleActive: vi.fn(), updateRole: vi.fn(),
    resetPassword: vi.fn(), deleteUserPermanently: vi.fn(), getAuditLogs: vi.fn(), getUserGrowth: vi.fn(),
    listJobs: vi.fn(), triggerJob: vi.fn(), updateSchedule: vi.fn(), getSystemHealth: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(adminApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAdminStats", () => {
  it("fetches admin stats", async () => {
    mockedApi.getStats.mockResolvedValue({ totalUsers: 10 } as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAdminStats(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useAdminUsers", () => {
  it("converts a blank search string to undefined", async () => {
    mockedApi.listUsers.mockResolvedValue({ data: [] } as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAdminUsers(0, "", 20), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.listUsers).toHaveBeenCalledWith(0, 20, undefined);
  });

  it("passes a real search string through", async () => {
    mockedApi.listUsers.mockResolvedValue({ data: [] } as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAdminUsers(0, "alice", 20), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.listUsers).toHaveBeenCalledWith(0, 20, "alice");
  });
});

describe("useToggleUserActive", () => {
  it("invalidates the admin key and toasts on success", async () => {
    mockedApi.toggleActive.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useToggleUserActive(), { wrapper: Wrapper });
    result.current.mutate("u1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin"] });
    expect(toast.success).toHaveBeenCalledWith("User status updated");
  });
});

describe("useUpdateUserRole", () => {
  it("passes id/role through", async () => {
    mockedApi.updateRole.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateUserRole(), { wrapper: Wrapper });
    result.current.mutate({ id: "u1", role: "ADMIN" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.updateRole).toHaveBeenCalledWith("u1", "ADMIN");
    expect(toast.success).toHaveBeenCalledWith("Role updated");
  });
});

describe("useResetUserPassword", () => {
  it("toasts a confirmation on success", async () => {
    mockedApi.resetPassword.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useResetUserPassword(), { wrapper: Wrapper });
    result.current.mutate("u1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Password reset email sent");
  });
});

describe("useDeleteUserPermanently", () => {
  it("invalidates the admin key and toasts on success", async () => {
    mockedApi.deleteUserPermanently.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteUserPermanently(), { wrapper: Wrapper });
    result.current.mutate("u1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.deleteUserPermanently).toHaveBeenCalledWith("u1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin"] });
    expect(toast.success).toHaveBeenCalledWith("Account permanently deleted");
  });

  it("shows the backend's real error message on failure, e.g. an open support ticket", async () => {
    mockedApi.deleteUserPermanently.mockRejectedValue({
      response: { data: { message: "This user has an open support ticket. Resolve or close it before permanent deletion." } },
    });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteUserPermanently(), { wrapper: Wrapper });
    result.current.mutate("u1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("This user has an open support ticket. Resolve or close it before permanent deletion.");
  });
});

describe("useAdminAuditLogs", () => {
  it("passes page/size/userId/action through", async () => {
    mockedApi.getAuditLogs.mockResolvedValue({ data: [] } as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAdminAuditLogs(1, 10, "u1", "USER_ROLE_CHANGED"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getAuditLogs).toHaveBeenCalledWith(1, 10, "u1", "USER_ROLE_CHANGED");
  });
});

describe("useUserGrowth", () => {
  it("fetches the growth series", async () => {
    mockedApi.getUserGrowth.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useUserGrowth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useAdminJobs", () => {
  it("fetches the job list", async () => {
    mockedApi.listJobs.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAdminJobs(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useTriggerJob", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("immediately invalidates jobs/income-history and toasts on success", async () => {
    mockedApi.triggerJob.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTriggerJob(), { wrapper: Wrapper });
    result.current.mutate("GOLD_PRICE");

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("GOLD_PRICE triggered — running in background");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "jobs"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["income-history"] });
  });

  it("invalidates investments/net-worth/analytics/income-history again after the job's configured delay", async () => {
    mockedApi.triggerJob.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTriggerJob(), { wrapper: Wrapper });
    result.current.mutate("GOLD_PRICE"); // 5_000ms delay

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    invalidateSpy.mockClear();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["investments"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["net-worth"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["analytics"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["income-history"] });
  });

  it("uses the 10s default delay for a job with no configured JOB_REFRESH_DELAY entry", async () => {
    mockedApi.triggerJob.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTriggerJob(), { wrapper: Wrapper });
    result.current.mutate("SOME_UNKNOWN_JOB");

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    invalidateSpy.mockClear();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["investments"] });
  });

  it("shows the backend's real error message on failure", async () => {
    mockedApi.triggerJob.mockRejectedValue({ response: { data: { message: "Job already running" } } });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useTriggerJob(), { wrapper: Wrapper });
    result.current.mutate("GOLD_PRICE");

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Job already running");
  });
});

describe("useSystemHealth", () => {
  it("does not fetch on mount — only when explicitly refetched", () => {
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useSystemHealth(), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApi.getSystemHealth).not.toHaveBeenCalled();
  });

  it("fetches health details on refetch()", async () => {
    mockedApi.getSystemHealth.mockResolvedValue({
      status: "UP",
      components: { db: { status: "UP" } },
    } as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useSystemHealth(), { wrapper: Wrapper });

    result.current.refetch();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ status: "UP", components: { db: { status: "UP" } } });
  });
});

describe("useUpdateJobSchedule", () => {
  it("passes jobName/cron through and invalidates jobs on success", async () => {
    mockedApi.updateSchedule.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateJobSchedule(), { wrapper: Wrapper });
    result.current.mutate({ jobName: "AUTO_INCOME", cron: "0 15 3 * * *" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.updateSchedule).toHaveBeenCalledWith("AUTO_INCOME", "0 15 3 * * *");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "jobs"] });
    expect(toast.success).toHaveBeenCalledWith("Schedule updated");
  });
});
