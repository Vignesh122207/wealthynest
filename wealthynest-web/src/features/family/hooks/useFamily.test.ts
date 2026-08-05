import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  useFamily, useFamilyMembers, useCreateFamily, useJoinFamily, useRenameFamily,
  useLeaveFamily, useRemoveMember, useDeleteFamily, useFamilyExpenses, useFamilyNetWorth,
  useFamilyMonthlyStats, useTransferAdmin, useRevokeAdmin,
} from "./useFamily";
import { familyApi } from "../api/family.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { toast } from "sonner";
import type { User } from "@/features/auth/types/auth.types";

vi.mock("../api/family.api", () => ({
  familyApi: {
    getFamily: vi.fn(), getMembers: vi.fn(), createFamily: vi.fn(), joinFamily: vi.fn(),
    renameFamily: vi.fn(), leaveFamily: vi.fn(), removeMember: vi.fn(), deleteFamily: vi.fn(),
    getFamilyExpenses: vi.fn(), getFamilyNetWorth: vi.fn(), getFamilyMonthlyStats: vi.fn(),
    transferAdmin: vi.fn(), revokeAdmin: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(familyApi);
const ALL_SCOPED_KEYS = [
  QUERY_KEYS.ASSETS, QUERY_KEYS.NET_WORTH, QUERY_KEYS.NET_WORTH_SUMMARY, QUERY_KEYS.LIABILITIES,
  QUERY_KEYS.EXPENSES, QUERY_KEYS.BUDGETS, QUERY_KEYS.CATEGORIES, QUERY_KEYS.ACCOUNTS, QUERY_KEYS.DASHBOARD,
];

const baseUser: User = {
  id: "u1", fullName: "Alice", email: "a@x.com", role: "MEMBER",
  active: true, createdAt: "2026-01-01", pinEnabled: false, hasPasskeys: false, loginAlertEnabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, userVersion: 0 });
});

describe("useFamily", () => {
  it("is disabled when the user has no familyId", () => {
    useAuthStore.setState({ user: baseUser });
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useFamily(), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApi.getFamily).not.toHaveBeenCalled();
  });

  it("fetches when the user has a familyId", async () => {
    useAuthStore.setState({ user: { ...baseUser, familyId: "f1" } });
    mockedApi.getFamily.mockResolvedValue({ id: "f1" } as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useFamily(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getFamily).toHaveBeenCalledWith("f1");
  });
});

describe("useFamilyMembers", () => {
  it("is disabled when familyId is undefined", () => {
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useFamilyMembers(undefined), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useCreateFamily", () => {
  it("sets the user's familyId/role to FAMILY_ADMIN, invalidates scoped data + FAMILY, and toasts", async () => {
    useAuthStore.setState({ user: baseUser });
    mockedApi.createFamily.mockResolvedValue({ id: "f1" } as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateFamily(), { wrapper: Wrapper });
    result.current.mutate("The Smiths");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user).toEqual({ ...baseUser, familyId: "f1", role: "FAMILY_ADMIN" });
    for (const key of ALL_SCOPED_KEYS) expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.FAMILY });
    expect(toast.success).toHaveBeenCalledWith("Family created!");
  });
});

describe("useJoinFamily", () => {
  it("sets the user's familyId/role to MEMBER and toasts on success", async () => {
    useAuthStore.setState({ user: baseUser });
    mockedApi.joinFamily.mockResolvedValue({ id: "f1" } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useJoinFamily(), { wrapper: Wrapper });
    result.current.mutate("INVITE123");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user).toEqual({ ...baseUser, familyId: "f1", role: "MEMBER" });
    expect(toast.success).toHaveBeenCalledWith("Joined family!");
  });

  it("shows the 'already in a family' message when the backend error mentions 'already'", async () => {
    mockedApi.joinFamily.mockRejectedValue({ response: { data: { message: "User is already a member" } } });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useJoinFamily(), { wrapper: Wrapper });
    result.current.mutate("INVITE123");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("You are already in a family group.");
  });

  it("shows the generic invalid-invite message for any other error", async () => {
    mockedApi.joinFamily.mockRejectedValue({ response: { data: { message: "Invite code not found" } } });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useJoinFamily(), { wrapper: Wrapper });
    result.current.mutate("BOGUS");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Invalid invite code. Please check and try again.");
  });
});

