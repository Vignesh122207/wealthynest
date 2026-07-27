import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  toAppNotification, useServerNotifications, useMarkAllServerRead, useMarkServerRead,
  useDeleteServerNotification, useNotificationPreferences, useUpdateNotificationPreferences,
  useMergedNotifications,
} from "./useServerNotifications";
import { notificationsApi } from "../api/notifications.api";
import { useNotifications } from "@/hooks/useNotifications";
import { useNotificationStore } from "@/store/notification.store";
import type { ServerNotification } from "../api/notifications.api";

vi.mock("../api/notifications.api", () => ({
  notificationsApi: {
    getNotifications: vi.fn(), markAllRead: vi.fn(), markRead: vi.fn(),
    deleteNotification: vi.fn(), getPreferences: vi.fn(), updatePreferences: vi.fn(),
  },
}));
vi.mock("@/hooks/useNotifications", () => ({ useNotifications: vi.fn() }));

const mockedApi = vi.mocked(notificationsApi);
const mockedUseNotifications = vi.mocked(useNotifications);

const allPrefsOn = {
  budgets: true, income: true, goals: true, maturity: true,
  lowBalance: true, anomaly: true, debtDue: true, loanEmi: true, sipReminder: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  useNotificationStore.setState({ seenIds: [], dismissedIds: [], prefs: allPrefsOn });
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

describe("useMarkServerRead", () => {
  it("invalidates server-notifications on success", async () => {
    mockedApi.markRead.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useMarkServerRead(), { wrapper: Wrapper });
    result.current.mutate("1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["server-notifications"] });
  });

  it("does not invalidate anything on failure", async () => {
    mockedApi.markRead.mockRejectedValue(new Error("boom"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useMarkServerRead(), { wrapper: Wrapper });
    result.current.mutate("1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe("useDeleteServerNotification", () => {
  it("invalidates server-notifications on success", async () => {
    mockedApi.deleteNotification.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteServerNotification(), { wrapper: Wrapper });
    result.current.mutate("1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["server-notifications"] });
  });

  it("does not invalidate anything on failure", async () => {
    mockedApi.deleteNotification.mockRejectedValue(new Error("boom"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteServerNotification(), { wrapper: Wrapper });
    result.current.mutate("1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe("useNotificationPreferences", () => {
  it("fetches notification preferences", async () => {
    mockedApi.getPreferences.mockResolvedValue({
      budgetAlertEnabled: true, lowBalanceEnabled: true, spendAnomalyEnabled: true,
      debtDueEnabled: true, loanEmiEnabled: true,
    } as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useNotificationPreferences(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useUpdateNotificationPreferences", () => {
  it("writes the mutation result directly into the notification-preferences cache on success", async () => {
    const updated = {
      budgetAlertEnabled: false, lowBalanceEnabled: true, spendAnomalyEnabled: true,
      debtDueEnabled: true, loanEmiEnabled: true, sipReminderEnabled: true,
    };
    mockedApi.updatePreferences.mockResolvedValue(updated as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateNotificationPreferences(), { wrapper: Wrapper });
    result.current.mutate(updated);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(["notification-preferences"])).toEqual(updated);
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

  it("dedupes a budget alert even when the client and server wording don't match", async () => {
    // Regression test: the client computes "Budget exceeded: X" live from dashboard data, while
    // the server persists "Budget Alert: X" when an expense crosses the threshold — same event,
    // different wording, so an exact title+message match alone would show both.
    const serverBudgetAlert: ServerNotification = {
      id: "s2", type: "BUDGET_EXCEEDED", title: "Budget Alert: Groceries",
      message: "You've used 120% of your Groceries budget (spent ₹12000 of ₹10000).",
      read: false, createdAt: "2026-07-01T00:00:00Z",
    } as ServerNotification;
    mockedApi.getNotifications.mockResolvedValue([serverBudgetAlert] as never);
    mockedUseNotifications.mockReturnValue({
      notifications: [{
        id: "budget-over-c1", type: "budget", title: "Budget exceeded: Groceries",
        message: "Spent ₹12,000 of ₹10,000 budget", severity: "error",
      }],
    } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useMergedNotifications(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.notifications[0]?.id).toBe("server-s2"));
    expect(result.current.notifications).toHaveLength(1);
  });

  it("dedupes a period-qualified budget alert, but keeps the other period's alert for the same category distinct", async () => {
    // Regression: a category can have both a MONTHLY and a YEARLY budget breached at once.
    // Both server and client now suffix the title with "(Monthly)"/"(Yearly)" so the two don't
    // collide into one indistinguishable alert — the server-confirmed Monthly one should still
    // dedupe against its matching local entry, while the still-unconfirmed Yearly one stays.
    const serverMonthlyAlert: ServerNotification = {
      id: "s4", type: "BUDGET_EXCEEDED", title: "Budget Alert: Groceries (Monthly)",
      message: "You've used 120% of your Groceries monthly budget (spent ₹12000 of ₹10000).",
      read: false, createdAt: "2026-07-01T00:00:00Z",
    } as ServerNotification;
    mockedApi.getNotifications.mockResolvedValue([serverMonthlyAlert] as never);
    mockedUseNotifications.mockReturnValue({
      notifications: [
        {
          id: "budget-over-c1-MONTHLY", type: "budget", title: "Budget exceeded: Groceries (Monthly)",
          message: "Spent ₹12,000 of ₹10,000 monthly budget", severity: "error",
        },
        {
          id: "budget-over-c1-YEARLY", type: "budget", title: "Budget exceeded: Groceries (Yearly)",
          message: "Spent ₹90,000 of ₹80,000 yearly budget", severity: "error",
        },
      ],
    } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useMergedNotifications(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.notifications.some((n) => n.id === "server-s4")).toBe(true));
    const titles = result.current.notifications.map((n) => n.title);
    expect(result.current.notifications).toHaveLength(2);
    expect(titles).toContain("Budget Alert: Groceries (Monthly)");
    expect(titles).toContain("Budget exceeded: Groceries (Yearly)");
  });

  it("keeps a local budget alert for a different category than the server one", async () => {
    const serverBudgetAlert: ServerNotification = {
      id: "s3", type: "BUDGET_EXCEEDED", title: "Budget Alert: Groceries", message: "over budget",
      read: false, createdAt: "2026-07-01T00:00:00Z",
    } as ServerNotification;
    mockedApi.getNotifications.mockResolvedValue([serverBudgetAlert] as never);
    mockedUseNotifications.mockReturnValue({
      notifications: [{
        id: "budget-over-c2", type: "budget", title: "Budget exceeded: Dining",
        message: "Spent ₹5,000 of ₹4,000 budget", severity: "error",
      }],
    } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useMergedNotifications(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
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

  it("hides a server notification whose type has been turned off in prefs", async () => {
    const lowBalanceNotif: ServerNotification = {
      id: "s2", type: "LOW_BALANCE_ALERT", title: "Low balance: HDFC", message: "Balance is low",
      read: false, createdAt: "2026-07-01T00:00:00Z",
    } as ServerNotification;
    mockedApi.getNotifications.mockResolvedValue([lowBalanceNotif] as never);
    mockedUseNotifications.mockReturnValue({ notifications: [] } as never);
    useNotificationStore.setState({ prefs: { ...allPrefsOn, lowBalance: false } });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useMergedNotifications(), { wrapper: Wrapper });
    await waitFor(() => expect(mockedApi.getNotifications).toHaveBeenCalled());
    expect(result.current.notifications).toHaveLength(0);
  });
});
