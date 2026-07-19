import {expect, test} from "../../fixtures";
import {readRegressionUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
import {randomBankAccount} from "../../test-data/factory";

// Serial — see debts.spec.ts's comment. Analytics itself has no forms; this file's only setup
// concern is making sure the shared regressionUser has *some* current-month expense/income data
// to chart, seeded directly via API (not the UI — that's Transactions' own test surface).
test.describe.configure({ mode: "serial" });

test.describe("Analytics", () => {
  test.beforeAll(async ({}, testInfo) => {
    const user = readRegressionUser(testInfo.project.name);
    const auth = await api.login({ email: user.email, password: user.password });
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const isoDate = today.toISOString().split("T")[0];

    const bank = randomBankAccount();
    const account = await api.createAccount(auth.accessToken, {
      accountType: "BANK_ACCOUNT", name: bank.bankName, bankName: bank.bankName, openingBalance: bank.openingBalance,
    });

    await api.createExpense(auth.accessToken, {
      categoryId: user.expenseCategoryId, accountId: account.id, amount: 1500, expenseDate: isoDate, description: "Analytics seed expense",
    });
    await api.createIncome(auth.accessToken, {
      source: "SALARY", amount: 50000, incomeDate: isoDate, periodMonth: month, periodYear: year,
    });
  });

  test("loads with the current month's data reflected @regression", async ({ analyticsPage }) => {
    await analyticsPage.gotoAnalytics();
    await analyticsPage.expectLoaded();
    await expect(analyticsPage.monthLabel).toBeVisible();
  });

  test("Next month is disabled on the current month, Prev navigates back @regression", async ({ analyticsPage }) => {
    await analyticsPage.gotoAnalytics();
    await analyticsPage.expectNextMonthDisabled();

    const initialLabel = await analyticsPage.monthLabel.textContent();
    await analyticsPage.goToPrevMonth();
    await expect(analyticsPage.monthLabel).not.toHaveText(initialLabel ?? "");
  });
});
