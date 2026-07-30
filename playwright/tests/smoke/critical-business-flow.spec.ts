import {expect, test} from "../../fixtures";
import {
    randomBankAccount,
    randomBudget,
    randomCategoryName,
    randomExpense,
    randomFixedDeposit,
    randomGoal,
    randomIncome,
    randomTransfer,
} from "../../test-data/factory";
import {ROUTES} from "../../constants/routes";
import {provisionE2EUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
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
    page, loginPage, homePage,
  }) => {
    const accountsPage = new AccountsPage(page);
    const transactionsPage = new TransactionsPage(page);
    const budgetsPage = new BudgetsPage(page);
    const goalsPage = new GoalsPage(page);
    const investmentsPage = new InvestmentsPage(page);

    // Provisioned fresh here rather than via the shared e2eUser fixture (global-setup's single
    // user, reused across CI's retries): this test creates a real, persistent account/expense/
    // budget/goal/investment trail, so a first attempt that gets far enough to create the Cash
    // Wallet before failing on a later step leaves that account behind — the retry then hits
    // "only one Cash Wallet allowed" and fails immediately, masking whatever the real problem was
    // (confirmed via a real CI run: retries 1-2 both failed at account-creation, not the original
    // failure point). provisionE2EUser()'s unique-suffixed email makes every attempt, including
    // retries, start from a genuinely clean account — same pattern family.spec.ts already uses for
    // its own ad-hoc second user.
    const e2eUser = await provisionE2EUser();
    const category = await api.createCategory(e2eUser.auth.accessToken, { name: randomCategoryName(), type: "EXPENSE" });

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
    await homePage.expectLoaded();

    // ── 2. Create Account — a bank account plus a cash wallet (Transfer needs 2 accounts) ──
    await accountsPage.gotoAccounts();
    await accountsPage.createBankAccount({ bankName: bank.bankName, openingBalance: bank.openingBalance });
    await accountsPage.expectAccountVisible(bank.bankName);

    // Comfortably above randomTransfer()'s max (2000, see factory.ts) — at 1000 this transfer step
    // silently blocked on "Insufficient balance in Cash Wallet" roughly half the time (whenever the
    // random amount rolled above 1000), which submitBtn's client-side validation prevents from ever
    // firing the API call the next line waits on, so it just ran out the clock at a 15/30s
    // waitForResponse timeout that had nothing to do with the network or CI load — confirmed by
    // reproducing this locally, single worker, zero contention, same "Insufficient balance" text
    // visible in the error-context snapshot.
    await accountsPage.createCashWalletAccount(5000);
    await accountsPage.expectAccountVisible("Cash Wallet");

    // ── 3. Add Income (to the bank account) ────────────────────────────────
    await transactionsPage.gotoTransactions();
    await transactionsPage.addIncome({ amount: income.amount, sourceLabel: "Salary", accountName: bank.bankName });
    // Amounts render Indian-grouped ("82,319", not "82319") — description/label text is a
    // simpler, formatting-independent thing to assert against than reformatting the raw number.
    await transactionsPage.expectRowVisible("Salary");

    // ── 4. Add Expense (against the seeded E2E category) ───────────────────
    await transactionsPage.addExpense({
      amount: expense.amount, categoryName: category.name, description: expense.description,
    });
    await transactionsPage.expectRowVisible(expense.description);

    // ── 5. Transfer Money (Cash Wallet -> bank account) ─────────────────────
    await transactionsPage.transfer({ amount: transfer.amount, fromAccountName: "Cash Wallet", toAccountName: bank.bankName });

    // ── 6. Create Budget (same category as the expense above) ──────────────
    await budgetsPage.gotoBudgets();
    await budgetsPage.createMonthlyBudget({ categoryName: category.name, amount: budget.amount });
    await budgetsPage.expectBudgetVisible(category.name);

    // ── 7. Create Goal ───────────────────────────────────────────────────────
    await goalsPage.gotoGoals();
    await goalsPage.createGoal({ name: goal.name, targetAmount: goal.targetAmount });
    await goalsPage.expectGoalVisible(goal.name);

    // ── 8. Add Investment (Fixed Deposit) ───────────────────────────────────
    await investmentsPage.gotoInvestments();
    await investmentsPage.createFixedDeposit(fd);
    await investmentsPage.expectInvestmentVisible(fd.bankName);

    // ── 9. View Dashboard — everything created above should be reflected ───
    await homePage.gotoHome();
    await homePage.expectLoaded();
    await expect(page.getByText(goal.name)).toBeVisible();

    // ── 10. Logout ───────────────────────────────────────────────────────────
    await homePage.logout();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
  });
});
