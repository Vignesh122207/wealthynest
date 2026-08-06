import {expect, test} from "../../fixtures";
import type {BrowserContext, Page} from "@playwright/test";
import {provisionE2EUser, storageStateFor} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
import {randomBankAccount, randomCategoryName} from "../../test-data/factory";
import {HomePage} from "../../pages/HomePage";

// A dedicated, disposable user (not the shared regressionUser other files in this suite mutate)
// — same rationale as visual-dynamic.spec.ts's own dedicated empty-state user. This file asserts
// the *absence* of the attention row / a lone reflowing card, which only holds reliably against
// an account whose budget/debt state this file fully controls.
test.describe.configure({ mode: "serial" });

test.describe("Home dashboard — dynamic reflow", () => {
  let context: BrowserContext;
  let page: Page;
  let home: HomePage;
  let accessToken: string;
  let categoryId: string;

  test.beforeAll(async ({ browser }) => {
    const user = await provisionE2EUser({ fullName: "Home Reflow Test User" });
    accessToken = user.auth.accessToken;

    const category = await api.createCategory(accessToken, { name: randomCategoryName(), type: "EXPENSE" });
    categoryId = category.id;
    const bank = randomBankAccount();
    const account = await api.createAccount(accessToken, {
      accountType: "BANK_ACCOUNT", name: bank.bankName, bankName: bank.bankName, openingBalance: bank.openingBalance,
    });

    const today = new Date();
    const isoDate = today.toISOString().split("T")[0];
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 10).toISOString().split("T")[0];

    // A small prior-month expense + a bigger current-month one in the same category gives
    // `smartInsights` (page.tsx) a real category-delta insight to show — needed for the
    // Insights/Bills reflow assertion below (this is the actual bug scenario: Smart Insights
    // has content, Upcoming Bills doesn't, so Insights alone must reclaim the row).
    await api.createExpense(accessToken, { categoryId, accountId: account.id, amount: 200, expenseDate: prevMonthDate, description: "prior month" });
    await api.createExpense(accessToken, { categoryId, accountId: account.id, amount: 1500, expenseDate: isoDate, description: "this month" });

    // Skips a real UI login (same rationale as fixtures/index.ts's authedContext) — this file's
    // own dedicated context, not the shared regressionUser one.
    context = await browser.newContext({ storageState: storageStateFor(user.auth) });
    page = await context.newPage();
    home = new HomePage(page);

    // Pins the browser clock to day 15 of the real current month for this whole suite.
    // getCategoryDeltaInsights (home.utils.ts) gates category-delta insights until day 7 of an
    // in-progress month, so the category-delta seed data above needs a stable, safely-past-the-
    // gate day rather than whatever day this suite happens to actually run on — same rationale as
    // the pace-forecast test further down, which pins the same day 15 for the same reason.
    await page.clock.install({ time: new Date(today.getFullYear(), today.getMonth(), 15) });
  });

  test.afterAll(async () => {
    await api.closeAccount(accessToken).catch(() => {});
    await context.close();
  });

  test("no over-budget, no debts: Insights alone reclaims the alerts row @regression", async () => {
    await home.gotoHome();
    await home.expectLoaded();

    await expect(home.alertsRow).toBeVisible();
    await expect(home.overBudgetBanner).not.toBeVisible();
    await expect(home.debtPulse).not.toBeVisible();
    await expect(home.smartInsightsCard).toBeVisible();
    await expect(home.upcomingBillsCard).not.toBeVisible();
    await home.expectSpansFullRow(home.smartInsightsCard, home.alertsRow);
  });

  test("an over-budget budget alone (no debt) and Insights alone each go full-width, not paired @regression", async () => {
    await api.createBudget(accessToken, { categoryId, amount: 1000, budgetType: "MONTHLY" });

    await home.gotoHome();
    await expect(home.overBudgetBanner).toBeVisible();
    await expect(home.overBudgetBanner).toContainText("1 budget over limit");
    await expect(home.debtPulse).not.toBeVisible();
    await expect(home.smartInsightsCard).toBeVisible();
    // Banner has no DebtPulse to pair with, and Insights has no Upcoming Bills to pair with —
    // a lone leftover on one side never cross-pairs with a lone leftover on the other, so both
    // render on their own full-width row instead of sharing one.
    await home.expectSpansFullRow(home.overBudgetBanner, home.alertsRow);
    await home.expectSpansFullRow(home.smartInsightsCard, home.alertsRow);
  });

  test("adding a debt: banner+DebtPulse share a row, Insights alone reclaims the trailing row @regression", async () => {
    await api.createDebt(accessToken, { type: "LENT", contactName: "Reflow Test Contact", amount: 5000 });

    await home.gotoHome();
    await expect(home.overBudgetBanner).toBeVisible();
    await expect(home.debtPulse).toBeVisible();
    await home.expectSharesRow(home.overBudgetBanner, home.debtPulse, home.alertsRow);
    await home.expectSpansFullRow(home.smartInsightsCard, home.alertsRow);
  });

  test("dismissing the over-budget banner leaves DebtPulse and Smart Insights each full-width, not paired @regression", async () => {
    await home.dismissOverBudgetBanner();

    await expect(home.overBudgetBanner).not.toBeVisible();
    await expect(home.debtPulse).toBeVisible();
    await expect(home.smartInsightsCard).toBeVisible();
    await home.expectSpansFullRow(home.debtPulse, home.alertsRow);
    await home.expectSpansFullRow(home.smartInsightsCard, home.alertsRow);
  });

  // ── Round 2: Month/Year toggle ──────────────────────────────────────────────
  test("Month/Year toggle swaps the hero label, stat tile labels, and the Budget Progress ring @regression", async () => {
    await home.gotoHome();

    await expect(home.periodNavLabel).toHaveText(/^[A-Za-z]{3} \d{4}$/); // e.g. "Aug 2026"
    // Month mode: the one MONTHLY budget seeded above (over its limit) is the only budget counted.
    await expect(home.budgetProgressCaption).toHaveText("0 of 1");
    // The detail panel below the ring must agree with it — it used to always receive every
    // budget unfiltered regardless of the toggle, so it never actually hit this empty state.
    await expect(home.budgetSection.getByText("No budgets set for this month")).not.toBeVisible();
    const monthLabel = await home.periodNavLabel.textContent();
    const billsVisibleBefore = await home.upcomingBillsCard.isVisible();

    await home.switchToYearMode();
    await expect(home.periodNavLabel).toHaveText(/^\d{4}$/); // just the year, no month
    await expect(page.getByText("YTD Income")).toBeVisible();
    await expect(page.getByText("YTD Expenses")).toBeVisible();
    // Budget Progress follows the toggle like every other tile (see StatOverview's activeBudgets
    // comment) — Year mode counts only YEARLY budgets, and none were seeded in this file, so it
    // falls into the "no budgets for this period" empty state rather than repeating Month's count.
    await expect(home.budgetProgressCaption).toHaveText("—");
    // The detail panel must independently reach its own "no yearly budgets" empty state too —
    // before the fix it kept showing the seeded MONTHLY budget's row here instead, contradicting
    // the ring right above it.
    await expect(home.budgetSection.getByText("No yearly budgets set")).toBeVisible();
    // Upcoming Bills is deliberately period-blind — same (absent) either way here.
    expect(await home.upcomingBillsCard.isVisible()).toBe(billsVisibleBefore);

    await home.switchToMonthMode();
    await expect(home.periodNavLabel).toHaveText(monthLabel!);
    await expect(home.budgetProgressCaption).toHaveText("0 of 1");
    await expect(home.budgetSection.getByText("No budgets set for this month")).not.toBeVisible();
  });

  test("pace-to-save forecast hides on a past month and reappears on the current month @regression", async () => {
    // getPaceForecast (home.utils.ts) returns null before day 5 of the month — too few days of
    // real spend to extrapolate a stable pace (see its own comment) — so asserting the forecast
    // is visible "on the current month" would fail every 1st-4th of the month regardless of the
    // app behaving correctly. Pin the browser clock to day 15 of the real current month/year
    // (same period the expenses seeded in beforeAll query against) instead of whatever day this
    // actually runs on.
    const now = new Date();
    await page.clock.install({ time: new Date(now.getFullYear(), now.getMonth(), 15) });

    await home.gotoHome();
    await expect(page.getByText(/on pace to save/)).toBeVisible();

    await page.getByLabel("Previous month").click();
    await expect(page.getByText(/on pace to save/)).not.toBeVisible();

    await page.getByLabel("Next month").click();
    await expect(page.getByText(/on pace to save/)).toBeVisible();
  });

  // Spend-anomaly is the other current-month-only insight, but seeding a real one requires
  // triggering the backend's SpendAnomalyScheduler — an ADMIN-only, async job-scheduler action
  // (POST /admin/jobs/{name}/trigger) with no direct test hook, disproportionate to add just for
  // this one insight given getAnomalyInsight's filtering/mapping logic is already fully covered
  // by home.utils.test.ts's unit tests. Deliberately not covered here — see that test file instead.
});
