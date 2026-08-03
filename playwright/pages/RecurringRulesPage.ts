import {expect, type Locator} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";
import {waitForApiResponse, waitForDialogClosed} from "../helpers/wait.helper";

export class RecurringRulesPage extends BasePage {
  /** Doubles as this page's only entry point (every caller's first navigation) and its tab
   * switcher. The first call is a real hard navigation (there's nothing loaded yet to click), but
   * once already on this route, clicks the real tab pill instead — settings/recurring/page.tsx's
   * TabBar onChange does a client-side router.replace, not a reload, so a second hard page.goto()
   * back-to-back with the first used to re-mount DashboardLayout and re-fire its cold-boot resync/
   * refresh on top of whatever the first goto() had just triggered. See InvestmentsPage.gotoTab's
   * identical fix, where that race was confirmed actually happening. */
  async gotoTab(tab: "income" | "expenses" | "transfers" | "goals"): Promise<void> {
    if (this.page.url().includes(ROUTES.settingsRecurring)) {
      await this.page.getByTestId(`recurring-type-tab-${tab}`).click();
      return;
    }
    // BasePage.goto's waitForDashboardReady only waits out the layout's own GET /users/me resync
    // — the account/category/goal picker each tab's create*Rule immediately clicks into is fed by
    // a *different* parallel GET (useAccounts()/useCategories()/useGoals()), queued behind the same
    // 401-then-refresh cycle but not guaranteed to land at the same moment. This is the fastest,
    // fewest-clicks path to a data-dependent picker anywhere in the regression suite (FAB → open →
    // fill amount → picker, no toast/list/filter step in between to absorb the gap), so it's the
    // one place that gap actually got hit: confirmed live via a real CI run's "waiting for
    // getByTestId('recurring-income-account-picker-option-<id>') / Timeout 30000ms exceeded" even
    // after the BasePage fix. Pairing this wait with the navigation (not calling it from inside
    // create*Rule, after the fetch may already be in flight or done) is what actually closes it.
    const resourcePaths = tab === "goals" ? ["/goals"] : tab === "expenses" ? ["/accounts", "/categories"] : ["/accounts"];
    await Promise.all([
      ...resourcePaths.map(path => waitForApiResponse(this.page, path, "GET")),
      this.goto(`${ROUTES.settingsRecurring}?tab=${tab}`),
    ]);
  }

  /** Explicitly picks the account rather than relying on RuleFormModal's default (accounts[0]) —
   * app-side now syncs that default once useAccounts() resolves (see IncomeTab.tsx), but
   * asserting a specific account regardless of default-selection logic keeps this test robust to
   * how that logic evolves later. */
  async createIncomeRule(input: { accountId: string; amount: number; description: string }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addRecurringIncome).click();
    await this.page.getByTestId("recurring-income-amount-input").fill(String(input.amount));
    await this.page.getByTestId("recurring-income-account-picker-trigger").click();
    await this.page.getByTestId(`recurring-income-account-picker-option-${input.accountId}`).click();
    await this.page.getByTestId("recurring-income-description-input").fill(input.description);
    await Promise.all([
      waitForApiResponse(this.page, "/recurring-income", "POST"),
      this.page.getByTestId("recurring-income-form-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Explicitly picks category and account rather than relying on RuleFormModal's defaults —
   * same rationale as createIncomeRule. */
  async createExpenseRule(input: { categoryId: string; accountId: string; amount: number; description: string }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addRecurringExpense).click();
    await this.page.getByTestId("recurring-expense-amount-input").fill(String(input.amount));
    await this.page.getByTestId("recurring-expense-category-picker-trigger").click();
    await this.page.getByTestId(`recurring-expense-category-picker-option-${input.categoryId}`).click();
    await this.page.getByTestId("recurring-expense-account-picker-trigger").click();
    await this.page.getByTestId(`recurring-expense-account-picker-option-${input.accountId}`).click();
    await this.page.getByLabel("Description (optional)").fill(input.description);
    await Promise.all([
      waitForApiResponse(this.page, "/expenses", "POST"),
      this.page.getByTestId("recurring-expense-form-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Requires at least two existing accounts (seed via api.createAccount in beforeAll). Explicitly
   * picks both accounts rather than relying on RuleFormModal's "From Account" default — same
   * rationale as createIncomeRule. */
  async createTransferRule(input: { fromAccountId: string; toAccountId: string; amount: number; description: string }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addRecurringTransfer).click();
    await this.page.getByTestId("recurring-transfer-amount-input").fill(String(input.amount));
    await this.page.getByTestId("recurring-transfer-from-account-picker-trigger").click();
    await this.page.getByTestId(`recurring-transfer-from-account-picker-option-${input.fromAccountId}`).click();
    await this.page.getByTestId("recurring-transfer-to-account-picker-trigger").click();
    await this.page.getByTestId(`recurring-transfer-to-account-picker-option-${input.toAccountId}`).click();
    await this.page.getByTestId("recurring-transfer-description-input").fill(input.description);
    await Promise.all([
      waitForApiResponse(this.page, "/recurring-transfer", "POST"),
      this.page.getByTestId("recurring-transfer-form-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Requires at least one existing goal (seed via api.createGoal in beforeAll) — the FAB action
   * itself is hidden until a goal exists. Explicitly picks the goal rather than relying on
   * GoalPicker's default (goals[0]) — same rationale as createIncomeRule. */
  async createGoalContributionRule(input: { goalId: string; amount: number }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addRecurringGoal).click();
    await this.page.getByTestId("recurring-goal-amount-input").fill(String(input.amount));
    await this.page.getByTestId("recurring-goal-picker-trigger").click();
    await this.page.getByTestId(`recurring-goal-picker-option-${input.goalId}`).click();
    await Promise.all([
      waitForApiResponse(this.page, "/recurring-goal-contribution", "POST"),
      this.page.getByTestId("recurring-goal-form-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  ruleCard(tab: "income" | "expenses" | "transfers" | "goals", text: string): Locator {
    const testId = {
      income: "recurring-income-rule-card",
      expenses: "recurring-expense-rule-card",
      transfers: "recurring-transfer-rule-card",
      goals: "recurring-goal-rule-card",
    }[tab];
    return this.page.getByTestId(testId).filter({ hasText: text });
  }

  async expectRuleVisible(tab: "income" | "expenses" | "transfers" | "goals", text: string): Promise<void> {
    await expect(this.ruleCard(tab, text).first()).toBeVisible();
  }
}
