import {expect, test} from "../../fixtures";
import {randomGoal} from "../../test-data/factory";

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
