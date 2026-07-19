import {test} from "../../fixtures";
import {randomBankAccount, randomGoal} from "../../test-data/factory";
import {readRegressionUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
import {faker} from "@faker-js/faker";

// Serial — see debts.spec.ts's comment: shares the regressionUser with every other file in
// tests/regression/. Two bank accounts (for the Transfers tab's From/To pickers) and one goal
// (for the Goals tab, whose FAB is hidden until a goal exists) are seeded once via direct API
// calls in beforeAll, same rationale as transactions.spec.ts.
test.describe.configure({ mode: "serial" });

test.describe("Recurring Rules", () => {
  let fromAccountId: string;
  let toAccountId: string;
  let goalId: string;
  let goalName: string;

  test.beforeAll(async ({}, testInfo) => {
    const user = readRegressionUser(testInfo.project.name);
    const auth = await api.login({ email: user.email, password: user.password });
    const bank1 = randomBankAccount();
    const bank2 = randomBankAccount();
    const fromAccount = await api.createAccount(auth.accessToken, {
      accountType: "BANK_ACCOUNT", name: bank1.bankName, bankName: bank1.bankName, openingBalance: bank1.openingBalance,
    });
    fromAccountId = fromAccount.id;
    const toAccount = await api.createAccount(auth.accessToken, {
      accountType: "BANK_ACCOUNT", name: bank2.bankName, bankName: bank2.bankName, openingBalance: bank2.openingBalance,
    });
    toAccountId = toAccount.id;

    const goal = randomGoal();
    goalName = goal.name;
    const created = await api.createGoal(auth.accessToken, { name: goal.name, targetAmount: goal.targetAmount });
    goalId = created.id;
  });

  test("creates a recurring income rule @regression", async ({ recurringRulesPage }) => {
    const description = `E2E Recurring Income ${faker.string.alphanumeric(6)}`;
    await recurringRulesPage.gotoTab("income");
    await recurringRulesPage.createIncomeRule({ accountId: fromAccountId, amount: 25000, description });
    await recurringRulesPage.expectRuleVisible("income", description);
  });

  test("creates a recurring expense rule @regression", async ({ recurringRulesPage, regressionUser }) => {
    const description = `E2E Recurring Expense ${faker.string.alphanumeric(6)}`;
    await recurringRulesPage.gotoTab("expenses");
    await recurringRulesPage.createExpenseRule({
      categoryId: regressionUser.expenseCategoryId, accountId: fromAccountId, amount: 499, description,
    });
    await recurringRulesPage.expectRuleVisible("expenses", description);
  });

  test("creates a recurring transfer rule @regression", async ({ recurringRulesPage }) => {
    const description = `E2E Recurring Transfer ${faker.string.alphanumeric(6)}`;
    await recurringRulesPage.gotoTab("transfers");
    await recurringRulesPage.createTransferRule({ fromAccountId, toAccountId, amount: 1000, description });
    await recurringRulesPage.expectRuleVisible("transfers", description);
  });

  test("creates a recurring goal contribution rule @regression", async ({ recurringRulesPage }) => {
    await recurringRulesPage.gotoTab("goals");
    await recurringRulesPage.createGoalContributionRule({ goalId, amount: 2000 });
    await recurringRulesPage.expectRuleVisible("goals", goalName);
  });
});
