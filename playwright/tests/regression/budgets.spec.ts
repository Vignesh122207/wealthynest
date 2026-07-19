import {test} from "../../fixtures";
import {randomBudget, randomCategoryName} from "../../test-data/factory";
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
});
