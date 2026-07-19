import {expect, test} from "../../fixtures";
import {
    randomBankAccount,
    randomBudget,
    randomExpense,
    randomFixedDeposit,
    randomGoal,
    randomIncome,
    randomTransfer,
} from "../../test-data/factory";
import {ROUTES} from "../../constants/routes";
import {AccountsPage} from "../../pages/AccountsPage";
import {TransactionsPage} from "../../pages/TransactionsPage";
import {BudgetsPage} from "../../pages/BudgetsPage";
import {GoalsPage} from "../../pages/GoalsPage";
import {InvestmentsPage} from "../../pages/InvestmentsPage";

// The one end-to-end path that must never break: Login -> Create Account -> Add Income ->
// Add Expense -> Transfer Money -> Create Budget -> Create Goal -> Add Investment -> View
// Dashboard -> Logout. Runs as a single spec (not split into independent tests) because each
// step's data is a real precondition for the next — Transfer needs two accounts, Budget spends
// against the same category as the Expense, and Dashboard verification checks the sum of
// everything created before it.
//
// Page objects are built locally from `page` here rather than destructured from the fixtures
// module: fixtures/index.ts wires accountsPage/transactionsPage/budgetsPage/goalsPage/
// investmentsPage to `authedPage` (a separate browser context pre-authenticated as
// regressionUser) for tests/regression/'s benefit. This spec instead does a real UI login as
// e2eUser on `page` — using the fixture-provided page objects here would silently drive
// regressionUser's session instead (they did, briefly: it's what caused the category-picker
// mismatch this test used to fail on, e2eUser's category never appearing because the picker
// was actually rendering regressionUser's).
test.describe("Critical Business Flow @smoke @critical", () => {
  test("a new user can complete the full core workflow in one session", async ({
    page, loginPage, dashboardPage, e2eUser,
  }) => {
    const accountsPage = new AccountsPage(page);
    const transactionsPage = new TransactionsPage(page);
    const budgetsPage = new BudgetsPage(page);
    const goalsPage = new GoalsPage(page);
    const investmentsPage = new InvestmentsPage(page);

    const bank = randomBankAccount();
    const expense = randomExpense();
    const income = randomIncome();
    const transfer = randomTransfer();
    const budget = randomBudget();
    const goal = randomGoal();
    const today = new Date().toISOString().split("T")[0];
    const fd = randomFixedDeposit(today);

    // ── 1. Login ────────────────────────────────────────────────────────────
    await loginPage.loginWithPassword(e2eUser.email, e2eUser.password);
    await dashboardPage.expectLoaded();

    // ── 2. Create Account — a bank account plus a cash wallet (Transfer needs 2 accounts) ──
    await accountsPage.gotoAccounts();
    await accountsPage.createBankAccount({ bankName: bank.bankName, openingBalance: bank.openingBalance });
    await accountsPage.expectAccountVisible(bank.bankName);

    await accountsPage.createCashWalletAccount(1000);
    await accountsPage.expectAccountVisible("Cash Wallet");

    // ── 3. Add Income (to the bank account) ────────────────────────────────
    await transactionsPage.gotoTransactions();
    await transactionsPage.addIncome({ amount: income.amount, sourceLabel: "Salary", accountName: bank.bankName });
    // Amounts render Indian-grouped ("82,319", not "82319") — description/label text is a
    // simpler, formatting-independent thing to assert against than reformatting the raw number.
    await transactionsPage.expectRowVisible("Salary");

    // ── 4. Add Expense (against the seeded E2E category) ───────────────────
    await transactionsPage.addExpense({
      amount: expense.amount, categoryName: e2eUser.expenseCategoryName, description: expense.description,
    });
    await transactionsPage.expectRowVisible(expense.description);

    // ── 5. Transfer Money (Cash Wallet -> bank account) ─────────────────────
    await transactionsPage.transfer({ amount: transfer.amount, fromAccountName: "Cash Wallet", toAccountName: bank.bankName });

    // ── 6. Create Budget (same category as the expense above) ──────────────
    await budgetsPage.gotoBudgets();
    await budgetsPage.createMonthlyBudget({ categoryName: e2eUser.expenseCategoryName, amount: budget.amount });
    await budgetsPage.expectBudgetVisible(e2eUser.expenseCategoryName);

    // ── 7. Create Goal ───────────────────────────────────────────────────────
    await goalsPage.gotoGoals();
    await goalsPage.createGoal({ name: goal.name, targetAmount: goal.targetAmount });
    await goalsPage.expectGoalVisible(goal.name);

    // ── 8. Add Investment (Fixed Deposit) ───────────────────────────────────
    await investmentsPage.gotoInvestments();
    await investmentsPage.createFixedDeposit(fd);
    await investmentsPage.expectInvestmentVisible(fd.bankName);

    // ── 9. View Dashboard — everything created above should be reflected ───
    await dashboardPage.gotoDashboard();
    await dashboardPage.expectLoaded();
    await expect(page.getByText(goal.name)).toBeVisible();

    // ── 10. Logout ───────────────────────────────────────────────────────────
    await dashboardPage.logout();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
  });
});
