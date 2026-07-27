import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useNotifications } from "./useNotifications";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import { useGoals } from "@/features/goals/hooks/useGoals";
import { useIncomeHistory, useInvestments } from "@/features/investments/hooks/useInvestments";
import { useNotificationStore } from "@/store/notification.store";

vi.mock("@/features/dashboard/hooks/useDashboard", () => ({ useDashboard: vi.fn() }));
vi.mock("@/features/goals/hooks/useGoals", () => ({ useGoals: vi.fn() }));
vi.mock("@/features/investments/hooks/useInvestments", () => ({ useIncomeHistory: vi.fn(), useInvestments: vi.fn() }));

const mockedUseDashboard = vi.mocked(useDashboard);
const mockedUseGoals = vi.mocked(useGoals);
const mockedUseIncomeHistory = vi.mocked(useIncomeHistory);
const mockedUseInvestments = vi.mocked(useInvestments);

function setupDefaults() {
  mockedUseDashboard.mockReturnValue({ data: undefined } as never);
  mockedUseGoals.mockReturnValue({ data: undefined } as never);
  mockedUseIncomeHistory.mockReturnValue({ data: undefined } as never);
  mockedUseInvestments.mockReturnValue({ data: [] } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
  useNotificationStore.setState({
    seenIds: [],
    dismissedIds: [],
    prefs: {
      budgets: true, income: true, goals: true, maturity: true,
      lowBalance: true, anomaly: true, debtDue: true, loanEmi: true, sipReminder: true,
    },
  });
});

describe("useNotifications — budget alerts", () => {
  it("emits an error notification for an over-budget category", () => {
    mockedUseDashboard.mockReturnValue({
      data: { budgetSummaries: [{ categoryId: "c1", categoryName: "Dining", overBudget: true, percentUsed: 120, spent: 12000, budgeted: 10000 }] },
    } as never);

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]).toMatchObject({ type: "budget", severity: "error" });
  });

  it("emits a warning notification at 80%+ used, not yet over", () => {
    mockedUseDashboard.mockReturnValue({
      data: { budgetSummaries: [{ categoryId: "c1", categoryName: "Dining", overBudget: false, percentUsed: 85, spent: 8500, budgeted: 10000 }] },
    } as never);

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications[0]).toMatchObject({ type: "budget", severity: "warning" });
  });

  it("emits nothing for a budget under 80% used", () => {
    mockedUseDashboard.mockReturnValue({
      data: { budgetSummaries: [{ categoryId: "c1", categoryName: "Dining", overBudget: false, percentUsed: 50, spent: 5000, budgeted: 10000 }] },
    } as never);

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(0);
  });

  it("gives a MONTHLY and a YEARLY breach on the same category distinct ids and titles, instead of colliding into one", () => {
    // Regression: a category can have both budget types at once; without budgetType in the id
    // and title, these read as the exact same alert shown twice.
    mockedUseDashboard.mockReturnValue({
      data: {
        budgetSummaries: [
          { categoryId: "c1", categoryName: "Groceries", budgetType: "MONTHLY", overBudget: true, percentUsed: 120, spent: 1200, budgeted: 1000 },
          { categoryId: "c1", categoryName: "Groceries", budgetType: "YEARLY",  overBudget: true, percentUsed: 105, spent: 10500, budgeted: 10000 },
        ],
      },
    } as never);

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(2);
    const [monthly, yearly] = result.current.notifications;
    expect(monthly.id).not.toBe(yearly.id);
    expect(monthly.title).not.toBe(yearly.title);
    expect(monthly.title).toBe("Budget exceeded: Groceries (Monthly)");
    expect(yearly.title).toBe("Budget exceeded: Groceries (Yearly)");
  });

  it("is suppressed entirely when prefs.budgets is off", () => {
    useNotificationStore.setState({
      prefs: {
        budgets: false, income: true, goals: true, maturity: true,
        lowBalance: true, anomaly: true, debtDue: true, loanEmi: true, sipReminder: true,
      },
    });
    mockedUseDashboard.mockReturnValue({
      data: { budgetSummaries: [{ categoryId: "c1", categoryName: "Dining", overBudget: true, percentUsed: 120, spent: 12000, budgeted: 10000 }] },
    } as never);

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(0);
  });
});

