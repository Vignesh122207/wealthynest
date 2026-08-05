import {test} from "../../fixtures";
import {faker} from "@faker-js/faker";
import {randomBankAccount, randomExpense, randomIncome, randomTransfer} from "../../test-data/factory";
import {readRegressionUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";

// Serial — see debts.spec.ts's comment: shares the regressionUser with every other file in
// tests/regression/. Two bank accounts are seeded once via direct API calls (not the Accounts UI)
// in beforeAll and reused by every test below, rather than each test navigating to /accounts and
// creating its own — that page alone fires ~7 GET requests per load, and multiplied across many
// tests it was enough to trip the API's 200 req/min general rate limit within a single run.
//
// Two BANK_ACCOUNTs, not a bank + Cash Wallet: Cash Wallet is a backend singleton (one per user),
// and accounts.spec.ts's own "only one Cash Wallet is allowed" test already creates one for this
// same shared regressionUser — a second attempt here got a 409 once both files ran in the same
// pass. Regular bank accounts have no such limit.
test.describe.configure({ mode: "serial" });

test.describe("Transactions", () => {
  let bankName: string;
  let bankName2: string;

  test.beforeAll(async ({}, testInfo) => {
    const user = readRegressionUser(testInfo.project.name);
    const auth = await api.login({ email: user.email, password: user.password });
    const bank = randomBankAccount();
    const bank2 = randomBankAccount();
    bankName = bank.bankName;
    bankName2 = bank2.bankName;
    await api.createAccount(auth.accessToken, {
      accountType: "BANK_ACCOUNT", name: bank.bankName, bankName: bank.bankName, openingBalance: bank.openingBalance,
    });
    await api.createAccount(auth.accessToken, {
      accountType: "BANK_ACCOUNT", name: bank2.bankName, bankName: bank2.bankName, openingBalance: bank2.openingBalance,
    });
  });

  test("edits an expense's amount @regression", async ({ transactionsPage, regressionUser }) => {
    const expense = randomExpense();
    await transactionsPage.gotoTransactions();
    await transactionsPage.addExpense({ amount: expense.amount, categoryName: regressionUser.expenseCategoryName, description: expense.description });
    await transactionsPage.expectRowVisible(expense.description);

    await transactionsPage.editExpenseAmount(expense.description, expense.amount + 500);
    await transactionsPage.expectRowVisible(expense.description);
  });

  test("deletes an expense @regression", async ({ transactionsPage, regressionUser }) => {
    const expense = randomExpense();
    await transactionsPage.gotoTransactions();
    await transactionsPage.addExpense({ amount: expense.amount, categoryName: regressionUser.expenseCategoryName, description: expense.description });
    await transactionsPage.expectRowVisible(expense.description);

    await transactionsPage.deleteExpense(expense.description);
    await transactionsPage.expectRowNotVisible(expense.description);
  });

  test("expense requires an amount @regression", async ({ transactionsPage, regressionUser }) => {
    await transactionsPage.gotoTransactions();
    await transactionsPage.attemptAddExpenseWithoutAmount(regressionUser.expenseCategoryName);
    await transactionsPage.expectValidationError("Amount must be positive");
  });

  test("deletes an income entry @regression", async ({ transactionsPage }) => {
    const income = randomIncome();
    const uniqueDescription = `Income-${faker.string.alphanumeric(8)}`;
    await transactionsPage.gotoTransactions();
    await transactionsPage.addIncome({ amount: income.amount, sourceLabel: "Bonus", accountName: bankName, description: uniqueDescription });
    await transactionsPage.expectRowVisible(uniqueDescription);

    await transactionsPage.deleteIncomeEntry(uniqueDescription);
    await transactionsPage.expectRowNotVisible(uniqueDescription);
  });

  test("deletes a transfer @regression", async ({ transactionsPage }) => {
    const transfer = randomTransfer();
    await transactionsPage.gotoTransactions();
    await transactionsPage.transfer({ amount: transfer.amount, fromAccountName: bankName2, toAccountName: bankName });
    await transactionsPage.expectRowVisible(/transfer/i);

    await transactionsPage.deleteTransfer();
  });

  test("search filters the transaction list by description @regression", async ({ transactionsPage, regressionUser }) => {
    const findMe = `Findme-${faker.string.alphanumeric(8)}`;
    const other = randomExpense();
    await transactionsPage.gotoTransactions();
    await transactionsPage.addExpense({ amount: 111, categoryName: regressionUser.expenseCategoryName, description: findMe });
    await transactionsPage.addExpense({ amount: 222, categoryName: regressionUser.expenseCategoryName, description: other.description });
    await transactionsPage.expectRowVisible(findMe);
    await transactionsPage.expectRowVisible(other.description);

    await transactionsPage.search(findMe);
    await transactionsPage.expectRowVisible(findMe);
    await transactionsPage.expectRowNotVisible(other.description);
  });

  test("type tabs filter Expenses vs Income vs Transfers @regression", async ({ transactionsPage, regressionUser }) => {
    const expense = randomExpense();
    await transactionsPage.gotoTransactions();
    await transactionsPage.addExpense({ amount: expense.amount, categoryName: regressionUser.expenseCategoryName, description: expense.description });

    await transactionsPage.typeTab("expenses").click();
    await transactionsPage.expectRowVisible(expense.description);

    await transactionsPage.typeTab("income").click();
    await transactionsPage.expectRowNotVisible(expense.description);
  });

  // Regression for a real bug: useIncome only takes year/month, not a date range, so Custom
  // mode's income fetch was scoped to whatever `year` state happened to be — which Custom mode's
  // own date pickers never touch — instead of the actual picked range. Landing on the page
  // (defaulted to the current year, never navigated via the Year toggle) and picking a Custom
  // range in a past year silently fetched the current year's income and filtered *that* down to
  // the past-year range, always yielding zero rows regardless of real data.
  test("Custom date range in a year other than the page's default still shows that year's income @regression", async ({ transactionsPage }, testInfo) => {
    const user = readRegressionUser(testInfo.project.name);
    const auth = await api.login({ email: user.email, password: user.password });
    const lastYear = new Date().getFullYear() - 1;
    const uniqueDescription = `LastYearIncome-${faker.string.alphanumeric(8)}`;
    await api.createIncome(auth.accessToken, {
      source: "SALARY", amount: 12345, incomeDate: `${lastYear}-06-15`,
      periodMonth: 6, periodYear: lastYear, description: uniqueDescription,
    });

    // Never switches to Year mode, so `year` state stays at the current year the whole time —
    // the exact scenario that silently returned zero income rows before the fix.
    await transactionsPage.gotoTransactions();
    await transactionsPage.typeTab("income").click();
    await transactionsPage.setCustomDateRange(`${lastYear}-01-01`, `${lastYear}-12-31`);

    await transactionsPage.expectRowVisible(uniqueDescription);
  });
});
