import {expect, test} from "../../fixtures";
import {randomBankAccount, randomGoal} from "../../test-data/factory";
import {readRegressionUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";

// Serial — see debts.spec.ts's comment: shares the regressionUser with every other file in
// tests/regression/.
test.describe.configure({ mode: "serial" });

test.describe("Goals", () => {
  test("creates a goal and adds partial savings @regression", async ({ goalsPage }) => {
    const goal = randomGoal();
    await goalsPage.gotoGoals();
    await goalsPage.createGoal({ name: goal.name, targetAmount: goal.targetAmount });
    await goalsPage.expectGoalVisible(goal.name);

    await goalsPage.addSavings(goal.name, Math.floor(goal.targetAmount / 2));
    await goalsPage.expectGoalVisible(goal.name);
  });

  test("adding savings up to the target amount marks the goal complete @regression", async ({ goalsPage }) => {
    const goal = randomGoal();
    await goalsPage.gotoGoals();
    await goalsPage.createGoal({ name: goal.name, targetAmount: goal.targetAmount });
    await goalsPage.addSavings(goal.name, goal.targetAmount);

    await goalsPage.expectComplete(goal.name);
  });

  // Regression: adding more than what's needed used to silently cap at the target with no
  // feedback — the excess just vanished. Should reject inline instead, matching the withdraw
  // side's existing "can't withdraw more than saved" check.
  test("adding more savings than needed is rejected inline, not silently capped @regression", async ({ goalsPage }) => {
    const goal = randomGoal();
    await goalsPage.gotoGoals();
    await goalsPage.createGoal({ name: goal.name, targetAmount: 1000 });

    await goalsPage.attemptOvershootSavings(goal.name, 5000);

    await expect(goalsPage.rawPage.getByText(/only needs .*1,000 more/)).toBeVisible();
    await goalsPage.expectGoalVisible(goal.name);
  });

  // Regression: create()/update() used to reject savedAmount > targetAmount unconditionally,
  // including for a linked goal whose savedAmount is just a snapshot of the account's live
  // balance (see GoalServiceImpl's own comment) — an account that already holds more than the
  // goal's target is a perfectly valid "goal already achieved" starting point, not invalid input.
  test("linking an account whose balance already exceeds the target creates a completed goal, not a rejection @regression", async ({ goalsPage }, testInfo) => {
    const user = readRegressionUser(testInfo.project.name);
    const auth = await api.login({ email: user.email, password: user.password });
    const bank = randomBankAccount();
    const account = await api.createAccount(auth.accessToken, {
      accountType: "BANK_ACCOUNT", name: bank.bankName, bankName: bank.bankName, openingBalance: 50000,
    });
    const goal = randomGoal();
    await goalsPage.gotoGoals();

    await goalsPage.createGoalLinkedToAccount({ name: goal.name, targetAmount: 1000, accountId: account.id });

    await goalsPage.expectComplete(goal.name);
  });

  test("withdraws savings from a goal @regression", async ({ goalsPage }) => {
    const goal = randomGoal();
    await goalsPage.gotoGoals();
    await goalsPage.createGoal({ name: goal.name, targetAmount: goal.targetAmount });
    await goalsPage.addSavings(goal.name, Math.floor(goal.targetAmount / 2));

    await goalsPage.withdrawSavings(goal.name, 1000);
    await goalsPage.expectGoalVisible(goal.name);
  });

  test("edits a goal's target amount @regression", async ({ goalsPage }) => {
    const goal = randomGoal();
    await goalsPage.gotoGoals();
    await goalsPage.createGoal({ name: goal.name, targetAmount: goal.targetAmount });

    await goalsPage.editTargetAmount(goal.name, goal.targetAmount + 50000);
    await goalsPage.expectGoalVisible(goal.name);
  });

  test("pauses and resumes a goal @regression", async ({ goalsPage }) => {
    const goal = randomGoal();
    await goalsPage.gotoGoals();
    await goalsPage.createGoal({ name: goal.name, targetAmount: goal.targetAmount });

    await goalsPage.pauseGoal(goal.name);
    await goalsPage.expectPaused(goal.name);

    await goalsPage.resumeGoal(goal.name);
  });

  test("deletes a goal @regression", async ({ goalsPage }) => {
    const goal = randomGoal();
    await goalsPage.gotoGoals();
    await goalsPage.createGoal({ name: goal.name, targetAmount: goal.targetAmount });
    await goalsPage.expectGoalVisible(goal.name);

    await goalsPage.deleteGoal(goal.name);
    await goalsPage.expectGoalNotVisible(goal.name);
  });

  // ─── Validation depth (goalSchema.ts) ───────────────────────────────────────

  test("a zero target amount is rejected client-side @regression", async ({ goalsPage }) => {
    const goal = randomGoal();
    await goalsPage.gotoGoals();
    await goalsPage.attemptCreateInvalid({ name: goal.name, targetAmount: 0 });

    await expect(goalsPage.rawPage.getByText("Must be a positive amount")).toBeVisible();
    await goalsPage.expectGoalNotVisible(goal.name);
  });

  test("a saved amount greater than the target amount is rejected client-side @regression", async ({ goalsPage }) => {
    const goal = randomGoal();
    await goalsPage.gotoGoals();
    await goalsPage.attemptCreateInvalid({ name: goal.name, targetAmount: 1000, savedAmount: 2000 });

    await expect(goalsPage.rawPage.getByText("Saved amount cannot exceed the target amount")).toBeVisible();
    await goalsPage.expectGoalNotVisible(goal.name);
  });
});