describe("useNotifications — recent income", () => {
  it("includes an income event from the last 7 days", () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    mockedUseIncomeHistory.mockReturnValue({
      data: { records: [{ id: "r1", incomeType: "DIVIDEND", eventDate: recent, amount: 500, investmentName: "TCS" }] },
    } as never);

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications[0]).toMatchObject({ type: "income", severity: "success", title: "Dividend credited" });
  });

  it("excludes an income event older than 7 days", () => {
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    mockedUseIncomeHistory.mockReturnValue({
      data: { records: [{ id: "r1", incomeType: "DIVIDEND", eventDate: old, amount: 500, investmentName: "TCS" }] },
    } as never);

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(0);
  });

  it("labels a BOND_COUPON event distinctly from a dividend", () => {
    const recent = new Date().toISOString();
    mockedUseIncomeHistory.mockReturnValue({
      data: { records: [{ id: "r1", incomeType: "BOND_COUPON", eventDate: recent, amount: 500, investmentName: "Test Bond" }] },
    } as never);

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications[0].title).toBe("Bond coupon credited");
  });
});

describe("useNotifications — goal milestones", () => {
  it("emits a success notification when a goal reaches 100%", () => {
    mockedUseGoals.mockReturnValue({ data: [{ id: "g1", name: "Emergency Fund", percentSaved: 100, targetAmount: 100000 }] } as never);
    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications[0]).toMatchObject({ type: "goal", severity: "success", title: "Goal achieved: Emergency Fund" });
  });

  it("emits an info notification in the 50-59% band", () => {
    mockedUseGoals.mockReturnValue({ data: [{ id: "g1", name: "Emergency Fund", percentSaved: 55, targetAmount: 100000 }] } as never);
    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications[0]).toMatchObject({ type: "goal", severity: "info", title: "Halfway there: Emergency Fund" });
  });

  it("emits nothing at 60% (outside the 50-59 halfway band and not yet done)", () => {
    mockedUseGoals.mockReturnValue({ data: [{ id: "g1", name: "Emergency Fund", percentSaved: 60, targetAmount: 100000 }] } as never);
    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(0);
  });
});

describe("useNotifications — maturity window", () => {
  it("emits a warning when an FD matures within 7 days", () => {
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    mockedUseInvestments.mockReturnValue({
      data: [{ id: "i1", investmentType: "FD", maturityDate: soon, bankName: "HDFC", currentValue: 100000 }],
    } as never);

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications[0]).toMatchObject({ type: "maturity", severity: "warning" });
  });

  it("emits info when a bond matures between 8 and 30 days out", () => {
    const later = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    mockedUseInvestments.mockReturnValue({
      data: [{ id: "i1", investmentType: "BOND", maturityDate: later, companyName: "Test Bond Ltd", currentValue: 50000 }],
    } as never);

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications[0]).toMatchObject({ type: "maturity", severity: "info" });
  });

  it("ignores a non-FD/BOND investment even with a maturityDate", () => {
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    mockedUseInvestments.mockReturnValue({
      data: [{ id: "i1", investmentType: "STOCK", maturityDate: soon, currentValue: 50000 }],
    } as never);

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(0);
  });

  it("ignores a maturity more than 30 days out", () => {
    const farOut = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    mockedUseInvestments.mockReturnValue({
      data: [{ id: "i1", investmentType: "FD", maturityDate: farOut, bankName: "HDFC", currentValue: 100000 }],
    } as never);

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(0);
  });
});

describe("useNotifications — sort order and unread count", () => {
  it("sorts notifications by severity: error, warning, success, info", () => {
    mockedUseGoals.mockReturnValue({ data: [
      { id: "g1", name: "Halfway Goal", percentSaved: 55, targetAmount: 1000 },
      { id: "g2", name: "Done Goal", percentSaved: 100, targetAmount: 1000 },
    ] } as never);
    mockedUseDashboard.mockReturnValue({
      data: { budgetSummaries: [{ categoryId: "c1", categoryName: "Dining", overBudget: true, percentUsed: 120, spent: 12000, budgeted: 10000 }] },
    } as never);

    const { result } = renderHook(() => useNotifications());
    const severities = result.current.notifications.map((n) => n.severity);
    expect(severities).toEqual(["error", "success", "info"]);
  });

  it("unreadCount excludes ids already in seenIds", () => {
    mockedUseGoals.mockReturnValue({ data: [{ id: "g1", name: "Done Goal", percentSaved: 100, targetAmount: 1000 }] } as never);
    useNotificationStore.setState({ seenIds: ["goal-done-g1"] });

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(0);
  });

  it("excludes a notification whose id has been dismissed", () => {
    mockedUseGoals.mockReturnValue({ data: [{ id: "g1", name: "Done Goal", percentSaved: 100, targetAmount: 1000 }] } as never);
    useNotificationStore.setState({ dismissedIds: ["goal-done-g1"] });

    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(0);
  });
});
