import {test} from "../../fixtures";
import {randomBankAccount, randomBudget, randomCategoryName} from "../../test-data/factory";
import {readRegressionUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";

// Serial — see debts.spec.ts's comment. Each test creates its own fresh EXPENSE category via a
// direct API call (not the Settings > Categories UI, which isn't what this file is testing) since
// a budget is one-per-category-per-month — reusing regressionUser's single seeded category across
// tests would make every test after the first hit "budget already exists this month".
test.describe.configure({ mode: "serial" });

// `project` defaults to "chromium" (every call site below passes testInfo.project.name
// explicitly) — see auth.helper.ts's readRegressionUser for why this stays cross-project-safe.
async function freshCategory(project: string): Promise<string> {
  const user = readRegressionUser(project);
  const auth = await api.login({ email: user.email, password: user.password });
  const category = await api.createCategory(auth.accessToken, { name: randomCategoryName(), type: "EXPENSE" });
  return category.name;
}

test.describe("Budgets", () => {
  test("creates a monthly budget and edits its amount @regression", async ({ budgetsPage }, testInfo) => {
    const categoryName = await freshCategory(testInfo.project.name);
    const budget = randomBudget();
    await budgetsPage.gotoBudgets();
    await budgetsPage.createMonthlyBudget({ categoryName, amount: budget.amount });
    await budgetsPage.expectBudgetVisible(categoryName);

    await budgetsPage.editBudgetAmount(categoryName, budget.amount + 1000);
    await budgetsPage.expectBudgetVisible(categoryName);
  });

  test("creates a yearly budget @regression", async ({ budgetsPage }, testInfo) => {
    const categoryName = await freshCategory(testInfo.project.name);
    const budget = randomBudget();
    await budgetsPage.gotoBudgets();
    await budgetsPage.createYearlyBudget({ categoryName, amount: budget.amount });
    await budgetsPage.expectBudgetVisible(categoryName);
  });

  test("changes the alert threshold @regression", async ({ budgetsPage }, testInfo) => {
    const categoryName = await freshCategory(testInfo.project.name);
    const budget = randomBudget();
    await budgetsPage.gotoBudgets();
    await budgetsPage.createMonthlyBudget({ categoryName, amount: budget.amount });

    await budgetsPage.editAlertThreshold(categoryName, "50");
    await budgetsPage.expectAlertThreshold(categoryName, "50");
  });

  test("deletes a budget @regression", async ({ budgetsPage }, testInfo) => {
    const categoryName = await freshCategory(testInfo.project.name);
    const budget = randomBudget();
    await budgetsPage.gotoBudgets();
    await budgetsPage.createMonthlyBudget({ categoryName, amount: budget.amount });
    await budgetsPage.expectBudgetVisible(categoryName);

    await budgetsPage.deleteBudget(categoryName);
    await budgetsPage.expectBudgetNotVisible(categoryName);
  });

  test("a second budget on the same category in the same month is rejected @regression", async ({ budgetsPage }, testInfo) => {
    const categoryName = await freshCategory(testInfo.project.name);
    const budget = randomBudget();
    await budgetsPage.gotoBudgets();
    await budgetsPage.createMonthlyBudget({ categoryName, amount: budget.amount });
    await budgetsPage.expectBudgetVisible(categoryName);

    // Category picker only lists categories without an existing budget this month, so this
    // category won't even appear a second time — confirming that (rather than trying to
    // re-select it, which the UI doesn't even offer) is the real assertion here.
    await budgetsPage.gotoBudgets();
    await budgetsPage.expectCategoryNotInCreatePicker(categoryName);
  });

  // Regression: editing a budget's category to one that already has a budget of the same type
  // used to be allowed with no check at all (unlike the Create form's own picker filtering),
  // silently producing two live budget rows for that category+type — each independently
  // tracking (and, on the "Spent This Year" stat card, double-counting) the same expenses.
  test("editing a budget's category to one already used by another budget of the same type is rejected @regression", async ({ budgetsPage }, testInfo) => {
    const takenCategory = await freshCategory(testInfo.project.name);
    const editingCategory = await freshCategory(testInfo.project.name);
    const budget = randomBudget();
    await budgetsPage.gotoBudgets();
    await budgetsPage.createMonthlyBudget({ categoryName: takenCategory, amount: budget.amount });
    await budgetsPage.createMonthlyBudget({ categoryName: editingCategory, amount: budget.amount });

    // Same assertion shape as the Create-form case above: the edit picker simply never offers
    // the taken category, rather than offering it and rejecting the submit.
    await budgetsPage.expectCategoryNotInEditPicker(editingCategory, takenCategory);
  });

  // Regression: a category with both a MONTHLY and a YEARLY budget (a combination the app
  // explicitly supports — see budgets/page.tsx's existingCategoryIds comment) had its real
  // annual spend counted twice in the "Spent This Year" stat card, because the backend puts the
  // same category-level annualSpent figure on every budget row for that category and the page
  // summed every row instead of deduping by category.
  test("a category with both a Monthly and a Yearly budget doesn't double-count Spent This Year @regression", async ({ budgetsPage }, testInfo) => {
    const user = readRegressionUser(testInfo.project.name);
    const auth = await api.login({ email: user.email, password: user.password });
    const category = await api.createCategory(auth.accessToken, { name: randomCategoryName(), type: "EXPENSE" });
    const bank = randomBankAccount();
    const account = await api.createAccount(auth.accessToken, {
      accountType: "BANK_ACCOUNT", name: bank.bankName, bankName: bank.bankName, openingBalance: bank.openingBalance,
    });
    const today = new Date().toISOString().split("T")[0];
    await api.createExpense(auth.accessToken, {
      categoryId: category.id, accountId: account.id, amount: 555, expenseDate: today, description: "annualSpent double-count regression",
    });

    await budgetsPage.gotoBudgets();
    await budgetsPage.createMonthlyBudget({ categoryName: category.name, amount: 10000 });
    await budgetsPage.createYearlyBudget({ categoryName: category.name, amount: 20000 });

    await budgetsPage.gotoBudgets();
    await budgetsPage.expectAnnualSpent("₹555");
  });
});