describe("useRenameFamily", () => {
  it("invalidates only FAMILY (not the scoped-data keys) and toasts", async () => {
    mockedApi.renameFamily.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRenameFamily(), { wrapper: Wrapper });
    result.current.mutate({ id: "f1", name: "New Name" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.FAMILY });
    expect(toast.success).toHaveBeenCalledWith("Family renamed!");
  });
});

describe("useLeaveFamily", () => {
  it("clears the user's familyId, EVICTS (not invalidates) the FAMILY identity, and toasts", async () => {
    useAuthStore.setState({ user: { ...baseUser, familyId: "f1", role: "FAMILY_ADMIN" } });
    mockedApi.leaveFamily.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const removeSpy = vi.spyOn(queryClient, "removeQueries");
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useLeaveFamily(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user).toEqual({ ...baseUser, familyId: undefined, role: "MEMBER" });
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.FAMILY });
    // The own FAMILY identity key must NOT be invalidated (only scoped-data keys are)
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: QUERY_KEYS.FAMILY });
    expect(toast.success).toHaveBeenCalledWith("You have left the family group.");
  });

  it("shows the backend's real error message on failure", async () => {
    mockedApi.leaveFamily.mockRejectedValue({ response: { data: { message: "You are the only admin" } } });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useLeaveFamily(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("You are the only admin");
  });
});

describe("useRemoveMember", () => {
  it("invalidates scoped data + FAMILY (refetch, not evict) and toasts", async () => {
    mockedApi.removeMember.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRemoveMember("f1"), { wrapper: Wrapper });
    result.current.mutate("member-2");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.removeMember).toHaveBeenCalledWith("f1", "member-2");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.FAMILY });
    expect(toast.success).toHaveBeenCalledWith("Member removed.");
  });
});

describe("useDeleteFamily", () => {
  it("preserves an ADMIN role but clears familyId, and evicts the FAMILY identity", async () => {
    useAuthStore.setState({ user: { ...baseUser, role: "ADMIN", familyId: "f1" } });
    mockedApi.deleteFamily.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const removeSpy = vi.spyOn(queryClient, "removeQueries");

    const { result } = renderHook(() => useDeleteFamily(), { wrapper: Wrapper });
    result.current.mutate("f1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user).toEqual({ ...baseUser, role: "ADMIN", familyId: undefined });
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.FAMILY });
    expect(toast.success).toHaveBeenCalledWith("Family group deleted.");
  });

  it("downgrades a FAMILY_ADMIN to MEMBER (the role only meant something within that family)", async () => {
    useAuthStore.setState({ user: { ...baseUser, role: "FAMILY_ADMIN", familyId: "f1" } });
    mockedApi.deleteFamily.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteFamily(), { wrapper: Wrapper });
    result.current.mutate("f1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user?.role).toBe("MEMBER");
  });
});

describe("useFamilyExpenses / useFamilyNetWorth / useFamilyMonthlyStats", () => {
  it("useFamilyExpenses is disabled without a familyId", () => {
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useFamilyExpenses(undefined), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useFamilyExpenses fetches with familyId/startDate/endDate when given", async () => {
    mockedApi.getFamilyExpenses.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useFamilyExpenses("f1", "2026-01-01", "2026-01-31"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getFamilyExpenses).toHaveBeenCalledWith("f1", "2026-01-01", "2026-01-31");
  });

  it("useFamilyNetWorth is disabled without a familyId", () => {
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useFamilyNetWorth(undefined), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useFamilyMonthlyStats fetches with familyId/year/month", async () => {
    mockedApi.getFamilyMonthlyStats.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useFamilyMonthlyStats("f1", 2026, 7), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getFamilyMonthlyStats).toHaveBeenCalledWith("f1", 2026, 7);
  });
});

describe("useTransferAdmin / useRevokeAdmin", () => {
  it("useTransferAdmin invalidates FAMILY and the members key, then toasts", async () => {
    mockedApi.transferAdmin.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTransferAdmin("f1"), { wrapper: Wrapper });
    result.current.mutate("member-2");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.transferAdmin).toHaveBeenCalledWith("f1", "member-2");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.FAMILY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...QUERY_KEYS.FAMILY, "members", "f1"] });
    expect(toast.success).toHaveBeenCalledWith("Member promoted to admin.");
  });

  it("useRevokeAdmin shows the backend's real error message on failure", async () => {
    mockedApi.revokeAdmin.mockRejectedValue({ response: { data: { message: "Cannot revoke the last admin" } } });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useRevokeAdmin("f1"), { wrapper: Wrapper });
    result.current.mutate("member-2");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Cannot revoke the last admin");
  });
});
