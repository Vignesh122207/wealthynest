import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  toAppNotification, useServerNotifications, useMarkAllServerRead, useMergedNotifications,
} from "./useServerNotifications";
import { notificationsApi } from "../api/notifications.api";
import { useNotifications } from "@/hooks/useNotifications";
import { useNotificationStore } from "@/store/notification.store";
import type { ServerNotification } from "../api/notifications.api";

vi.mock("../api/notifications.api", () => ({
  notificationsApi: { getNotifications: vi.fn(), markAllRead: vi.fn() },
}));
vi.mock("@/hooks/useNotifications", () => ({ useNotifications: vi.fn() }));

const mockedApi = vi.mocked(notificationsApi);
const mockedUseNotifications = vi.mocked(useNotifications);

beforeEach(() => {
  vi.clearAllMocks();
  useNotificationStore.setState({ seenIds: [], prefs: { budgets: true, income: true, goals: true, maturity: true } });
});

describe("toAppNotification", () => {
  const base: ServerNotification = {
    id: "1", type: "BUDGET_EXCEEDED", title: "Budget exceeded", message: "Groceries over budget",
    read: false, createdAt: "2026-07-01T00:00:00Z",
  } as ServerNotification;

  it("prefixes the id with 'server-' to avoid colliding with local notification ids", () => {
    expect(toAppNotification(base).id).toBe("server-1");
  });

  it.each([
    ["LOW_BALANCE_ALERT", "lowBalance"],
    ["SPEND_ANOMALY_DETECTED", "anomaly"],
    ["DEBT_DUE_SOON", "debtDue"],
    ["LOAN_EMI_DUE", "loanEmi"],
    ["BUDGET_EXCEEDED", "budget"],
    ["GOAL_ACHIEVED", "goal"],
    ["DIVIDEND_CREDITED", "income"],
    ["FD_MATURITY", "maturity"],
    ["SOMETHING_UNMAPPED", "budget"],
  ])("maps server type %s to app type %s", (serverType, appType) => {
    expect(toAppNotification({ ...base, type: serverType }).type).toBe(appType);
  });

  it("maps 'exceeded' in the title/type to error severity", () => {
    expect(toAppNotification({ ...base, title: "Budget exceeded" }).severity).toBe("error");
  });

  it("maps 'low balance' to warning severity", () => {
    expect(toAppNotification({ ...base, type: "LOW_BALANCE_ALERT", title: "Low balance" }).severity).toBe("warning");
  });

  it("maps 'achieved' to success severity", () => {
    expect(toAppNotification({ ...base, type: "GOAL_ACHIEVED", title: "Goal achieved" }).severity).toBe("success");
  });

  it("defaults to info severity when nothing matches", () => {
    expect(toAppNotification({ ...base, type: "OTHER", title: "Just FYI" }).severity).toBe("info");
  });
});

describe("useServerNotifications", () => {
  it("fetches server notifications", async () => {
    mockedApi.getNotifications.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useServerNotifications(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useMarkAllServerRead", () => {
  it("invalidates server-notifications on success", async () => {
    mockedApi.markAllRead.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useMarkAllServerRead(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["server-notifications"] });
  });
});

describe("useMergedNotifications", () => {
  const serverNotif: ServerNotification = {
    id: "s1", type: "BUDGET_EXCEEDED", title: "Groceries over budget", message: "You've spent 110%",
    read: false, createdAt: "2026-07-01T00:00:00Z",
  } as ServerNotification;

  it("dedupes a local notification that matches a server one by title+message", async () => {
    mockedApi.getNotifications.mockResolvedValue([serverNotif] as never);
    mockedUseNotifications.mockReturnValue({
      notifications: [{ id: "local-1", type: "budget", title: "Groceries over budget", message: "You've spent 110%", severity: "error" }],
    } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useMergedNotifications(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.notifications[0]?.id).toBe("server-s1"));
    expect(result.current.notifications).toHaveLength(1);
  });

  it("keeps a local notification that doesn't match any server one", async () => {
    mockedApi.getNotifications.mockResolvedValue([serverNotif] as never);
    mockedUseNotifications.mockReturnValue({
      notifications: [{ id: "local-2", type: "goal", title: "Goal achieved!", message: "Emergency Fund is fully funded", severity: "success" }],
    } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useMergedNotifications(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
  });

  it("counts unread as server-unread + local-unread, excluding anything already in seenIds", async () => {
    mockedApi.getNotifications.mockResolvedValue([serverNotif] as never);
    mockedUseNotifications.mockReturnValue({
      notifications: [{ id: "local-2", type: "goal", title: "Goal achieved!", message: "Fund is full", severity: "success" }],
    } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useMergedNotifications(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(result.current.unreadCount).toBe(2);
  });

  it("excludes a seen server notification from the unread count", async () => {
    mockedApi.getNotifications.mockResolvedValue([serverNotif] as never);
    mockedUseNotifications.mockReturnValue({ notifications: [] } as never);
    useNotificationStore.setState({ seenIds: ["server-s1"] });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useMergedNotifications(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    expect(result.current.unreadCount).toBe(0);
  });
});
