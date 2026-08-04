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
  });

  test.afterAll(async () => {
    await api.closeAccount(accessToken).catch(() => {});
    await context.close();
  });

  test("no over-budget, no debts: attention row is absent; Insights alone reclaims its row @regression", async () => {
    await home.gotoHome();
    await home.expectLoaded();

    await expect(home.attentionRow).not.toBeVisible();
    await expect(home.smartInsightsCard).toBeVisible();
    await expect(home.upcomingBillsCard).not.toBeVisible();
    await home.expectSpansFullRow(home.smartInsightsCard, page.getByTestId("smart-alerts-row"));
  });

  test("an over-budget budget alone shows the banner full-width, no debt card @regression", async () => {
    await api.createBudget(accessToken, { categoryId, amount: 1000, budgetType: "MONTHLY" });

    await home.gotoHome();
    await expect(home.attentionRow).toBeVisible();
    await expect(home.overBudgetBanner).toBeVisible();
    await expect(home.overBudgetBanner).toContainText("1 budget over limit");
    await expect(home.debtPulse).not.toBeVisible();
    await home.expectSpansFullRow(home.overBudgetBanner, home.attentionRow);
  });

  test("adding a debt makes the banner and DebtPulse share the row @regression", async () => {
    await api.createDebt(accessToken, { type: "LENT", contactName: "Reflow Test Contact", amount: 5000 });

    await home.gotoHome();
    await expect(home.overBudgetBanner).toBeVisible();
    await expect(home.debtPulse).toBeVisible();
    await home.expectSharesRow(home.overBudgetBanner, home.debtPulse, home.attentionRow);
  });

  test("dismissing the over-budget banner leaves DebtPulse alone, full-width @regression", async () => {
    await home.dismissOverBudgetBanner();

    await expect(home.overBudgetBanner).not.toBeVisible();
    await expect(home.debtPulse).toBeVisible();
    await home.expectSpansFullRow(home.debtPulse, home.attentionRow);
  });

  // ── Round 2: Month/Year toggle ──────────────────────────────────────────────
  test("Month/Year toggle swaps the hero label, stat tile labels, and the Budget Progress ring @regression", async () => {
    await home.gotoHome();

    await expect(home.periodNavLabel).toHaveText(/^[A-Za-z]{3} \d{4}$/); // e.g. "Aug 2026"
    // Month mode: the one MONTHLY budget seeded above (over its limit) is the only budget counted.
    await expect(home.budgetProgressCaption).toHaveText("0 of 1");
    const monthLabel = await home.periodNavLabel.textContent();
    const billsVisibleBefore = await home.upcomingBillsCard.isVisible();

    await home.switchToYearMode();
    await expect(home.periodNavLabel).toHaveText(/^\d{4}$/); // just the year, no month
    await expect(page.getByText("YTD Income")).toBeVisible();
    await expect(page.getByText("YTD Expenses")).toBeVisible();
    // No YEARLY-type budget was ever seeded in this file, so Year mode's ring — a different
    // dataset than Month's — has nothing to show, proving it actually swapped rather than just
    // relabeling the same monthly count.
    await expect(home.budgetProgressCaption).toHaveText("—");
    // Upcoming Bills is deliberately period-blind — same (absent) either way here.
    expect(await home.upcomingBillsCard.isVisible()).toBe(billsVisibleBefore);

    await home.switchToMonthMode();
    await expect(home.periodNavLabel).toHaveText(monthLabel!);
    await expect(home.budgetProgressCaption).toHaveText("0 of 1");
  });

  test("pace-to-save forecast hides on a past month and reappears on the current month @regression", async () => {
    await home.gotoHome();
    await expect(page.getByText("pace to save this month")).toBeVisible();

    await page.getByLabel("Previous month").click();
    await expect(page.getByText("pace to save this month")).not.toBeVisible();

    await page.getByLabel("Next month").click();
    await expect(page.getByText("pace to save this month")).toBeVisible();
  });

  // Spend-anomaly is the other current-month-only insight, but seeding a real one requires
  // triggering the backend's SpendAnomalyScheduler — an ADMIN-only, async job-scheduler action
  // (POST /admin/jobs/{name}/trigger) with no direct test hook, disproportionate to add just for
  // this one insight given getAnomalyInsight's filtering/mapping logic is already fully covered
  // by home.utils.test.ts's unit tests. Deliberately not covered here — see that test file instead.
});
